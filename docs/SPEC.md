# Aya Project Specification

## Overview

**Aya** is an AI-powered staff augmentation management agent that helps managers find available
developers, match skills to projects, track utilization, monitor contracts, and flag risks through
natural language conversation.

## Project goals

1. **Staff augmentation intelligence** — AI assistant for managing developer resources
2. **Conversational interface** — natural language queries about teams and projects
3. **Data-driven decisions** — utilization metrics, contract tracking, performance data
4. **Proactive operations** — durable staffing alert detection, safe multi-worker coordination, and
   signed webhook delivery
5. **Safe deployment** — Better Auth sessions, API-key compatibility, sanitized errors, and rate
   limiting

## Architecture

### Technology stack

| Component | Technology | Version |
|-----------|------------|---------|
| Backend | NestJS | 11 |
| Frontend | Next.js | 16 |
| Database | SQLite (dev/test), PostgreSQL (production) | 3 / 17 |
| ORM | Prisma | 6 |
| UI | shadcn/ui (Base UI primitives, `base-nova` style), Tailwind CSS | latest |
| LLM | OpenAI-compatible API | — |
| Validation | Zod | 4 |
| Package manager | pnpm | 12.16 |
| Monorepo | Turborepo | 2 |
| Lint/format | Biome | 1.9 |
| Testing | Jest, Vitest, React Testing Library, Playwright | latest |

### Project structure

```
apps/
  api/
    src/
      agent/        Agent controller, loop, tool handlers, tool schemas
      alerts/       Shared alert query, durable scanner, worker lease, webhook delivery
      notifications/ Notification inbox and per-user read state
      auth/         API-key guard and @Public decorator
      management/   CRUD API for developers, clients, contracts, assignments, performance
      llm/          Provider-neutral LLM service used by the agent
      app.*         Root, health, stats, conversation routes
  web/
    app/
      page.tsx      Dashboard with live stats and chat
      chat/         Dedicated chat page
    components/
      chat/         ChatProvider, messages, composer, welcome
      dashboard/    Stats cards and quick actions
packages/
  db/               Prisma schema, migrations, seed data
  auth/             Shared Better Auth configuration and client
  ai/               Provider-neutral LLM client with native streaming adapters
  ui/               shadcn/ui component library
```

The Next.js frontend has no `app/api` route directory. It calls the NestJS API directly using
`NEXT_PUBLIC_API_URL`. Better Auth endpoints are hosted by NestJS under `/api/auth/*`, while
application endpoints use `/stats`, `/conversations`, and `/agent/chat`.

## Features

### Core functionality

1. **Developer roster search**
   - Query by canonical skills (all listed skills must match), availability, seniority, client
   - Bench and assignment status included in results

2. **Talent matching**
   - Rank developers by skill fit, availability, industry experience, seniority, performance
   - Returns matched and missing skills with scoring reasons

3. **Utilization tracking**
   - Team capacity metrics
   - Active vs bench ratio, breakdowns by client and seniority

4. **Contract management**
   - Contract status, billing rates, and days until expiry
   - Filters by client, status, and expiry window

5. **Performance monitoring**
   - Individual and team metrics: velocity, PR merge time, code quality, client rating
   - Optional period filter

6. **Risk alerts**
   - Bench time over 14 days
   - Contracts expiring within 30 days or expired within the previous 30 days
   - Performance concerns (code quality, merge time, client rating)

7. **Role-based access control**
   - Admin, manager, and viewer workspace roles
   - Viewers can read staffing data; managers can mutate it; admins manage users and audit history
   - The first local account bootstraps the admin role; production self-registration requires an `ADMIN_EMAILS` allowlist

8. **Audit history**
   - Transactional records for management and role mutations
   - Actor identity, action, entity, request ID, and before/after state
   - Administrator-only browsing and filtering

9. **Agent evaluation harness**
   - Deterministic replay scenarios for CI and optional live-provider comparisons
   - Assertions for tool sequence, argument validity, response content, and data grounding
   - Reports for pass rates, tool calls, token usage, and latency

10. **Background staffing alerts**
    - Shared alert query used by both the agent tool and the scheduled scanner
    - Durable open/resolved state with stable fingerprints, severity updates, and reopening
    - Database worker lease and atomic delivery claims for safe concurrent execution
    - Signed webhook events with timeout, retry, and delivery-attempt history
    - In-app notification inbox with per-user unread and read state
    - Token-protected Prometheus metrics for worker and delivery operations
    - Authenticated alert-state endpoint and administrator-only delivery history

