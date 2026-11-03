# Development Setup — Aya

## Project overview

Aya is an AI-powered staff augmentation management agent:

- **Backend**: NestJS 11 API with Prisma ORM and SQLite
- **Frontend**: Next.js 16 app with shadcn/ui
- **LLM integration**: Shared `@workspace/ai` package supporting OpenAI-compatible providers,
  Anthropic, and Google Gemini
- **Database**: SQLite for local development and the demo deployment
- **Package manager**: Bun 1.4
- **Monorepo**: Turborepo

## Prerequisites

- Node.js 20.9 or newer
- Bun 1.4 or newer (`curl -fsSL https://bun.sh/install | bash`)

## Quick start

### 1. Install dependencies

```bash
bun install
```

This installs workspace dependencies and runs `prisma generate` for `@workspace/db`.

### 2. Configure environment variables

```bash
cp .env.example .env
```

Set `LLM_API_KEY` in `.env`. Generate a shared API key and use the same value for `API_KEY` and
`AYA_API_KEY`:

```bash
openssl rand -hex 32
```

### 3. Create and seed the database

```bash
bun run db:push
bun run db:seed
```

`DATABASE_URL="file:./dev.db"` creates `packages/db/prisma/dev.db`. Relative SQLite paths are
resolved from the `packages/db/prisma` directory, not from the API working directory.

### 4. Start development servers

```bash
bun run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- API health check: http://localhost:3001/health

### 5. Production build

```bash
bun run build
```

The build compiles `@workspace/db` to `packages/db/dist` so the API can run on Node.js 20 without
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
AGENT_TIMEOUT_MS="180000"

API_PORT="3001"
API_KEY="change-me-to-a-long-random-string"
CORS_ORIGINS="http://localhost:3000"
BETTER_AUTH_SECRET="replace-with-a-random-32-byte-secret"
BETTER_AUTH_URL="http://localhost:3000"
```

- `LLM_PROVIDER`: `openai`, `openrouter`, `opencode-zen`, `anthropic`, `google`, or `custom`.
- `LLM_BASE_URL` and `LLM_MODEL` override the provider defaults.
- Provider factories are available from `@workspace/ai/providers/*` when an application needs
  more than the environment-selected provider. The API currently uses the environment-selected
  provider through the shared `Models` registry.
- `API_KEY` is required in every environment. The API refuses to start without it, and the
  web proxy must use the same value in `AYA_API_KEY`.
- `CORS_ORIGINS` is a comma-separated allowlist. Use `*` only if you intentionally allow all
  origins.

The root `.env` is loaded by the API, web proxy, Prisma CLI, and seed process. These values are
server-only; never rename them to `NEXT_PUBLIC_*`.

## Project structure

```
apps/
  api/
    src/
      agent/        Agent controller, loop, and tools
      domain/       Shared staffing and date rules
      auth/         API-key guard and public-route decorator
      llm/          OpenAI-compatible provider client
      main.ts       Bootstrap, Helmet, CORS, exception filter
  web/
    app/
      page.tsx      Dashboard (stats + chat)
      chat/         Dedicated chat page
      api/aya/      Server-side API proxy
    components/
      chat/         Shared chat provider, messages, composer, welcome
packages/
  auth/             Shared Better Auth configuration and session types
  env/              Runtime-validated server and web environment configuration
  ai/               Unified multi-provider LLM client and provider registry
  db/
    prisma/         Schema, migrations, SQLite database
    src/seed.ts     Demo data
  ui/               shadcn/ui component library
  typescript-config/
```

## Available scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start all apps in development mode |
| `bun run build` | Production build for all packages |
| `bun run audit` | Audit production dependencies |
| `bun run audit:all` | Audit all dependencies, including build tooling |
| `bun run lint` | Check with Biome |
| `bun run lint:fix` | Apply safe and unsafe Biome fixes |
| `bun run format` | Format with Biome |
| `bun run typecheck` | TypeScript type checking |
| `bun run test` | API unit tests and web proxy tests |
| `bun run test:e2e` | API end-to-end and tool integration tests |
| `bun run db:generate` | Generate the Prisma client |
| `bun run db:push` | Push the Prisma schema to SQLite |
| `bun run db:migrate` | Create a development migration |
| `bun run db:migrate:deploy` | Apply committed migrations |
| `bun run db:drift` | Verify committed migrations match the Prisma schema |
| `bun run db:seed` | Seed demo data |
| `bun run db:studio` | Open Prisma Studio |

## Testing

```bash
bun run test
bun run test:e2e
```

The e2e suite uses `file:./test-e2e.db` by default
(`packages/db/prisma/test-e2e.db`). `bun run test:e2e` applies the committed migrations before
starting the tests, so no manual database setup is required.

The tests do not call a real LLM. They cover public health/readiness routes, request validation,
API-key enforcement, a mocked agent tool-call loop, bounded conversation pagination, canonical
skill matching, staffing-state rules, ambiguous client names, and the web proxy's origin, route,
content-type, response-header, and body limits.

## Authentication and proxy flow

1. The browser signs in through Better Auth at `/api/auth/*`.
2. Better Auth stores users and sessions in the shared Prisma database.
3. The browser calls `/api/aya/<path>` on the Next.js server.
4. The route handler validates the request and forwards the session cookie to NestJS.
5. The API validates the Better Auth session and scopes conversations to the authenticated user.
6. API-key authentication remains available for internal clients and automated tests.

## LLM providers

| Provider | Default base URL | Default model |
|----------|------------------|---------------|
| `opencode-zen` | `https://opencode.ai/zen/v1` | `minimax-m2.5-free` |
| `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| `openrouter` | `https://openrouter.ai/api/v1` | `google/gemma-4-26b-a4b-it:free` |

Provider errors are sanitized before being returned to the browser. Authentication, rate-limit,
and timeout failures produce actionable messages.

## Troubleshooting

- **`PrismaClientInitializationError` or missing tables**: run `bun run db:push` (or
  `bun run db:migrate:deploy`) and check `DATABASE_URL`.
- **Database file created in the wrong place**: relative SQLite paths resolve from
  `packages/db/prisma`. Use an absolute path or keep the file there.
- **401 from the API**: make sure `API_KEY` in `.env` matches `AYA_API_KEY` in
  `.env`.
- **403 from the web proxy**: the state-changing request did not come from an allowed origin. Set
  `AYA_ALLOWED_ORIGINS` to the deployed web origin when a reverse proxy changes the request origin.
- **`LLM_API_KEY is not configured`**: add a provider key to `.env`; the API itself
  starts without it, but chat requests will return 503.
- **`@workspace/db` fails to load under Node.js**: run `bun run build` so `packages/db/dist`
  exists, and start the API from the repository root or a workspace-aware context.
