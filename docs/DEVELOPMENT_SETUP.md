# Development Setup — Aya

## Project overview

Aya is an AI-powered staff augmentation management agent:

- **Backend**: NestJS 11 API with Prisma ORM
- **Frontend**: Next.js 16 app with shadcn/ui (Base UI primitives, `base-nova` style — components
  live in `packages/ui` and are consumed via `@workspace/ui/components/*`; add new primitives with
  `pnpm exec shadcn add <name> --yes` inside `packages/ui`)
- **LLM integration**: Shared `@workspace/ai` package supporting OpenAI-compatible providers,
  Anthropic, and Google Gemini
- **Database**: SQLite for local development and tests; PostgreSQL for production
- **Package manager**: pnpm 12.16
- **Monorepo**: Turborepo

## Prerequisites

- Node.js 24.15 or newer
- pnpm 12.16 or newer (`npm install --global corepack@latest && corepack enable pnpm`; the exact version is pinned in `package.json`)

## Quick start

### 1. Install dependencies

```bash
pnpm install
```

This installs workspace dependencies and runs `prisma generate` for `@workspace/db`.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Set `LLM_API_KEY` in `.env`. Generate an API key for internal API clients:

```bash
openssl rand -hex 32
```

### 3. Create and seed the database

```bash
pnpm run db:push
pnpm run db:seed
```

`DATABASE_URL="file:./dev.db"` creates `packages/db/prisma/dev.db`. Relative SQLite paths are
resolved from the `packages/db/prisma` directory, not from the API working directory.

### 4. Start development servers

```bash
pnpm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- API health check: http://localhost:3001/health

### 5. Production build

```bash
pnpm run build
```

The build compiles `@workspace/db` to `packages/db/dist` so the API can run on Node.js without
a TypeScript loader.

## Environment variables

### Root — `.env`

```env
DATABASE_URL="file:./dev.db"

# openai | openrouter | opencode-zen | anthropic | google | custom
LLM_PROVIDER="opencode-zen"
LLM_API_KEY="your-api-key-here"
LLM_BASE_URL="https://opencode.ai/zen/v1"
LLM_MODEL="minimax-m2.5-free"
LLM_TIMEOUT_MS="60000"
LLM_MAX_RETRIES="2"
LLM_MAX_TOKENS="4096"
LLM_CONTEXT_WINDOW="128000"
AGENT_TIMEOUT_MS="180000"

API_PORT="3001"
API_KEY="change-me-to-a-long-random-string"
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
BETTER_AUTH_SECRET="replace-with-a-random-32-byte-secret"
BETTER_AUTH_URL="http://localhost:3000"
ADMIN_EMAILS="admin@example.com"
```

- `DATABASE_URL` may be a SQLite file or a `postgresql://` URL. The matching schema and migration
  directory are selected automatically.
- `CHAT_DAILY_QUOTA` caps chat requests per user/API key per UTC day (`0` disables quotas).
- `LLM_PROVIDER`: `openai`, `openrouter`, `opencode-zen`, `anthropic`, `google`, or `custom`.
- `LLM_BASE_URL` and `LLM_MODEL` override the provider defaults.
- Provider factories are available from `@workspace/ai/providers/*` when an application needs
  more than the environment-selected provider. The API currently uses the environment-selected
  provider through the shared `Models` registry.
- `API_KEY` is required in every environment. The API refuses to start without it.
- `ADMIN_EMAILS` is a comma-separated production allowlist for administrator self-registration.
- `CORS_ORIGINS` is a comma-separated allowlist. Use explicit web origins when sending
  credentialed Better Auth requests; do not use `*` with credentials.
- `ALERT_WEBHOOK_URL` and `ALERT_WEBHOOK_SECRET` must be set together to deliver alert events.
  Leave both empty to run scans without external delivery.
- `METRICS_TOKEN` enables the token-protected Prometheus endpoint when set to at least 16 characters.

The root `.env` is loaded by the API, web build, Prisma CLI, and seed process. Only
`NEXT_PUBLIC_API_URL` is exposed to browser code; keep all secrets server-only.

## Project structure

