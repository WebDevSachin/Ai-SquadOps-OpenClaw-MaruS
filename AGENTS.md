# SquadOps - AI Agents Documentation

## Project Overview

SquadOps is a production-grade AI operations platform designed for orchestrating agent swarms to perform YouTube research at scale. The architecture follows a microservices-oriented design with clear separation of concerns, horizontal scalability, and enterprise-grade security.

---

## Technology Stack

### Backend

| Component | Technology | Version |
|-----------|------------|---------|
| API Framework | Express.js (Node.js) | Node 20+ |
| Database | PostgreSQL | 15+ |
| Cache/Sessions | Redis | 7+ |
| Authentication | JWT + API Keys | - |
| Password Hashing | bcrypt | - |

### Frontend

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 14+ |
| UI Library | React | 18+ |
| Styling | Tailwind CSS | 3+ |
| State | React hooks + Context | - |

### Infrastructure

| Component | Technology |
|-----------|------------|
| Cloud | AWS (CDK) |
| Containers | Docker |
| Orchestration | Kubernetes |

---

## Architecture

### High-Level Components

```
┌─────────────────────────────────────────┐
│           Frontend (Next.js)            │
│         http://localhost:3000           │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│            API (Express)                │
│         http://localhost:4000           │
│                                         │
│  - REST Endpoints                      │
│  - JWT Authentication                  │
│  - PostgreSQL + Redis                  │
└─────────────────────────────────────────┘
```

### Directory Structure

```
squadops/
├── api/                    # Express.js API server
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── middleware/    # Auth, rate limiting
│   │   ├── swarm/         # Agent swarm logic
│   │   └── utils/        # Helpers (password, redis)
│   └── package.json
│
├── dashboard/             # Next.js frontend
│   ├── app/              # App Router pages
│   ├── components/      # React components
│   ├── lib/             # API client, utilities
│   └── package.json
│
├── infra/                 # AWS CDK infrastructure
│   ├── bin/              # Stack definitions
│   └── lib/             # Constructs
│
└── agents/                # AI agent definitions
    ├── agent-name/
    │   └── SOUL.md      # Agent specification
    └── ...
```

---

## Key Conventions

### API Endpoints

- All protected endpoints require `Authorization: Bearer <token>` header
- API key authentication via `X-API-Key` header
- RESTful URL patterns: `/api/{resource}` (plural)
- Admin-only routes use `requireRole("admin")` middleware

### Authentication

- Access tokens: 24-hour expiry, `type: "access"` claim
- Refresh tokens: 7 days (30 days with rememberMe), `type: "refresh"` claim
- Password requirements: 8+ chars, uppercase, lowercase, number, special char
- Account lockout: 5 failed attempts = 30-minute lockout

### Database

- Use parameterized queries (never string interpolation)
- Always use `RETURNING` for INSERT/UPDATE
- Include `created_at` and `updated_at` timestamps
- Use soft deletes (`deleted_at`) where appropriate

### Frontend

- Use Next.js App Router with Server Components by default
- Add `"use client"` only for interactive components
- Use centralized API client from `lib/api.ts`
- Tailwind CSS for styling

---

## Development Workflow

### Running Locally

1. **Start PostgreSQL and Redis**
2. **Start API server**:
   ```bash
   cd api && npm run dev
   ```
3. **Start frontend**:
   ```bash
   cd dashboard && npm run dev
   ```

### Environment Variables

**API (.env)**:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT signing
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `PORT` - Server port (default: 4000)

**Frontend (.env.local)**:
- `NEXT_PUBLIC_API_URL` - API base URL

### API Routes

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | No | User registration |
| `/api/auth/login` | POST | No | User login |
| `/api/auth/refresh` | POST | No | Refresh token |
| `/api/auth/logout` | POST | Yes | Logout |
| `/api/auth/me` | GET | Yes | Get current user |
| `/api/tasks` | GET/POST | Yes | List/Create tasks |
| `/api/agents` | GET/POST | Yes | List/Create agents |
| `/api/workflows` | GET/POST | Yes | List/Create workflows |
| `/api/users` | GET/PATCH/DELETE | Admin | User management |

---

## Security Guidelines

1. **Never expose secrets** in client-side code
2. **Validate all inputs** on both client and server
3. **Use parameterized queries** to prevent SQL injection
4. **Implement rate limiting** on sensitive endpoints
5. **Log security events** (failed logins, privilege escalation)
6. **Rotate secrets** regularly in production
7. **Use HTTPS** in all environments

---

## Common Tasks

### Adding a New API Route

1. Create route file in `api/src/routes/`
2. Export Express Router with handlers
3. Register in `api/src/index.ts` with appropriate middleware

### Adding a New Frontend Page

1. Create page in `dashboard/app/{path}/page.tsx`
2. Add client-side auth check if protected
3. Use API client from `@/lib/api.ts`

### Adding a New Agent

1. Create agent directory in `agents/{agent-name}/`
2. Create `SOUL.md` with agent specification
3. Implement agent logic in API if needed
