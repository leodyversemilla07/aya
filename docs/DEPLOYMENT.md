# Production deployment

Aya runs as two stateless application processes (NestJS API and Next.js web) backed by PostgreSQL.
Chat usage counters are stored in the database, so quotas survive restarts and work across replicas.
A third alert-worker process enables proactive scans and signed webhook delivery; it coordinates with
other replicas through a database lease.

## PostgreSQL deployment

Set `DATABASE_URL` to a PostgreSQL connection string, then generate the client and apply migrations:

```bash
export DATABASE_URL='postgresql://aya:secret@db.example.com:5432/aya?sslmode=require'

pnpm install
pnpm --filter @workspace/db run generate
pnpm run db:migrate:deploy
pnpm run db:seed            # optional demo data
pnpm run build
pnpm --filter @aya/api run start:prod
```

In a second terminal, start the web application:

```bash
pnpm --filter web run start
```

In a third terminal, start the alert worker when proactive detection is required:

```bash
pnpm run worker:alerts:prod
```

Prisma selects `packages/db/prisma/schema.postgresql.prisma` and
`packages/db/prisma/migrations-postgresql` automatically when `DATABASE_URL` starts with
`postgresql://` or `postgres://`. SQLite remains the default for local development and tests.

`NEXT_PUBLIC_API_URL` is embedded into the browser bundle at build time. Rebuild the web application
when the public API URL changes.

### Schema changes

1. Edit `packages/db/prisma/schema.prisma`.
2. Create and apply a SQLite migration for local development:
   ```bash
   pnpm run db:migrate -- --name add_feature
   ```
3. Regenerate the PostgreSQL schema:
   ```bash
   pnpm run db:postgres:sync
   ```
4. Create the matching PostgreSQL migration against a scratch or development database:
   ```bash
   DATABASE_URL='postgresql://aya:secret@localhost:5432/aya_dev' \
     pnpm --filter @workspace/db exec prisma migrate dev --name add_feature
   ```
5. Commit both migration directories and the regenerated schema. CI checks the generated schema
   and verifies that the PostgreSQL migrations produce the same schema as the datamodel.

Never use `prisma migrate dev` against production. Deploy with `prisma migrate deploy` only.

## Required configuration

| Variable | Production guidance |
|----------|---------------------|
| `DATABASE_URL` | PostgreSQL URL with TLS where the provider requires it. |
| `API_KEY` | Long random value; required or the API refuses to start. |
| `BETTER_AUTH_SECRET` | Random 32-byte secret shared by API and web. |
| `BETTER_AUTH_URL` | Public web origin, e.g. `https://aya.example.com`. |
| `ADMIN_EMAILS` | Comma-separated addresses allowed to self-register as administrators. |
| `CORS_ORIGINS` | Exact public web origin(s), comma separated. Never `*` with credentials. |
| `NEXT_PUBLIC_API_URL` | Public API origin baked into the web build. |
| `LLM_API_KEY` | Provider key. |
| `TRUST_PROXY` | `true` only behind a trusted reverse proxy. |
| `CHAT_DAILY_QUOTA` | Requests per user/API key per UTC day; `0` disables. |
| `ALERT_SCAN_INTERVAL_MS` | Optional background scan interval; defaults to 60 seconds. |
| `ALERT_LEASE_SECONDS` | Optional worker lease duration; defaults to 60 seconds. |
| `ALERT_WEBHOOK_URL` | Optional signed alert event endpoint. |
| `ALERT_WEBHOOK_SECRET` | Optional HMAC-SHA256 secret; required with `ALERT_WEBHOOK_URL`. |
| `METRICS_TOKEN` | Optional Prometheus scrape token; at least 16 characters. Disables `/metrics` when unset. |

## Workspace access and audit history

The role migration promotes only the oldest account that existed before role enforcement to `admin`, so
an upgraded workspace retains a bootstrap administrator without granting every account full access.
Review the seeded administrator after deployment and promote additional accounts explicitly. Set
`ADMIN_EMAILS` to the comma-separated addresses allowed to self-register as administrators. Every
other self-service account starts as `viewer`.

- **Admin** — full staffing access, user-role management, and audit history.
- **Manager** — create, update, and delete staffing records.
- **Viewer** — read-only dashboard and management access.

The API prevents demoting the final administrator. API keys are trusted internal credentials and
retain broad access independently of user roles.

Successful staffing and role mutations write an `AuditLog` row in the same transaction as the
change. Each row stores the actor, action, entity, request ID, timestamp, and before/after state.
Apply an organization-appropriate retention policy to this table if it will be used for long-term
compliance reporting.

## Background alert worker

