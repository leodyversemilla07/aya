# Aya Project Specification

## Overview

**Aya** is an AI-powered staff augmentation management agent that helps managers find available
developers, match skills to projects, track utilization, monitor contracts, and flag risks through
natural language conversation.

## Project goals

1. **Staff augmentation intelligence** — AI assistant for managing developer resources
2. **Conversational interface** — natural language queries about teams and projects
3. **Data-driven decisions** — utilization metrics, contract tracking, performance data
4. **Safe deployment** — API-key auth, server-side proxy, sanitized errors, rate limiting

## Architecture

### Technology stack

| Component | Technology | Version |
|-----------|------------|---------|
| Backend | NestJS | 11 |
| Frontend | Next.js | 16 |
| Database | SQLite | 3 |
| ORM | Prisma | 6 |
| UI | shadcn/ui, Tailwind CSS | latest |
| LLM | OpenAI-compatible API | — |
| Validation | Zod | 4 |
| Package manager | Bun | 1.4 |
| Monorepo | Turborepo | 2 |
| Lint/format | Biome | 1.9 |

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
      api/aya/      Server-side proxy to the NestJS API
    components/
      chat/         ChatProvider, messages, composer, welcome
      dashboard/    Stats cards and quick actions
packages/
  db/               Prisma schema, migrations, seed data
  ui/               shadcn/ui component library
```

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

### Authentication

- Send `x-api-key: <key>` or `Authorization: Bearer <key>`.
- `API_KEY` is required in every environment; startup fails otherwise.
- A missing or invalid key is rejected even in development and test environments.
- `/`, `/health`, and `/ready` are public.
- `/agent/chat` is rate limited to 20 requests per minute per API client IP by default.
- The web proxy allowlists API routes, rejects cross-origin state changes, requires JSON for chat,
  and enforces a bounded request body.

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
| `/api/aya/[...path]` | Server-side proxy that attaches `AYA_API_KEY` |

The sidebar shows navigation, capability shortcuts, and recent conversation history. Chat state is
shared through `ChatProvider`, so starting a chat from the dashboard or sidebar stays consistent
across pages. The active conversation is remembered in `localStorage`.

## Environment variables

### API — `apps/api/.env`

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
```

### Web — `apps/web/.env`

```env
AYA_API_URL="http://localhost:3001"
AYA_API_KEY="same-value-as-apps/api/.env"
AYA_ALLOWED_ORIGINS=""
```

These values are server-only and must not use the `NEXT_PUBLIC_` prefix. A production deployment
must also provide user authentication or an identity-aware gateway in front of the web proxy.

## Database schema

SQLite via Prisma. Migrations live in `packages/db/prisma/migrations`.

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

Indexes cover common filters: developer name/seniority/bench, skill name, client industry,
assignment and contract status/end dates, performance period, and conversation/message ordering.

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
bun install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
bun run db:push
bun run db:seed
bun run dev
```

Quality gates:

```bash
bun run audit
bun run lint
bun run typecheck
bun run test
bun run test:e2e
bun run db:drift
bun run build
```

CI runs the same checks on Node.js 20 with Bun 1.4.

## Success criteria

- [x] Agents can query the developer roster naturally
- [x] Developers matched to projects by skill
- [x] Utilization tracked from live data
- [x] Contracts monitored for renewals
- [x] Risks flagged proactively
- [x] Multi-turn conversations supported
- [x] API key kept out of browser code
- [x] Production build works on Node.js 20
