# Aya Project Specification

## Overview

**Aya** is an AI-powered staff augmentation management agent that helps managers find available developers, match skills to projects, track utilization, monitor contracts, and flag risks through natural language conversation.

## Project Goals

1. **Staff Augmentation Intelligence** — AI assistant for managing developer resources
2. **Conversational Interface** — Natural language queries about team and projects
3. **Data-Driven Decisions** — Utilization metrics, contract tracking, performance data

## Architecture

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Backend | NestJS | ^10 |
| Frontend | Next.js | 16 |
| Database | PostgreSQL | 16+ |
| ORM | Prisma | ^5 |
| UI | shadcn/ui | latest |
| LLM | OpenAI-compatible | — |
| Package Manager | Bun | latest |
| Monorepo | Turborepo | latest |

### Project Structure

```
apps/
  api/         NestJS backend
    src/
      agent/   Agent controller, service, tools
      llm/    LLM integration
  web/        Next.js frontend
    app/
      page.tsx  Dashboard
      chat/    Chat page
packages/
  db/         Prisma schema and client
  ui/         shadcn/ui components
```

## Features

### Core Functionality

1. **Developer Roster Search**
   - Query by skills, availability, seniority, client
   - Filter by technology stack, experience level

2. **Talent Matching**
   - Match developers to project requirements
   - Rank by skill fit, availability, past performance

3. **Utilization Tracking**
   - Team capacity metrics
   - Active vs bench ratio

4. **Contract Management**
   - Contract status overview
   - Renewal reminders

5. **Performance Monitoring**
   - Individual and team metrics
   - Historical trends

6. **Risk Alerts**
   - Bench time warnings
   - Expiring contracts
   - Performance issues

### Agent Loop

```
User Query → LLM Reasoning → Tool Calling → Database Query → Formatted Response
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/chat` | POST | Chat with Aya agent |

### Request/Response

```typescript
// Request
{ message: string; conversationId?: string }

// Response
{ conversationId: string; content: string }
```

## Frontend Pages

| Route | Description |
|------|-------------|
| `/` | Dashboard with stats + chat |
| `/chat` | Dedicated chat interface |

## Environment Variables

### API (apps/api/.env)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/aya
LLM_API_KEY=sk-...
LLM_BASE_URL=https://opencode.ai/zen/v1
LLM_MODEL=minimax-m2.5-free
```

### Web (apps/web/.env)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Database Schema

### Models

- **Developer** — name, email, role, seniority, skills, bench status
- **Client** — name, industry, projects
- **Assignment** — developer, client, project, start/end dates
- **Contract** — developer, client, terms, renewal date
- **Conversation** — chat history
- **Message** — conversation messages with role

## Development Workflow

```bash
# Install
bun install

# Generate Prisma
cd packages/db && bunx prisma generate

# Build
bun run build

# Development
bun run dev
```

## Success Criteria

- [ ] Agents can query developer roster naturally
- [ ] Developers matched to projects by skill
- [ ] Utilization tracked in real-time
- [ ] Contracts monitored for renewals
- [ ] Risks flagged proactively
- [ ] Multi-turn conversations supported