The worker scans staffing risks on a schedule, persists one row per alert condition, and delivers
lifecycle events to an optional webhook. The agent's `get_alerts` tool and the worker use the same
rule service.

Set both webhook values to enable delivery:

```env
ALERT_WEBHOOK_URL="https://alerts.example.com/aya"
ALERT_WEBHOOK_SECRET="replace-with-at-least-16-random-characters"
```

The worker sends signed JSON events with a stable delivery ID. It retries network failures,
timeouts, and non-`2xx` responses with exponential backoff. Delivery is at least once, so receivers
must deduplicate by `x-aya-delivery-id`. See
[Background alerts](./BACKGROUND_ALERTS.md) for the payload, signature verification, lifecycle, and
runbook.

Deploy one worker process per database-backed environment. Additional replicas are safe: a
PostgreSQL lease allows only one iteration at a time, and delivery rows are claimed atomically.
Monitor the worker process and query `GET /alerts/deliveries` as an administrator to inspect failed
or delayed deliveries.

Each transition also creates an in-app notification. Users can review these at `/notifications`;
read state is stored per account. Configure `METRICS_TOKEN` to expose Prometheus metrics:

```bash
curl https://aya.example.com/metrics \
  -H "Authorization: Bearer $METRICS_TOKEN"
```

The metrics endpoint reports worker lag and duration, lifecycle transitions, delivery attempts,
notification counts, and current open/resolved alert counts.

## Chat quotas

Every call to `/agent/chat` or `/agent/chat/stream` consumes one unit for the caller:

- Session callers are keyed by `user:<user-id>`.
- API-key callers share the `api-key` bucket.

Usage is persisted per UTC day in the `ChatUsage` table. Responses include:

| Header | Meaning |
|--------|---------|
| `x-chat-quota-limit` | Daily limit (`0` means disabled; quota headers are omitted). |
| `x-chat-quota-used` | Requests consumed today. |
| `x-chat-quota-remaining` | Requests left today. |
| `x-chat-quota-reset` | Next UTC midnight as ISO-8601. |

Over-limit requests return `429` with `retry-after` and the quota headers. The over-limit attempt is
clamped in the database so repeated retries cannot inflate the counter. Old rows can be removed
with `DELETE FROM "ChatUsage" WHERE day < to_char(now() - interval '30 days', 'YYYY-MM-DD');`.

The per-IP throttle from `@nestjs/throttler` (20 chat requests/minute) remains active in addition to
the daily quota.

## Logging and request IDs

The API writes one JSON line per completed or aborted request to stdout:

```json
{"timestamp":"2026-11-08T12:00:00.000Z","level":"info","event":"request.completed","requestId":"8f14e45f-…","method":"POST","path":"/agent/chat/stream","statusCode":200,"durationMs":1834.2}
```

Failures emit `request.failed` with `status`, `message`, and a stack for unexpected errors. Request
bodies and prompts are never logged.

Callers may send `x-request-id` (8–128 characters of `A-Z a-z 0-9 . _ : -`); otherwise a UUID is
generated. The value is returned on every response, included in JSON error bodies, and included in
SSE `error` events. Use it to correlate client reports with logs.

Ship stdout to your platform's log collector; the application does not write log files.

## Reverse proxy and SSE

The streaming endpoint sends `text/event-stream` with a `: ping` comment every 15 seconds.

- Disable proxy buffering for `/agent/chat/stream` (for example `proxy_buffering off` in nginx).
- Use a read timeout longer than the agent deadline (`AGENT_TIMEOUT_MS`, default 180 seconds).
- Forward `x-request-id` if clients supply it.
- Set `TRUST_PROXY=true` only when the proxy is trusted, so client IPs and throttling are correct.
- Terminate TLS at the proxy and keep `CORS_ORIGINS`, `BETTER_AUTH_URL`, and `NEXT_PUBLIC_API_URL`
  on the public HTTPS origins.

## Operations

| Check | Command/endpoint |
|-------|------------------|
| Liveness | `GET /health` |
| Database readiness | `GET /ready` |
| Apply migrations | `pnpm run db:migrate:deploy` |
| Run one alert iteration | `pnpm run worker:alerts:prod:once` |
| Inspect alert state | `GET /alerts` |
| Inspect delivery attempts | `GET /alerts/deliveries` |
| Inspect the notification inbox | `GET /notifications` |
| Scrape alert metrics | `GET /metrics` with `METRICS_TOKEN` |
| PostgreSQL schema sync check | `pnpm run db:postgres:check` |
| SQLite migration drift | `pnpm run db:drift` |

Back up PostgreSQL with `pg_dump` or your provider's managed backups.