### Agent loop

```
User Query → LLM Reasoning → Tool Calling → Zod Validation → Database Query → Formatted Response
```

- Tool iterations and total provider completions are capped; if the cap is reached, the agent is
  asked for a final answer using the results already gathered.
- Each agent turn has a total deadline and is cancelled when the client disconnects.
- Conversation history is limited to the most recent 20 user/assistant messages and 40,000
  characters.
- Tool calls and results are persisted for auditability; only user/assistant messages are replayed
  to the model.
- The system prompt includes today's date so expiry reasoning is deterministic.

### Provider streaming

`@workspace/ai` exposes one provider-neutral contract for completions: normalized messages and
tools in, text deltas, tool calls, usage, and finish reason out.

- OpenAI-compatible providers, Anthropic, and Google each stream natively. Anthropic consumes
  Messages API content-block events and Google consumes Gemini `streamGenerateContent` chunks.
- Tool declarations, assistant tool calls, and tool results are translated per provider, including
  Anthropic `tool_use`/`tool_result` blocks and Gemini `functionCall`/`functionResponse` parts.
- Consecutive same-role turns are merged before sending, because Anthropic requires `tool_result`
  blocks in the user turn that follows the assistant turn and Gemini expects alternating turns.
- Token usage is normalized across providers and reported on the completion response together with
  the provider, model, and streaming mode.

### Agent evaluation harness

The evaluation harness executes the production agent service and real database tools against a
disposable seeded database. Replay mode substitutes checked-in model responses, making tool
selection, arguments, grounding, response content, and error handling deterministic and
provider-free. Live mode uses the configured provider with the same scenario assertions.

- Thirteen scenarios cover every agent tool, multi-turn context, empty results, ambiguous clients,
  and missing records.
- Tool arguments are checked against the production Zod schemas.
- Named facts must appear in both tool output and the answer to pass grounding checks.
- A checked-in replay baseline requires 100% scenario, tool-selection, argument-validity,
  expected-argument, grounding, and response pass rates.
- JSON reports include per-turn checks, tool output, token usage, and latency; generated reports are
  ignored by Git.
- Replay mode guards orchestration and grounding regressions; prompt, tool-description, and model
  regressions require a live-provider run.

### Background alert pipeline

The agent's `get_alerts` tool and the background scanner call one alert query service. The scanner
writes a `StaffingAlert` row for each stable condition fingerprint and records `opened`, `updated`,
`reopened`, and `resolved` transitions in an `AlertDelivery` outbox. Resolved state is retained.

A standalone worker acquires a PostgreSQL or SQLite database lease before each iteration. It then
scans current staffing data and claims pending webhook deliveries. Delivery is at least once and
uses a stable delivery ID, exponential retry, a request timeout, and HMAC-SHA256 signatures.
Administrators can inspect attempt count, next retry, last error, response status, and timestamps.

Every transition creates a global notification; per-user read records are stored separately as users
open the inbox. The web app exposes an unread badge and read-all action. A token-protected
`/metrics` endpoint exposes worker lag, scan duration, alert transitions, delivery attempts,
notification counts, and state gauges in Prometheus text format.

### Capacity forecasting

`GET /forecast` and the agent's `forecast_capacity` tool share one pure forecasting engine
(`apps/api/src/forecasting/forecast.ts`). The engine projects weekly bench supply against contract
openings for a 1–26 week horizon (default 8): assignments ending inside the horizon become openings,
bench developers are ranked per opening by skill coverage, availability, client history, seniority,
and performance, and each opening returns up to three recommendations with `strong`, `partial`, or
`weak` confidence plus scoring reasons. Availability uses the same occupied-assignment rules as the
rest of the app, and a client filter scopes the forecast to one customer. The web `/capacity` page
renders summary cards, a weekly supply-and-demand chart, opening cards with recommendations, and
the bench pool.

## API endpoints

