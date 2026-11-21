# Background alerts and notifications

Aya can detect staffing risks on a schedule instead of waiting for a manager to ask the agent. The
background worker evaluates the same alert rules as the agent's `get_alerts` tool, stores each alert
lifecycle in the database, creates an in-app notification, and delivers signed webhook events when a
rule opens, changes severity, reopens, or resolves.

This document explains how to run the worker, interpret its state, and verify webhook signatures.

## Alert rules

| Type | Condition | Severity |
|------|-----------|----------|
| Bench | Developer has been unassigned for more than 14 days | High after 30 days; otherwise medium |
| Contract | Started contract expires within 30 days or expired within the previous 30 days | High with fewer than 7 days remaining; otherwise medium |
| Performance | Developer's latest record has code quality below 80, PR merge time above 3 days, or client rating below 3.5 | High for quality below 70, merge time above 5 days, or rating below 3; otherwise medium |

The agent and worker call the same alert query service in
`apps/api/src/alerts/alert-query.ts`. A rule change therefore applies to chat and proactive
detection together. The worker persists what it finds; the agent evaluates the rules live when a
manager asks, so persisted state can be briefly behind a concurrent staffing change.

## Alert lifecycle

Each condition has a stable fingerprint, such as `contract:<contract-id>` or
`performance:<developer-id>`. Repeated scans update one row instead of creating duplicates.

| Event | When it occurs |
|-------|----------------|
| `opened` | A condition is detected for the first time |
| `updated` | An open alert changes severity |
| `reopened` | A previously resolved condition returns |
| `resolved` | A condition is no longer detected |

Resolved alerts remain in the database with `status = "resolved"` and a `resolvedAt` timestamp.
They are not deleted, so operators can inspect history. An alert that returns later is reopened and
receives a new lifecycle event.

Every transition also creates a workspace notification. Notification read state is stored per user,
so one person marking an alert read does not hide it from anyone else.

## Run the worker locally

Apply the current migrations, then run one iteration:

```bash
pnpm run db:migrate:deploy
pnpm run worker:alerts:once
```

Run the continuous worker in a second terminal:

```bash
pnpm run worker:alerts
```

The worker scans every `ALERT_SCAN_INTERVAL_MS` milliseconds. Both commands use the root `.env` and
the same `DATABASE_URL` as the API.

## Webhook configuration

Configure both values to enable delivery:

```env
ALERT_WEBHOOK_URL="https://alerts.example.com/aya"
ALERT_WEBHOOK_SECRET="replace-with-at-least-16-random-characters"
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `ALERT_SCAN_INTERVAL_MS` | `60000` | Delay between worker scans; minimum 5 seconds |
| `ALERT_LEASE_SECONDS` | `60` | Database lease duration; minimum 10 seconds |
| `ALERT_WEBHOOK_URL` | — | HTTP endpoint that receives alert events |
| `ALERT_WEBHOOK_SECRET` | — | HMAC-SHA256 signing secret; at least 16 characters |
| `ALERT_WEBHOOK_TIMEOUT_MS` | `10000` | Per-request webhook timeout |
| `ALERT_WEBHOOK_MAX_ATTEMPTS` | `5` | Maximum delivery attempts |
| `METRICS_TOKEN` | — | Optional token for the Prometheus endpoint; at least 16 characters |

The API rejects a configuration that contains only one of `ALERT_WEBHOOK_URL` and
`ALERT_WEBHOOK_SECRET`. When no webhook is configured, the worker still scans and persists alert
state; delivery rows remain pending until a webhook URL is available.

## Webhook contract

The worker sends an HTTP `POST` with a JSON body. The `alert` object is an event-time snapshot, so a
queued `opened` event still describes the alert as opened even if the current alert has since been
resolved:

```json
{
  "id": "delivery-id",
  "event": "opened",
  "occurredAt": "2026-11-21T12:00:00.000Z",
  "alert": {
    "id": "alert-id",
    "fingerprint": "contract:contract-id",
    "type": "contract",
    "severity": "high",
    "status": "open",
    "entityType": "contract",
    "entityId": "contract-id",
    "message": "Alex's contract at Acme expires in 3 days",
    "data": { "developerId": "developer-id", "daysLeft": 3 },
    "firstSeenAt": "2026-11-21T12:00:00.000Z",
    "lastSeenAt": "2026-11-21T12:00:00.000Z",
    "resolvedAt": null,
    "lastEventAt": "2026-11-21T12:00:00.000Z"
  }
}
```

Delivery headers include:

| Header | Value |
|--------|-------|
| `x-aya-delivery-id` | Stable delivery identifier; use it to deduplicate retries |
| `x-aya-event` | Lifecycle event |
| `x-aya-signature` | `sha256=<hex HMAC>` over the exact request body |

Verify the signature before accepting an event:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(rawBody: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const received = Buffer.from(signature);
  const calculated = Buffer.from(expected);
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}
```

