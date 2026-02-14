# SquadOps — AI Agent Squad SaaS

**Lead agent**: MaruS (Marut/Hanuman + Sachin)

SquadOps is a multi-agent AI platform where one lead agent (MaruS) orchestrates 20 specialized sub-agents to run your business — engineering, marketing, sales, retention, support, and more.

## Quick Start (Docker PoC)

```bash
# 1. Clone and enter project
cd squadops

# 2. Copy env and fill in API keys
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY and TELEGRAM_BOT_TOKEN

# 3. Run everything
docker compose up -d

# 4. Talk to MaruS via Telegram
# Open your Telegram bot and send: "What should I do today?"
```

## Architecture

```
You (Telegram/Slack/Web)
    └── MaruS (Lead Agent)
          ├── Engineering Squad (7 agents)
          │     Forge · Canvas · Helm · Aegis · Vault · Architect · Patcher
          ├── Business Squad (10 agents)
          │     Scout · Scribe · Sentinel · Lens · Herald
          │     Oracle · Guide · Beacon · Shield · Compass
          └── Ops Squad (3 agents)
                Warden · Prism · Clerk
```

## Services

| Service   | Port | Description                         |
|-----------|------|-------------------------------------|
| OpenClaw  | 3100 | Agent gateway (MaruS + 20 agents)   |
| API       | 4000 | Backend (tasks, audit, approvals)   |
| Dashboard | 3000 | Ops Hub web UI                      |
| Postgres  | 5432 | Database                            |
| Redis     | 6379 | Cache + pub/sub                     |

## Agent Roster (21)

### Lead
- **MaruS** — Orchestrator, receives all input, delegates

### Engineering (7)
- **Forge** — Backend dev
- **Canvas** — Frontend / UI
- **Helm** — DevOps / Infra
- **Aegis** — QA / Testing
- **Vault** — DBA / Database
- **Architect** — System design
- **Patcher** — Code review / Refactor

### Business (10)
- **Scout** — Research
- **Scribe** — Content writer
- **Sentinel** — Retention
- **Lens** — SEO
- **Herald** — Outreach / Sales
- **Oracle** — Analytics
- **Guide** — Onboarding
- **Beacon** — Social media
- **Shield** — Customer support
- **Compass** — Strategy / Planning

### Ops (3)
- **Warden** — Security / Audit
- **Prism** — Design / UX
- **Clerk** — Docs / Knowledge

## Ops Hub Dashboard

Access at `http://localhost:3000` after running Docker Compose.

Features:
- Task board (all agent tasks)
- Agent activity feed
- Approval queue (for deploy, email, publish actions)
- Audit log (who did what, when)
- Goal tracking (OKR progress)
- Usage / cost tracking

## Tech Stack

- **Agent Runtime**: OpenClaw
- **LLM**: Claude Opus / Sonnet (Anthropic)
- **Dashboard**: Next.js + React + Tailwind
- **API**: Express + Prisma
- **DB**: Postgres
- **Cache**: Redis
- **Infra**: Docker Compose (dev), AWS CDK (prod)

## License

Private — All rights reserved.
