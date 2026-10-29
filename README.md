# Aya

AI-powered staff augmentation management agent. Aya helps managers find available developers,
match skills to projects, track utilization, monitor contracts, and flag risks through natural
language conversation.

## Architecture

```
apps/
  api/    NestJS 11 backend — agent loop, LLM tool calling, Prisma ORM
  web/    Next.js 16 frontend — dashboard, chat UI, server-side API proxy
packages/
  db/     Shared Prisma schema, SQLite database, seed data
  ui/     shadcn/ui component library
```

The browser never talks to the API directly. Requests go through the Next.js route handler at
`/api/aya/[...path]`, which attaches the API key server-side. The key is not exposed to the client.
The proxy only exposes known API routes, rejects cross-origin state changes, requires JSON for chat,
and enforces a bounded request body. A production deployment should additionally place the web app
behind an identity-aware gateway or add application-level user authentication.

## Agent capabilities

Aya has six tools it can call autonomously:

| Tool | What it does |
|------|-------------|
| `query_roster` | Search developers by skills, availability, seniority, or client |
| `match_developers` | Rank best-fit developers for a project requirement |
| `get_utilization` | Team utilization metrics (active vs bench) |
| `check_contracts` | Contract status, billing rates, and upcoming renewals |
| `get_performance` | Developer or team performance data |
| `get_alerts` | Proactive risk alerts (bench time, expiring contracts, performance) |

The agent loop: **user query → LLM tool calling → database query → formatted response**. Tool
arguments are validated with Zod, and multi-turn conversation history is persisted in SQLite.

## Tech stack

- **Backend**: NestJS 11, Prisma 6, SQLite
- **Frontend**: Next.js 16, React 19, shadcn/ui, react-markdown
- **LLM**: OpenAI-compatible API (OpenCode Zen by default; OpenAI and OpenRouter supported)
- **Auth**: API key (`x-api-key` or Bearer) enforced by the API and attached by the web proxy
- **Code quality**: Biome (linting + formatting), Jest (unit + e2e), GitHub Actions CI
- **Package manager**: Bun 1.4
- **Monorepo**: Turborepo

## Quick start

Requires Node.js 20.9+ and Bun 1.4+.

```bash
# 1. Install dependencies (also generates the Prisma client)
bun install

# 2. Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Edit both files: set LLM_API_KEY and a shared API_KEY value.

# 3. Create and seed the SQLite database
bun run db:push
bun run db:seed

# 4. Run API (http://localhost:3001) and web (http://localhost:3000)
bun run dev
```

The SQLite file lives at `packages/db/prisma/dev.db` when `DATABASE_URL="file:./dev.db"`.
Relative SQLite paths are resolved from `packages/db/prisma`.

For a migration-based workflow instead of `db:push`:

```bash
bun run db:migrate:deploy   # apply committed migrations
bun run db:migrate          # create a migration during development
```

## Environment variables

### API — `apps/api/.env`

```env
DATABASE_URL="file:./dev.db"

# openai | openrouter | opencode-zen
LLM_PROVIDER="opencode-zen"
LLM_API_KEY="your-api-key"
LLM_BASE_URL="https://opencode.ai/zen/v1"
LLM_MODEL="minimax-m2.5-free"
LLM_TIMEOUT_MS="60000"
LLM_MAX_RETRIES="2"
LLM_MAX_TOKENS="4096"
AGENT_TIMEOUT_MS="180000"

API_PORT="3001"
API_KEY="change-me-to-a-long-random-string"
CORS_ORIGINS="http://localhost:3000"
```

`API_KEY` is required in every environment; the API refuses to start without it. The web proxy
must use the same value in `AYA_API_KEY`.

### Web — `apps/web/.env`

```env
# Server-only. Do not prefix with NEXT_PUBLIC_.
AYA_API_URL="http://localhost:3001"
AYA_API_KEY="same-value-as-apps/api/.env"
# Optional additional origins for reverse-proxy/custom deployments.
AYA_ALLOWED_ORIGINS=""
```

## API endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | Public | Service greeting (`Hello World!`) |
| `/health` | GET | Public | Process liveness check |
| `/ready` | GET | Public | Database readiness check |
| `/stats` | GET | API key | Dashboard statistics and alert count |
| `/conversations` | GET | API key | Recent conversations with previews |
| `/conversations/:id` | GET | API key | Conversation messages |
| `/conversations/:id` | DELETE | API key | Delete a conversation |
| `/agent/chat` | POST | API key | Chat with Aya |

```ts
// POST /agent/chat
{ message: string; conversationId?: string }

// Response
{ conversationId: string; content: string }
```

Send the key as `x-api-key: <key>` or `Authorization: Bearer <key>`. The `/agent/chat` route is
rate limited to 20 requests/minute per API client IP by default. When requests pass through the web
proxy, users share the proxy's IP; use an identity-aware gateway or edge limiter for per-user quotas.

Conversation history is bounded and paginated with `?limit=100&before=<message-id>`.

## Scripts

```bash
bun run dev                 # Start all apps in dev mode
bun run build               # Production build
bun run audit               # Audit production dependencies
bun run audit:all           # Audit all dependencies, including tooling
bun run lint                # Check with Biome
bun run lint:fix            # Auto-fix with Biome
bun run format              # Format with Biome
bun run typecheck           # TypeScript type checking
bun run test                # Unit and web proxy tests
bun run test:e2e            # API end-to-end and integration tests

bun run db:generate         # Generate the Prisma client
bun run db:push             # Push the schema to SQLite
bun run db:migrate          # Create a migration (development)
bun run db:migrate:deploy   # Apply committed migrations
bun run db:drift            # Verify migrations match the Prisma schema
bun run db:seed             # Seed demo data
bun run db:studio           # Open Prisma Studio
```

## Seed data

The seed script creates a deterministic demo dataset relative to today's date: 6 clients,
12 developers, 50 skills, 11 assignments, 11 contracts, and 11 performance records. Business data
is reset on every seed; conversations are preserved unless `SEED_RESET_CONVERSATIONS=true`.
Production seeding requires `SEED_FORCE=true`.

## Production notes

- Set `NODE_ENV=production` and a strong `API_KEY`.
- Put the web app behind an identity-aware gateway, or implement user sessions, before exposing it
  publicly. The server-side proxy intentionally does not turn its API key into a user identity.
- Set `CORS_ORIGINS` to the deployed web origin(s), and set `AYA_ALLOWED_ORIGINS` when a reverse
  proxy changes the browser-visible origin.
- Apply migrations with `bun run db:migrate:deploy` before starting the API.
- Build `@workspace/db` before starting the API: `bun run build` does this through Turborepo.
  The package's compiled output in `packages/db/dist` works on Node.js 20.
- The web app reads `AYA_API_URL`/`AYA_API_KEY` at request time in the server-side proxy.
- SQLite is suitable for a single API instance. Move to Postgres before scaling the API
  horizontally or running multiple replicas.
