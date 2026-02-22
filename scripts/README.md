# SquadOps Build & Deployment Scripts

This directory contains production-ready scripts for setting up, managing, and testing SquadOps.

## Quick Start

```bash
# One-command setup (recommended)
./scripts/setup.sh

# Or use Make
make setup
```

## Scripts

### 1. `setup.sh` - One-Command Setup

Sets up the entire SquadOps development environment.

```bash
./scripts/setup.sh [options]

Options:
  --skip-build    Skip Docker build (use existing images)
  --seed-only     Only seed data, don't rebuild
  --help          Show help message
```

**What it does:**
1. Checks Docker is running
2. Creates `.env` from `.env.example`
3. Builds all containers
4. Runs database migrations
5. Seeds initial data (creates admin user)
6. Displays success message with URLs

**Default admin credentials:**
- Email: `admin@squadops.local`
- Password: `SquadOps2024!`

---

### 2. `reset.sh` - Reset Everything

Stops containers, removes volumes, and optionally rebuilds.

```bash
./scripts/reset.sh [options]

Options:
  --hard          Remove all volumes (database data will be lost!)
  --images        Also remove built Docker images
  --all           Hard reset + remove images (full cleanup)
  --yes           Skip confirmation prompts
  --help          Show help message
```

**Examples:**
```bash
./scripts/reset.sh              # Soft reset (stop containers, keep data)
./scripts/reset.sh --hard       # Remove volumes (all data lost)
./scripts/reset.sh --all        # Full cleanup (volumes + images)
./scripts/reset.sh --all --yes  # Full cleanup without prompts
```

---

### 3. `test-swarm.sh` - Test YouTube Research Swarm

Authenticates and runs the YouTube research swarm to find creators.

```bash
./scripts/test-swarm.sh [options]

Options:
  --niches "n1,n2,n3"   Comma-separated list of niches
  --creators N          Max creators per niche (default: 3)
  --email EMAIL         Login email (default: admin@squadops.local)
  --password PASS       Login password (default: SquadOps2024!)
  --wait                Wait for completion and display results
  --help                Show help message
```

**Examples:**
```bash
# Use 100 default niches (~300 creators)
./scripts/test-swarm.sh --wait

# Test specific niches
./scripts/test-swarm.sh --niches "tech,fitness,cooking" --wait

# Get 5 creators per niche
./scripts/test-swarm.sh --creators 5 --wait

# Custom credentials
./scripts/test-swarm.sh --email "user@example.com" --password "secret"
```

---

## Makefile Commands

For convenience, use the `Makefile` in the project root:

```bash
# Setup & Deployment
make setup           # Full setup (build, migrate, seed)
make dev             # Start development environment
make build           # Build all containers
make rebuild         # Rebuild and restart

# Management
make stop            # Stop all containers
make reset           # Reset containers (soft)
make reset-hard      # Reset everything including volumes
make clean           # Full cleanup (volumes + images)

# Monitoring
make logs            # View all logs
make logs-api        # View API logs
make status          # Show container status
make health          # Check API health

# Testing
make test-swarm      # Test YouTube research swarm
make test-swarm-wait # Test swarm and wait for results
make test-auth       # Test authentication

# Database
make db-shell        # Open PostgreSQL shell
make db-seed         # Run database seeding
make db-backup       # Backup database

# Utilities
make url             # Display service URLs
make prune           # Clean up Docker resources
make install-skills  # Install agent skills
```

---

## Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| `postgres` | 5432 | PostgreSQL database |
| `redis` | 6379 | Redis cache & session store |
| `api` | 4000 | Express.js backend API |
| `dashboard` | 3000 | Next.js frontend |
| `openclaw-gateway` | 18789 | AI agent gateway (optional) |

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
JWT_SECRET=your-jwt-secret-min-32-chars
ENCRYPTION_SECRET=exactly32characterslong!!

# LLM Providers (at least one recommended)
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENROUTER_API_KEY=sk-or-xxxxx

# OpenClaw Gateway (optional)
OPENCLAW_GATEWAY_TOKEN=your-gateway-token

# Database
POSTGRES_PASSWORD=squadops_dev
```

---

## Troubleshooting

### Docker not running
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

### Port conflicts
```bash
# Check what's using port 4000
lsof -i :4000

# Kill process or change port in docker-compose.yml
```

### Reset everything
```bash
make clean  # Full cleanup including volumes and images
make setup  # Start fresh
```

### Check logs
```bash
make logs-api      # API logs
make logs-db       # Database logs
docker logs -f squadops-api  # Specific container
```

---

## API Endpoints

After setup, these endpoints are available:

- **Health**: `GET http://localhost:4000/health`
- **Login**: `POST http://localhost:4000/api/auth/login`
- **Swarm Start**: `POST http://localhost:4000/api/swarm/youtube-research`
- **Swarm Status**: `GET http://localhost:4000/api/swarm/{id}/status`
- **Swarm Results**: `GET http://localhost:4000/api/swarm/{id}/results`

---

## Production Deployment

For production deployment:

1. Update `.env` with production values
2. Change `NODE_ENV=production` in docker-compose.yml
3. Use strong passwords and secrets
4. Set up SSL/TLS
5. Configure external database if needed
6. Set up monitoring and logging

```bash
# Production build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