The full contract is generated as OpenAPI 3.1 from the controllers' Zod schemas
(`apps/api/src/openapi/openapi.document.ts`), served publicly at `/openapi.json` with an interactive
Swagger UI at `/docs`. The docs page loads only same-origin assets, so the strict helmet CSP stays
intact.

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | Public | Service greeting |
| `/health` | GET | Public | Process liveness check with uptime |
| `/ready` | GET | Public | Database readiness check |
| `/stats` | GET | API key | Dashboard counts and alert total |
| `/conversations` | GET | API key | Recent conversations with previews |
| `/conversations/:id` | GET | API key | Conversation messages |
| `/conversations/:id` | DELETE | API key | Delete a conversation |
| `/agent/chat` | POST | API key | Chat with Aya |
| `/agent/chat/stream` | POST | API key | Stream a chat reply over SSE |
| `/developers` | GET/POST | Session / API key | List or create developers |
| `/developers/:id` | GET/PATCH/DELETE | Session / API key | Read, update, or delete a developer |
| `/clients` | GET/POST | Session / API key | List or create clients |
| `/clients/:id` | GET/PATCH/DELETE | Session / API key | Read, update, or delete a client |
| `/contracts` | GET/POST | Session / API key | List or create contracts |
| `/contracts/:id` | GET/PATCH/DELETE | Session / API key | Read, update, or delete a contract |
| `/assignments` | GET/POST | Session / API key | List or create assignments |
| `/assignments/:id` | GET/PATCH/DELETE | Session / API key | Read, update, or delete an assignment |
| `/performance` | GET/POST | Session / API key | List or create performance records |
| `/performance/:id` | GET/PATCH/DELETE | Session / API key | Read, update, or delete a performance record |
| `/admin/users` | GET | Admin | List workspace users and roles |
| `/admin/users/:id/role` | PATCH | Admin | Change a workspace user's role |
| `/admin/audit-logs` | GET | Admin | Browse mutation and access audit history |
| `/alerts` | GET | Session / API key | List persisted staffing alert state |
| `/alerts/deliveries` | GET | Admin | Inspect webhook delivery attempts and failures |
| `/admin/alerts/config` | GET | Admin | Inspect effective alert rules and delivery configuration |
| `/admin/alerts/scan` | POST | Admin | Trigger an immediate, audited alert scan |
| `/notifications` | GET | Session | List the current user's notification inbox |
| `/notifications/unread-count` | GET | Session | Get the current user's unread count |
| `/notifications/:id/read` | POST | Session | Mark one notification as read |
| `/notifications/read-all` | POST | Session | Mark all notifications as read |
| `/forecast` | GET | Session / API key | Capacity forecast (`weeks`, optional `clientId`) with openings and recommendations |
| `/metrics` | GET | Metrics token | Prometheus exposition for alert operations |

### Management rules

- Skill names are canonical. `Node.js`, `node js`, and `NodeJS` are one skill, so a request that
  lists the same skill twice — even with different punctuation or spacing — is rejected with `400`.
- A partial update only touches the fields it sends. Omitting `skills` keeps the stored skills.
- `benchSince` marks the start of a developer's current bench period. It is cleared when the
  developer is assigned and set when they are released, so it always matches the assignment
  lifecycle. Setting a bench start date for a developer who holds an assignment returns `400`.
- Text filters ignore case on SQLite and PostgreSQL alike. SQLite's `LIKE` is already
  case-insensitive while PostgreSQL needs `ILIKE`, so the API builds the filter for the database in
  use.
- An expiry window only covers contracts that have already started, matching the dashboard and the
  risk alerts.
- Admins, managers, and viewers can read management resources. Only admins and managers can create,
  update, or delete staffing records. Admin-only endpoints manage roles and audit history.
- Every successful management or role mutation writes an audit event in the same database
  transaction. The workspace must retain at least one administrator.

### Request/response

```ts
// POST /agent/chat
{ message: string; conversationId?: string }

// Response
{ conversationId: string; content: string }
```

Validation rules: `message` is trimmed, non-empty, and at most 10,000 characters. Invalid bodies
return HTTP 400. Unknown conversation IDs return HTTP 404. Conversation history is bounded and
supports cursor pagination with `limit` and `before` query parameters.

`POST /agent/chat/stream` accepts the same body and returns `text/event-stream`. It emits
`conversation` (`{ id, title }`), `status` (`{ message }`), `delta` (`{ content }`), `done`
(`{ conversationId, content }`), and `error` (`{ message }`) events, plus comment heartbeats every
15 seconds. Disconnects abort the upstream LLM request. Every provider streams natively: the
OpenAI-compatible path consumes `chat/completions` SSE deltas, the Anthropic path consumes
Messages API content-block events, and the Google path consumes Gemini `streamGenerateContent`
chunks.

### Authentication and authorization

- Send `x-api-key: <key>` or `Authorization: Bearer <key>`.
- `API_KEY` is required in every environment; startup fails otherwise.
- A missing or invalid key is rejected even in development and test environments.
- `/`, `/health`, and `/ready` are public.
- `/agent/chat` and `/agent/chat/stream` are rate limited to 20 requests per minute per API client
  IP by default.