```
apps/
  api/
    src/
      agent/        Agent controller, loop, and tools
      alerts/       Shared alert query, scanner, worker, and webhook delivery
      notifications/ Notification inbox and per-user read state
      domain/       Shared staffing and date rules
      auth/         API-key guard and public-route decorator
      llm/          OpenAI-compatible provider client
      main.ts       Bootstrap, Helmet, CORS, exception filter
  web/
    app/
      page.tsx      Dashboard (stats + chat)
      chat/         Dedicated chat page
    components/
      chat/         Shared chat provider, messages, composer, welcome
packages/
  auth/             Shared Better Auth configuration and session types
  env/              Runtime-validated server and web environment configuration
  ai/               Unified multi-provider LLM client and provider registry
  db/
    prisma/         Schema, SQLite and PostgreSQL migrations
    src/seed.ts     Demo data
  ui/               shadcn/ui component library
  typescript-config/
```

## Available scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start all apps in development mode |
| `pnpm run build` | Production build for all packages |
| `pnpm run audit` | Audit production dependencies |
| `pnpm run audit:all` | Audit all dependencies, including build tooling |
| `pnpm run lint` | Check with Biome |
| `pnpm run lint:fix` | Apply safe and unsafe Biome fixes |
| `pnpm run format` | Format with Biome |
| `pnpm run typecheck` | TypeScript type checking |
| `pnpm run test` | API unit tests (Jest) and web unit/component tests (Vitest) |
| `pnpm run test:e2e` | API end-to-end and tool integration tests |
| `pnpm run test:e2e:web` | Playwright browser tests against the production build |
| `pnpm run agent:eval` | Run deterministic agent evaluation scenarios |
| `pnpm run agent:eval:live` | Run agent evaluations against the configured LLM provider |
| `pnpm run worker:alerts` | Run the background alert worker in development |
| `pnpm run worker:alerts:once` | Run one background scan and delivery iteration |
| `pnpm run worker:alerts:prod` | Run the compiled background alert worker |
| `pnpm run worker:alerts:prod:once` | Run one compiled alert scan and delivery iteration |
| `pnpm run db:generate` | Generate the Prisma client |
| `pnpm run db:push` | Push the Prisma schema to the local database |
| `pnpm run db:migrate` | Create a development migration |
| `pnpm run db:migrate:deploy` | Apply committed migrations (SQLite or PostgreSQL) |
| `pnpm run db:drift` | Verify committed SQLite migrations match the Prisma schema |
| `pnpm run db:postgres:sync` | Regenerate the PostgreSQL schema from the SQLite schema |
| `pnpm run db:postgres:check` | Fail if the generated PostgreSQL schema is stale |
| `pnpm run db:seed` | Seed demo data |
| `pnpm run db:studio` | Open Prisma Studio |

## Testing

```bash
pnpm run test          # API unit tests (Jest) + web unit/component tests (Vitest)
pnpm run test:e2e      # API e2e tests (Jest + Supertest)
pnpm run test:e2e:web  # browser e2e tests (Playwright)
pnpm run agent:eval    # deterministic agent behavior benchmark
```

The web app uses Vitest with React Testing Library and jsdom. Component tests live in
`apps/web/tests`; Vitest is configured in `apps/web/vitest.config.ts`.

The API e2e suite uses `file:./test-e2e.db` by default
(`packages/db/prisma/test-e2e.db`). `pnpm run test:e2e` applies the committed migrations before
starting the tests, so no manual database setup is required.

`pnpm run test:e2e:web` builds the workspace, then runs Playwright against the production build.
Playwright starts both servers, seeds `packages/db/prisma/playwright.db`, and tests sign-up/sign-in,
session redirects, dashboard stats, and chat rendering with the LLM mocked. Its dedicated seed run
uses `SEED_RESET_USERS=true` to remove auth users, sessions, and audit history; never use that
switch against a shared or persistent database. Install the browser once with:

```bash
pnpm --filter web exec playwright install chromium
```

The tests do not call a real LLM. They cover public health/readiness routes, request validation,
API-key enforcement, a mocked agent tool-call loop, bounded conversation pagination, canonical
skill matching, staffing-state rules, ambiguous client names, role enforcement, administration, audit
history, durable alert lifecycle, notification read state, worker leases, signed webhook retries,
and Prometheus metrics.

