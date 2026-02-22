# SquadOps Makefile
# Simple commands for managing the SquadOps development environment

.PHONY: help setup dev reset logs test-swarm test-swarm-wait status stop build clean

# Default target
.DEFAULT_GOAL := help

# Colors
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo ""
	@echo "$(GREEN)╔══════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║                   SquadOps Commands                          ║$(NC)"
	@echo "$(GREEN)╚══════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(BLUE)Setup & Deployment:$(NC)"
	@echo "  $(GREEN)make setup$(NC)        - Full setup (build, migrate, seed)"
	@echo "  $(GREEN)make dev$(NC)          - Start development environment"
	@echo "  $(GREEN)make build$(NC)        - Build all containers"
	@echo ""
	@echo "$(BLUE)Management:$(NC)"
	@echo "  $(GREEN)make stop$(NC)         - Stop all containers"
	@echo "  $(GREEN)make reset$(NC)        - Reset containers (soft)"
	@echo "  $(GREEN)make reset-hard$(NC)   - Reset everything including volumes"
	@echo "  $(GREEN)make clean$(NC)        - Full cleanup (volumes + images)"
	@echo ""
	@echo "$(BLUE)Monitoring:$(NC)"
	@echo "  $(GREEN)make logs$(NC)         - View all logs"
	@echo "  $(GREEN)make logs-api$(NC)     - View API logs"
	@echo "  $(GREEN)make status$(NC)       - Show container status"
	@echo ""
	@echo "$(BLUE)Testing:$(NC)"
	@echo "  $(GREEN)make test-swarm$(NC)   - Test YouTube research swarm"
	@echo "  $(GREEN)make test-swarm-wait$(NC) - Test swarm and wait for results"
	@echo "  $(GREEN)make health$(NC)       - Check API health"
	@echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Setup & Deployment
# ─────────────────────────────────────────────────────────────────────────────

setup: ## One-command setup: check Docker, create .env, build, migrate, seed
	@echo "$(BLUE)▶ Running SquadOps setup...$(NC)"
	@./scripts/setup.sh

dev: ## Start development environment (docker compose up)
	@echo "$(BLUE)▶ Starting development environment...$(NC)"
	@docker compose up -d
	@echo "$(GREEN)✓ Services started!$(NC)"
	@echo "  Dashboard: http://localhost:3000"
	@echo "  API:       http://localhost:4000"

build: ## Build all containers
	@echo "$(BLUE)▶ Building containers...$(NC)"
	@docker compose build

rebuild: ## Rebuild and restart all containers
	@echo "$(BLUE)▶ Rebuilding containers...$(NC)"
	@docker compose up -d --build

# ─────────────────────────────────────────────────────────────────────────────
# Management
# ─────────────────────────────────────────────────────────────────────────────

stop: ## Stop all containers
	@echo "$(BLUE)▶ Stopping containers...$(NC)"
	@docker compose down
	@echo "$(GREEN)✓ Containers stopped$(NC)"

reset: ## Reset containers (soft - keeps data)
	@echo "$(BLUE)▶ Resetting containers...$(NC)"
	@./scripts/reset.sh

reset-hard: ## Reset everything including database volumes
	@echo "$(YELLOW)⚠ This will delete all data!$(NC)"
	@read -p "Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || exit 1
	@./scripts/reset.sh --hard

clean: ## Full cleanup (volumes + images)
	@echo "$(YELLOW)⚠ This will delete all data and images!$(NC)"
	@read -p "Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || exit 1
	@./scripts/reset.sh --all --yes

# ─────────────────────────────────────────────────────────────────────────────
# Monitoring
# ─────────────────────────────────────────────────────────────────────────────

logs: ## View all logs
	@docker compose logs -f

logs-api: ## View API logs
	@docker compose logs -f api

logs-db: ## View database logs
	@docker compose logs -f postgres

status: ## Show container status
	@echo "$(BLUE)▶ Container Status:$(NC)"
	@docker compose ps

health: ## Check API health
	@echo "$(BLUE)▶ Checking API health...$(NC)"
	@curl -s http://localhost:4000/health | jq . 2>/dev/null || curl -s http://localhost:4000/health

# ─────────────────────────────────────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────────────────────────────────────

test-swarm: ## Test YouTube research swarm (starts and returns immediately)
	@echo "$(BLUE)▶ Starting YouTube Research Swarm...$(NC)"
	@./scripts/test-swarm.sh

test-swarm-wait: ## Test swarm and wait for completion with results
	@echo "$(BLUE)▶ Starting YouTube Research Swarm (waiting for completion)...$(NC)"
	@./scripts/test-swarm.sh --wait

test-auth: ## Test authentication
	@echo "$(BLUE)▶ Testing authentication...$(NC)"
	@curl -s -X POST http://localhost:4000/api/auth/login \
		-H "Content-Type: application/json" \
		-d '{"email":"admin@squadops.local","password":"SquadOps2024!"}' | jq . 2>/dev/null || echo "Run setup first!"

# ─────────────────────────────────────────────────────────────────────────────
# Database Operations
# ─────────────────────────────────────────────────────────────────────────────

db-shell: ## Open PostgreSQL shell
	@docker exec -it squadops-postgres psql -U squadops -d squadops

db-seed: ## Run database seeding only
	@echo "$(BLUE)▶ Seeding database...$(NC)"
	@./scripts/setup.sh --seed-only

db-backup: ## Backup database to file
	@echo "$(BLUE)▶ Backing up database...$(NC)"
	@mkdir -p backups
	@docker exec squadops-postgres pg_dump -U squadops squadops > backups/squadops_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Backup complete$(NC)"

# ─────────────────────────────────────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────────────────────────────────────

prune: ## Clean up unused Docker resources
	@echo "$(BLUE)▶ Pruning unused Docker resources...$(NC)"
	@docker system prune -f
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

install-skills: ## Install agent skills
	@echo "$(BLUE)▶ Installing agent skills...$(NC)"
	@./scripts/install-skills.sh

url: ## Display service URLs
	@echo ""
	@echo "$(GREEN)╔══════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║                   SquadOps URLs                              ║$(NC)"
	@echo "$(GREEN)╚══════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(BLUE)Services:$(NC)"
	@echo "  Dashboard:    http://localhost:3000"
	@echo "  API:          http://localhost:4000"
	@echo "  API Health:   http://localhost:4000/health"
	@echo ""
	@echo "$(BLUE)Default Login:$(NC)"
	@echo "  Email:    admin@squadops.local"
	@echo "  Password: SquadOps2024!"
	@echo ""