- Browser requests use credentialed CORS and Better Auth sessions; API-key authentication remains
  available for internal clients.
- Session roles are `admin`, `manager`, and `viewer`. The first account in an empty local workspace
  is the bootstrap admin. In production, only allowlisted `ADMIN_EMAILS` can self-register as
  admins; later self-service accounts are viewers until promoted.
- API keys are trusted internal clients and retain broad access without a role assignment.
- The personal notification inbox requires a signed-in user session; API-key clients receive `403`.
- `GET /metrics` uses `METRICS_TOKEN` and is disabled when no token is configured.

### Error handling

Provider errors are mapped to safe messages:

| Provider status | API response |
|-----------------|--------------|
| 401/403 | 502 — check `LLM_API_KEY` |
| 404 | 502 — check `LLM_MODEL` and `LLM_BASE_URL` |
| 429 | 429 — rate limit reached |
| Timeout | 504 — request timed out |
| Network failure | 502 — provider unreachable |

## Frontend pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with live stats, quick actions, and embedded chat |
| `/chat` | Dedicated chat interface |
| `/developers` | Roster list with search, seniority/availability filters, and CRUD |
| `/developers/[id]` | Developer profile with skills, assignments, contracts, and performance |
| `/clients` | Client list with search and CRUD |
| `/clients/[id]` | Client profile with contacts, assignments, and contracts |
| `/contracts` | Contract list with status/expiry filters and CRUD |
| `/assignments` | Assignment list with status/active filters and CRUD |
| `/performance` | Performance records with developer filter and CRUD |
| `/notifications` | Alert notification inbox with unread filtering and read state |
| `/capacity` | Capacity forecast with horizon switcher, openings, backfill recommendations, and bench pool |
| `/admin/users` | Admin-only workspace user and role management |
| `/admin/audit-logs` | Admin-only audit history browser |

The sidebar shows navigation, capability shortcuts, and recent conversation history. Chat state is
shared through `ChatProvider`, so starting a chat from the dashboard or sidebar stays consistent
across pages. Assistant replies stream token by token with tool-status feedback, older messages load
with cursor pagination, and conversations can be deleted after a confirmation. The active
conversation is remembered in `localStorage`. Management list filters (search, status, seniority,
bench, and similar) live in the URL query string, so filtered views survive reloads and can be
shared as links.

## Environment variables

### Root `.env`

```env
DATABASE_URL="file:./dev.db"
LLM_PROVIDER="opencode-zen"
LLM_API_KEY="sk-..."
LLM_BASE_URL="https://opencode.ai/zen/v1"
LLM_MODEL="minimax-m2.5-free"
LLM_TIMEOUT_MS="60000"
LLM_MAX_RETRIES="2"
LLM_MAX_TOKENS="4096"
AGENT_TIMEOUT_MS="180000"
API_PORT="3001"
API_KEY="long-random-string"
CORS_ORIGINS="http://localhost:3000"
TRUST_PROXY="false"
CHAT_DAILY_QUOTA="200"
ALERT_SCAN_INTERVAL_MS="60000"
ALERT_LEASE_SECONDS="60"
ALERT_WEBHOOK_URL=""
ALERT_WEBHOOK_SECRET=""
ALERT_WEBHOOK_TIMEOUT_MS="10000"
ALERT_WEBHOOK_MAX_ATTEMPTS="5"
METRICS_TOKEN=""
```

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

`NEXT_PUBLIC_API_URL` is the only browser-exposed value. API keys and authentication secrets remain
server-only. A production deployment must configure `CORS_ORIGINS` with the web origin, and
`DATABASE_URL` may be a PostgreSQL URL instead of a SQLite file. See
[DEPLOYMENT.md](./DEPLOYMENT.md) for the full production checklist.

## Database schema

Prisma targets SQLite for development and tests, and PostgreSQL for production. Migrations live in
`packages/db/prisma/migrations` and `packages/db/prisma/migrations-postgresql`; the selected
directory follows `DATABASE_URL`. `packages/db/prisma/schema.postgresql.prisma` is generated from
the SQLite schema and verified in CI.

- **Developer** — name, email, role, seniority, bench status, skills
- **Skill** — name, level, years of experience (unique per developer)
- **Client** — name, industry, contacts
- **Contact** — name, role, email, phone
- **Assignment** — developer, client, project, status, start/end dates
- **Contract** — developer, client, billing rate, status, start/end dates
- **Performance** — period, velocity, PR merge time, code quality, client rating (unique per
  developer and period)
