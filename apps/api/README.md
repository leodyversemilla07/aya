# Aya API

NestJS 11 API for Aya, the staff augmentation management agent. It exposes the chat endpoint,
dashboard statistics, conversation history, and a health check.

## Setup

From the repository root:

```bash
bun install
cp apps/api/.env.example apps/api/.env
```

Configure `LLM_API_KEY`, `API_KEY`, and (optionally) `DATABASE_URL` in `apps/api/.env`. Then create
and seed the SQLite database:

```bash
bun run db:push
bun run db:seed
```

## Run

```bash
# development (watch mode)
bun run dev

# production
bun run build
bun run --cwd apps/api start
```

The API listens on `API_PORT` (default `3001`).

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite URL, e.g. `file:./dev.db` |
| `LLM_PROVIDER` | No | `opencode-zen` (default), `openai`, `openrouter` |
| `LLM_API_KEY` | For chat | Provider API key |
| `LLM_BASE_URL` | No | Override the provider base URL |
| `LLM_MODEL` | No | Override the provider model |
| `LLM_TIMEOUT_MS` | No | Request timeout (default 60000) |
| `LLM_MAX_RETRIES` | No | Retry count for 429/5xx/network errors (default 2) |
| `LLM_MAX_TOKENS` | No | Maximum response tokens (default 4096) |
| `AGENT_TIMEOUT_MS` | No | Total deadline for one agent turn (default 180000) |
| `API_PORT` | No | HTTP port (default 3001) |
| `API_KEY` | Yes | Shared key for `x-api-key`/Bearer auth |
| `CORS_ORIGINS` | No | Comma-separated origin allowlist |

Relative SQLite paths resolve from `packages/db/prisma`.

## Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | Public | `Hello World!` |
| `/health` | GET | Public | Service liveness and uptime |
| `/ready` | GET | Public | Database readiness |
| `/stats` | GET | API key | Dashboard counts, utilization, alert total |
| `/conversations` | GET | API key | Recent conversations with previews |
| `/conversations/:id` | GET | API key | Conversation messages |
| `/conversations/:id` | DELETE | API key | Delete a conversation |
| `/agent/chat` | POST | API key | Chat with the agent |

```bash
curl -X POST http://localhost:3001/agent/chat \
  -H 'content-type: application/json' \
  -H 'x-api-key: your-key' \
  -d '{"message":"Who is on the bench?"}'
```

`/agent/chat` accepts `{ message, conversationId? }`, validates it with Zod, and returns
`{ conversationId, content }`. Requests are rate limited to 20 per minute by default.

## Agent tools

| Tool | Description |
|------|-------------|
| `query_roster` | Filter developers by skills, availability, seniority, or client |
| `match_developers` | Rank developers for a project requirement |
| `get_utilization` | Utilization metrics and breakdowns |
| `check_contracts` | Contract status, rates, and renewals |
| `get_performance` | Performance metrics by developer, client, or period |
| `get_alerts` | Bench, contract, and performance alerts |

Tool arguments are validated with Zod. Tool results are persisted with the conversation, while
only user/assistant messages are replayed as model context.

## Tests

```bash
bun run test
bun run test:e2e
```

`bun run test:e2e` applies the committed migrations before starting the API tests. Unit tests cover
shared staffing rules, canonical skill matching, tool schemas, and provider-request cancellation.
E2E tests cover public routes, authentication, request validation, a mocked agent tool-call loop,
bounded conversation pagination, and database-backed tool behavior. No real LLM calls are made.

## Security

- Helmet security headers and `x-powered-by` disabled.
- CORS allowlist from `CORS_ORIGINS`.
- Constant-time API-key comparison.
- Global exception filter that does not leak stack traces or provider payloads.
- LLM provider errors are mapped to safe, actionable messages.
- Production startup fails if `API_KEY` is missing.
