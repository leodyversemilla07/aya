# Development Setup — Aya

## Project overview

Aya is an AI-powered staff augmentation management agent:

- **Backend**: NestJS 11 API with Prisma ORM and SQLite
- **Frontend**: Next.js 16 app with shadcn/ui
- **LLM integration**: OpenAI-compatible API (OpenCode Zen, OpenAI, OpenRouter)
- **Database**: SQLite for local development and the demo deployment
- **Package manager**: Bun 1.3
- **Monorepo**: Turborepo

## Prerequisites

- Node.js 20 or newer
- Bun 1.3 or newer (`curl -fsSL https://bun.sh/install | bash`)

## Quick start

### 1. Install dependencies

```bash
bun install
```

This installs workspace dependencies and runs `prisma generate` for `@workspace/db`.

### 2. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Set `LLM_API_KEY` in `apps/api/.env`. Generate a shared API key and use the same value in both
files:

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

### API — `apps/api/.env`

```env
DATABASE_URL="file:./dev.db"

LLM_PROVIDER="opencode-zen"
LLM_API_KEY="your-api-key-here"
LLM_BASE_URL="https://opencode.ai/zen/v1"
LLM_MODEL="minimax-m2.5-free"
LLM_TIMEOUT_MS="60000"
LLM_MAX_RETRIES="2"
LLM_MAX_TOKENS="4096"

API_PORT="3001"
API_KEY="change-me-to-a-long-random-string"
CORS_ORIGINS="http://localhost:3000"
```

- `LLM_PROVIDER`: `openai`, `openrouter`, or `opencode-zen` (default).
- `LLM_BASE_URL` and `LLM_MODEL` override the provider defaults.
- `API_KEY` is required in production. In development, leaving it empty disables API-key auth and
  logs a warning.
- `CORS_ORIGINS` is a comma-separated allowlist. Use `*` only if you intentionally allow all
  origins.

### Web — `apps/web/.env`

```env
AYA_API_URL="http://localhost:3001"
AYA_API_KEY="same-value-as-apps/api/.env"
```

These are server-only. Never rename them to `NEXT_PUBLIC_*`, or the API key will be bundled into
client JavaScript. The Next.js proxy at `app/api/aya/[...path]/route.ts` attaches the key.

### Database — `packages/db/.env` (optional)

```env
DATABASE_URL="file:./dev.db"
```

Prisma CLI commands load `packages/db/.env` first; the API loads `apps/api/.env`. Keep the
`DATABASE_URL` values pointing at the same file if you run CLI commands and the API separately.

## Project structure

```
apps/
  api/
    src/
      agent/        Agent controller, loop, and tools
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
| `bun run lint` | Check with Biome |
| `bun run lint:fix` | Apply safe and unsafe Biome fixes |
| `bun run format` | Format with Biome |
| `bun run typecheck` | TypeScript type checking |
| `bun run test` | API unit tests |
| `bun run test:e2e` | API end-to-end tests |
| `bun run db:generate` | Generate the Prisma client |
| `bun run db:push` | Push the Prisma schema to SQLite |
| `bun run db:migrate` | Create a development migration |
| `bun run db:migrate:deploy` | Apply committed migrations |
| `bun run db:seed` | Seed demo data |
| `bun run db:studio` | Open Prisma Studio |

## Testing

```bash
bun run test
bun run test:e2e
```

The e2e suite uses `file:./test-e2e.db` by default (`packages/db/prisma/test-e2e.db`).
Create it first:

```bash
DATABASE_URL="file:./test-e2e.db" bun run --cwd packages/db push
bun run test:e2e
```

The tests do not call a real LLM. They cover public health routes, request validation, and the API
key guard setup.

## Authentication and proxy flow

1. The browser calls `/api/aya/<path>` on the Next.js server.
2. The route handler reads `AYA_API_URL` and `AYA_API_KEY` from the server environment.
3. It forwards the request to the NestJS API with `x-api-key` attached.
4. The API validates the key with `ApiKeyGuard` (constant-time comparison).
5. `/` and `/health` are marked `@Public()`; all other routes require the key.

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
- **401 from the API**: make sure `API_KEY` in `apps/api/.env` matches `AYA_API_KEY` in
  `apps/web/.env`.
- **`LLM_API_KEY is not configured`**: add a provider key to `apps/api/.env`; the API itself
  starts without it, but chat requests will return 503.
- **`@workspace/db` fails to load under Node.js**: run `bun run build` so `packages/db/dist`
  exists, and start the API from the repository root or a workspace-aware context.