Read the raw request body before JSON parsing; re-serializing it can change whitespace and break
signature verification.

## Delivery behavior

Delivery is **at least once**:

- Any `2xx` response marks the delivery as succeeded.
- Network failures, timeouts, and non-`2xx` responses schedule another attempt.
- Retry delay starts at 5 seconds and doubles up to one hour.
- Attempts stop at `ALERT_WEBHOOK_MAX_ATTEMPTS`; the failed row remains visible to operators.
- A delivery keeps the same ID across retries. Receivers should deduplicate by that ID.
- If a worker stops after sending but before recording success, the event is sent again.

Workers coordinate through the `WorkerLease` database row. Only the lease holder scans and delivers;
another replica skips that iteration. Delivery rows are also claimed atomically before a request, so
concurrent workers cannot send the same delivery simultaneously.

## Administrator operations

Administrators can inspect the effective, code-managed rules and deployment-managed delivery
configuration without exposing the webhook secret:

```bash
curl http://localhost:3001/admin/alerts/config \
  -H "x-api-key: $API_KEY"
```

`POST /admin/alerts/scan` triggers an immediate scan. Administrator-triggered scans write an audit
event with the actor, request ID, and scan summary. Delivery URLs and secrets remain deployment
configuration and are not edited through the browser. The secret is never stored; each delivery keeps
a destination snapshot, while the administrator API redacts URL credentials and query parameters.

## In-app inbox

Signed-in workspace users can open `/notifications` in the web app or call the notification API:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/notifications` | `GET` | List notifications; supports `unreadOnly`, `limit`, and `offset` |
| `/notifications/unread-count` | `GET` | Return the current user's unread count |
| `/notifications/:id/read` | `POST` | Mark one notification as read |
| `/notifications/read-all` | `POST` | Mark all notifications as read for the current user |

The sidebar bell shows the unread count and refreshes it every 30 seconds. Read state is independent
for every account. API-key clients do not have a personal inbox and receive `403` from these routes.

## Prometheus metrics

Set `METRICS_TOKEN` to enable the exposition endpoint:

```bash
curl http://localhost:3001/metrics \
  -H "x-metrics-token: $METRICS_TOKEN"
```

`Authorization: Bearer <token>` is also accepted. When no token is configured, the endpoint returns
`404`. The response uses Prometheus text format and includes:

- worker run count, last run and success timestamps, lag, duration, and last-error state;
- alert transitions by `opened`, `updated`, `reopened`, and `resolved` event;
- webhook rows by delivery status and cumulative delivery attempts;
- in-app notification and per-user read counts;
- current open and resolved alert-state counts.

## Inspect alert state

Authenticated workspace users can list persisted alerts:

```bash
curl http://localhost:3001/alerts \
  -H "x-api-key: $API_KEY"
```

Supported filters are `status`, `type`, `severity`, `limit`, and `offset`. Administrators can inspect
delivery attempts:

```bash
curl http://localhost:3001/alerts/deliveries \
  -H "x-api-key: $API_KEY"
```

Delivery filters are `status`, `event`, `limit`, and `offset`. The delivery response includes attempt
count, next retry time, last error, HTTP response status, and delivery timestamps.

## Production deployment

Build the workspace and run the compiled worker as a separate process:

```bash
pnpm run build
pnpm run worker:alerts:prod
```

Run one worker process for each database-backed deployment. Multiple replicas are safe because of the
database lease, but a single active worker is normally sufficient. Deploy the worker with the same
`DATABASE_URL` and environment configuration as the API.

## Troubleshooting

| Symptom | Checks |
|---------|--------|
| No alert rows appear | Run `pnpm run worker:alerts:once`; verify migrations were applied and `DATABASE_URL` is shared with the API |
| Rows remain pending | Confirm `ALERT_WEBHOOK_URL` and `ALERT_WEBHOOK_SECRET` are both set; inspect `nextAttemptAt` and `lastError` in `/alerts/deliveries` |
| Repeated webhook calls | The endpoint likely failed after accepting the event; deduplicate by `x-aya-delivery-id` |
| Signature verification fails | Verify the exact raw body and confirm the worker and receiver use the same secret |
| Only one worker scans | This is expected; the other replica skips iterations while the database lease is active |

## Current scope

This milestone provides durable detection, an in-app inbox, external webhook delivery, and
Prometheus metrics. Editable alert rules, escalation policies, and multi-channel notification
providers are planned as separate follow-up work.
