# Development Setup - Aya

## Project Overview
Aya is an AI-powered staff augmentation management agent with:
- **Backend**: NestJS API with Prisma ORM & PostgreSQL
- **Frontend**: Next.js 16 web application with shadcn/ui
- **LLM Integration**: OpenAI-compatible API (OpenCode Zen, OpenAI, OpenRouter)
- **Package Manager**: Bun
- **Monorepo**: Turborepo

## Quick Start

### 1. Install Dependencies
```bash
bun install
```

### 2. Generate Prisma Client
```bash
bun run packages/db:generate
```

### 3. Development Mode
```bash
bun run dev
```

### 4. Production Build
```bash
bun run build
```

### 5. Type Checking
```bash
bun run typecheck
```

## Environment Variables

### API (apps/api/.env)
```
DATABASE_URL="file:./dev.db"
LLM_API_KEY="your-api-key-here"
LLM_BASE_URL="https://api.example.com/v1"
LLM_MODEL="model-name"
API_PORT="3001"
```

### Web (apps/web/.env.example)
```
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WEBSITE_URL="http://localhost:3000"
```

### Database (packages/db/.env)
```
DATABASE_URL="file:./dev.db"
```

## Project Structure
```
apps/
  api/    # NestJS backend - agent loop, LLM integration
  web/    # Next.js 16 frontend - chat UI
packages/
  db/     # Shared Prisma schema & client
  ui/     # shadcn/ui component library
  eslint-config/
  typescript-config/
```

## Available Scripts
- `bun run dev` - Start all apps in dev mode
- `bun run build` - Production build
- `bun run lint` - Check with Biome
- `bun run lint:fix` - Auto-fix with Biome
- `bun run format` - Format with Biome
- `bun run typecheck` - TypeScript type checking

## LLM Providers Supported
- OpenAI
- OpenRouter
- OpenCode Zen (default)

## Agent Capabilities
- query_roster: Search developers by skills
- match_developers: Find best-fit devs for requirements
- get_utilization: Team utilization metrics
- check_contracts: Contract status & renewals
- get_performance: Developer/team performance data
- get_alerts: Proactive risk alerts