`pnpm run agent:eval` creates and seeds the disposable
`packages/db/prisma/agent-eval.db` database, then runs 12 replay scenarios through the real agent
loop and database tools. It requires no provider key or network access and fails when the checked-in
baseline regresses. `pnpm run agent:eval:live` runs the same assertions against the provider in the
root `.env`; live calls can consume tokens and are not run by CI. See
[Agent evaluations](./AGENT_EVALUATIONS.md) for scenario coverage, reports, and iteration commands.

## Background alert worker

The API and worker share the same alert query service. Run one scan manually after applying
migrations:

```bash
pnpm run db:migrate:deploy
pnpm run worker:alerts:once
```

Run the continuous development worker with `pnpm run worker:alerts`. It records alert state even
when no webhook is configured, and creates notifications for the signed-in web inbox. To test
external delivery, set `ALERT_WEBHOOK_URL` and `ALERT_WEBHOOK_SECRET` together in the root `.env`.
Set `METRICS_TOKEN` to test the Prometheus endpoint. See
[Background alerts](./BACKGROUND_ALERTS.md) for rules, webhook payloads, signature verification,
inbox behavior, metrics, and deployment guidance.

## Authentication, roles, and API flow

1. The browser signs in through Better Auth at the API's `/api/auth/*` endpoint.
2. Better Auth stores users and sessions in the shared Prisma database.
3. The browser calls the NestJS API at `NEXT_PUBLIC_API_URL` with credentials included.
4. Credentialed CORS permits the configured web origin.
5. The API validates the Better Auth session and scopes conversations to the authenticated user.
6. The session role controls access: viewers are read-only, managers can mutate staffing data, and
   admins can also manage users and audit history.
7. API-key authentication remains available for trusted internal clients and automated tests.

The first account created in an empty local workspace becomes the bootstrap administrator. Later
self-service accounts are viewers until an administrator promotes them. The role migration promotes
only the oldest existing account to admin so an upgraded workspace retains bootstrap access. In
production, set `ADMIN_EMAILS` to the comma-separated addresses allowed to self-register as
administrators.

## LLM providers

| Provider | Default base URL | Default model |
|----------|------------------|---------------|
| `opencode-zen` | `https://opencode.ai/zen/v1` | `minimax-m2.5-free` |
| `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| `openrouter` | `https://openrouter.ai/api/v1` | `google/gemma-4-26b-a4b-it:free` |
| `anthropic` | `https://api.anthropic.com` | `claude-sonnet-4-5` |
| `google` | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.5-flash` |

All providers stream natively. Anthropic and Google use their own SSE dialects (Messages API
content-block events and Gemini `streamGenerateContent` chunks) instead of the OpenAI-compatible
shape. See [LLM providers](./LLM_PROVIDERS.md) for the full reference.

Provider errors are sanitized before being returned to the browser. Authentication, rate-limit,
and timeout failures produce actionable messages.

## Troubleshooting

- **`PrismaClientInitializationError` or missing tables**: run `pnpm run db:push` (or
  `pnpm run db:migrate:deploy`) and check `DATABASE_URL`.
- **Database file created in the wrong place**: relative SQLite paths resolve from
  `packages/db/prisma`. Use an absolute path or keep the file there.
- **401 from the API**: sign in through Better Auth or provide `API_KEY` to an internal API client.
- **CORS errors from the API**: set `CORS_ORIGINS` to the exact web origin and ensure the browser
  request includes credentials.
- **`LLM_API_KEY is not configured`**: add a provider key to `.env`; the API itself
  starts without it, but chat requests will return 503.
- **Background worker cannot find alert tables**: apply `pnpm run db:migrate:deploy` and confirm the
  worker and API use the same `DATABASE_URL`.
- **Webhook deliveries remain pending**: configure both `ALERT_WEBHOOK_URL` and
  `ALERT_WEBHOOK_SECRET`, then inspect `/alerts/deliveries` for the next attempt and last error.
- **`@workspace/db` fails to load under Node.js**: run `pnpm run build` so `packages/db/dist`
  exists, and start the API from the repository root or a workspace-aware context.