- **Conversation** — title, messages, timestamps
- **Message** — role, content, optional tool-call JSON and tool-call ID
- **ChatUsage** — subject (`user:<id>` or `api-key`), UTC day, request count (unique per subject/day)
- **AuditLog** — actor, action, entity, request ID, before/after state, and timestamp
- **StaffingAlert** — stable fingerprint, type, severity, open/resolved status, entity, message, data,
  and first/last-seen timestamps
- **AlertDelivery** — lifecycle event, event-time alert snapshot, delivery status, destination, attempt
  count, next attempt, response status, error, and delivery timestamp
- **Notification** — one in-app inbox item per alert lifecycle transition
- **NotificationRead** — per-user notification read timestamp
- **WorkerLease** — named lease owner, expiry, run count, timing, and last-error state

The Better Auth **User** model also carries a workspace role. The oldest existing account is promoted
to admin by the role migration so a deployed workspace does not lose access; other existing accounts
and newly created accounts default to viewer unless an email is allowlisted through
`ADMIN_EMAILS`.

Indexes cover common filters: developer name/seniority/bench, skill name, client industry,
assignment and contract status/end dates, performance period, conversation/message ordering, audit
actor/entity lookups, and daily quota lookups.

## Seed data

The seed script is date-relative so demos stay fresh:

- 6 clients across fintech, retail, real estate, banking, and logistics
- 12 developers with 50 skills
- 11 active assignments
- 11 contracts (active, renewing, and expired examples)
- 11 performance records for the current quarter
- 1 developer on the bench for 45 days
- Contracts expiring in 5, 10, and 25 days, plus an expired contract

Business data resets on each seed. Conversations are preserved unless
`SEED_RESET_CONVERSATIONS=true`. The test-only `SEED_RESET_USERS=true` switch also clears auth
users, sessions, and audit history and must only target disposable databases. Production seeding
requires `SEED_FORCE=true`.

## Development workflow

```bash
pnpm install
cp .env.example .env
pnpm run db:push
pnpm run db:seed
pnpm run dev
```

Quality gates:

```bash
pnpm run audit
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:e2e
pnpm run test:e2e:web
pnpm run agent:eval
pnpm run worker:alerts:once
pnpm run db:drift
pnpm run db:postgres:check
pnpm run build
```

CI runs the same checks on Node.js 24 with pnpm 12.16. A separate PostgreSQL job applies the
Postgres migrations, verifies there is no schema drift, seeds the database, and runs the API e2e
suite against PostgreSQL.

## Production operations

### Chat quotas

Each `/agent/chat` or `/agent/chat/stream` call consumes one unit for `user:<id>` (session) or
`api-key` (API key) per UTC day, persisted in `ChatUsage`. Responses include
`x-chat-quota-limit`, `x-chat-quota-used`, `x-chat-quota-remaining`, and `x-chat-quota-reset`.
Over-limit calls return `429` with `retry-after`; `CHAT_DAILY_QUOTA=0` disables enforcement.

### Observability

Every response includes `x-request-id`. Callers may supply an 8–128 character safe ID; otherwise the
API generates a UUID. JSON error bodies and SSE `error` events include `requestId`. The API writes
structured JSON lines for `request.completed`, `request.aborted`, and `request.failed` to stdout,
including method, path, status, duration, and the request ID. Request bodies are never logged.

### Deployment

Production uses PostgreSQL. Set `DATABASE_URL` to the PostgreSQL connection string, apply the
committed PostgreSQL migrations with `pnpm run db:migrate:deploy`, and run the built API and web
applications as separate Node.js processes. Streaming SSE requires proxy buffering to be disabled.
See [DEPLOYMENT.md](./DEPLOYMENT.md).

## Success criteria

- [x] Agents can query the developer roster naturally
- [x] Developers matched to projects by skill
- [x] Utilization tracked from live data
- [x] Contracts monitored for renewals
- [x] Risks flagged proactively
- [x] Multi-turn conversations supported
- [x] API key kept out of browser code
- [x] Production build works on Node.js 24
- [x] PostgreSQL deployment with committed migrations
- [x] Structured request logs with end-to-end request IDs
- [x] Durable per-user daily chat quotas
- [x] Validated CRUD APIs and UI for roster, clients, contracts, assignments, and performance
- [x] Management flows covered by API e2e and browser tests
- [x] Admin, manager, and viewer roles enforced by the API
- [x] Administrative role management with at least one-admin protection
- [x] Transactional audit history for management and access changes
- [x] Deterministic agent evaluation benchmark with tool, argument, grounding, and response checks
