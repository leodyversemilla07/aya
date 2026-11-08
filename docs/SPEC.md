# Aya Project Specification

## Overview

**Aya** is an AI-powered staff augmentation management agent that helps managers find available
developers, match skills to projects, track utilization, monitor contracts, and flag risks through
natural language conversation.

## Project goals

1. **Staff augmentation intelligence** — AI assistant for managing developer resources
2. **Conversational interface** — natural language queries about teams and projects
3. **Data-driven decisions** — utilization metrics, contract tracking, performance data
4. **Safe deployment** — Better Auth sessions, API-key compatibility, sanitized errors, and rate
   limiting

## Architecture

### Technology stack

| Component | Technology | Version |
|-----------|------------|---------|
| Backend | NestJS | 11 |
| Frontend | Next.js | 16 |
| Database | SQLite (dev/test), PostgreSQL (production) | 3 / 17 |
| ORM | Prisma | 6 |
| UI | shadcn/ui, Tailwind CSS | latest |
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
      auth/         API-key guard and @Public decorator
      llm/          OpenAI-compatible provider client
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

## API endpoints

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
15 seconds. Disconnects abort the upstream LLM request; OpenAI-compatible providers stream real
tokens while Anthropic and Google emit the full reply as one `delta`.

### Authentication

- Send `x-api-key: <key>` or `Authorization: Bearer <key>`.
- `API_KEY` is required in every environment; startup fails otherwise.
- A missing or invalid key is rejected even in development and test environments.
- `/`, `/health`, and `/ready` are public.
- `/agent/chat` and `/agent/chat/stream` are rate limited to 20 requests per minute per API client
  IP by default.
- Browser requests use credentialed CORS and Better Auth sessions; API-key authentication remains
  available for internal clients.

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

The sidebar shows navigation, capability shortcuts, and recent conversation history. Chat state is
shared through `ChatProvider`, so starting a chat from the dashboard or sidebar stays consistent
across pages. Assistant replies stream token by token with tool-status feedback, older messages load
with cursor pagination, and conversations can be deleted after a confirmation. The active
conversation is remembered in `localStorage`.

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

Indexes cover common filters: developer name/seniority/bench, skill name, client industry,
assignment and contract status/end dates, performance period, conversation/message ordering, and
daily quota lookups.

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
`SEED_RESET_CONVERSATIONS=true`. Production seeding requires `SEED_FORCE=true`.

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
