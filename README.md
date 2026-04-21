# Aya

AI-powered staff augmentation management agent. Aya helps managers find available developers, match skills to projects, track utilization, monitor contracts, and flag risks — all through natural language conversation.

## Architecture

```
apps/
  api/    NestJS backend — agent loop, LLM integration, Prisma ORM
  web/    Next.js 16 frontend — chat UI with markdown rendering
packages/
  db/     Shared Prisma schema and client
  ui/     shadcn/ui component library
```

## Agent Capabilities

Aya has 6 tools it can call autonomously:

| Tool | What it does |
|------|-------------|
| `query_roster` | Search developers by skills, availability, seniority, or client |
| `match_developers` | Find best-fit devs for a new project requirement |
| `get_utilization` | Team utilization metrics (active vs bench) |
| `check_contracts` | Contract status and upcoming renewals |
| `get_performance` | Developer or team performance data |
| `get_alerts` | Proactive risk alerts (bench time, expiring contracts) |

The agent loop: **user query → LLM tool calling → database query → formatted response**. Supports multi-turn conversations with context persistence.

## Tech Stack

- **Backend**: NestJS, Prisma, PostgreSQL
- **Frontend**: Next.js 16, shadcn/ui, react-markdown
- **LLM**: OpenAI-compatible API (OpenCode Zen)
- **Code quality**: Biome (linting + formatting)
- **Package manager**: Bun
- **Monorepo**: Turborepo

## Quick Start

```bash
# Install dependencies
bun install

# Generate Prisma client
cd packages/db && bunx prisma generate

# Build and run API
cd apps/api && bun run nest build && node --env-file=.env dist/main.js

# Run frontend
cd apps/web && bun run dev
```

## Environment Variables

**apps/api/.env**
```
DATABASE_URL=postgresql://...
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.example.com/v1
LLM_MODEL=model-name
```

## Scripts

```bash
bun run dev          # Start all apps in dev mode
bun run build        # Production build
bun run lint         # Check with Biome
bun run lint:fix     # Auto-fix with Biome
bun run format       # Format with Biome
bun run typecheck    # TypeScript type checking
```
