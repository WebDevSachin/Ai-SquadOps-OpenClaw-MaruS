#!/usr/bin/env bash
# SquadOps — One-Command Setup Script
# Sets up the entire SquadOps development environment
#
# Usage: ./scripts/setup.sh [options]
# Options:
#   --skip-build    Skip Docker build (use existing images)
#   --seed-only     Only seed data, don't rebuild
#   --help          Show this help message

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color
readonly BOLD='\033[1m'

# Configuration
readonly PROJECT_NAME="squadops"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly ENV_FILE="$PROJECT_ROOT/.env"
readonly ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

# Flags
SKIP_BUILD=false
SEED_ONLY=false

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${CYAN}${BOLD}▶ $1${NC}"; }

# Show help
show_help() {
    cat << EOF
SquadOps Setup Script

Usage: ./scripts/setup.sh [options]

Options:
  --skip-build    Skip Docker build (use existing images)
  --seed-only     Only seed data, don't rebuild containers
  --help          Show this help message

Examples:
  ./scripts/setup.sh              # Full setup (build + seed)
  ./scripts/setup.sh --skip-build # Use existing images
  ./scripts/setup.sh --seed-only  # Just re-seed data

EOF
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --seed-only)
                SEED_ONLY=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Check if Docker is running
check_docker() {
    log_step "Checking Docker"
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        echo "Please start Docker Desktop or the Docker service"
        exit 1
    fi
    
    # Check if Docker Compose is available
    if docker compose version &> /dev/null; then
        readonly COMPOSE_CMD="docker compose"
    else
        readonly COMPOSE_CMD="docker-compose"
    fi
    
    log_success "Docker is running"
    log_info "Using: $COMPOSE_CMD"
}

# Check for OpenClaw image
check_openclaw() {
    log_step "Checking OpenClaw Gateway Image"
    
    if ! docker image inspect openclaw:local &> /dev/null; then
        log_warn "OpenClaw image 'openclaw:local' not found"
        echo ""
        echo "The OpenClaw gateway is required for AI agent functionality."
        echo "Please build it first from the OpenClaw repository:"
        echo ""
        echo "  git clone https://github.com/your-org/openclaw.git"
        echo "  cd openclaw"
        echo "  docker build -t openclaw:local ."
        echo ""
        echo "Or run without OpenClaw (some features won't work):"
        echo "  $COMPOSE_CMD up -d postgres redis api dashboard"
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_success "OpenClaw image found"
    fi
}

# Setup environment file
setup_env() {
    log_step "Setting up Environment"
    
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "$ENV_EXAMPLE" ]]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            log_success "Created .env from .env.example"
            log_warn "Please review and update the .env file with your actual values"
        else
            log_error ".env.example not found"
            exit 1
        fi
    else
        log_success ".env already exists"
    fi
    
    # Source the env file for current session
    set -a
    source "$ENV_FILE" 2>/dev/null || true
    set +a
}

# Validate environment
validate_env() {
    log_step "Validating Environment"
    
    local required_vars=("JWT_SECRET" "ENCRYPTION_SECRET")
    local missing=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing+=("$var")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        log_warn "Missing recommended environment variables:"
        printf '  - %s\n' "${missing[@]}"
    fi
    
    # Check ENCRYPTION_SECRET length (must be exactly 32 chars)
    if [[ -n "${ENCRYPTION_SECRET:-}" && ${#ENCRYPTION_SECRET} -ne 32 ]]; then
        log_warn "ENCRYPTION_SECRET should be exactly 32 characters (currently ${#ENCRYPTION_SECRET})"
    fi
    
    log_success "Environment validation complete"
}

# Build and start containers
build_containers() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_step "Starting Containers (skipping build)"
        $COMPOSE_CMD -f "$PROJECT_ROOT/docker-compose.yml" up -d
    else
        log_step "Building and Starting Containers"
        $COMPOSE_CMD -f "$PROJECT_ROOT/docker-compose.yml" up -d --build
    fi
    
    log_success "Containers started"
}

# Wait for services to be healthy
wait_for_services() {
    log_step "Waiting for Services"
    
    local max_attempts=30
    local attempt=0
    
    # Wait for Postgres
    log_info "Waiting for PostgreSQL..."
    while ! docker exec squadops-postgres pg_isready -U squadops -d squadops &> /dev/null; do
        ((attempt++))
        if [[ $attempt -ge $max_attempts ]]; then
            log_error "PostgreSQL failed to start after $max_attempts attempts"
            exit 1
        fi
        sleep 2
    done
    log_success "PostgreSQL is ready"
    
    # Wait for Redis
    attempt=0
    log_info "Waiting for Redis..."
    while ! docker exec squadops-redis redis-cli ping &> /dev/null; do
        ((attempt++))
        if [[ $attempt -ge $max_attempts ]]; then
            log_error "Redis failed to start after $max_attempts attempts"
            exit 1
        fi
        sleep 2
    done
    log_success "Redis is ready"
    
    # Wait for API
    attempt=0
    log_info "Waiting for API..."
    while ! curl -s http://localhost:4000/health &> /dev/null; do
        ((attempt++))
        if [[ $attempt -ge $max_attempts ]]; then
            log_error "API failed to start after $max_attempts attempts"
            log_info "Check logs with: $COMPOSE_CMD logs api"
            exit 1
        fi
        sleep 2
    done
    log_success "API is ready"
}

# Run database migrations
run_migrations() {
    log_step "Running Database Migrations"
    
    # The init.sql runs automatically on first startup
    # Additional migrations can be added here if needed
    
    # Run swarm schema
    if [[ -f "$PROJECT_ROOT/api/db/init-swarm.sql" ]]; then
        log_info "Applying swarm schema..."
        docker exec -i squadops-postgres psql -U squadops -d squadops < "$PROJECT_ROOT/api/db/init-swarm.sql" 2>/dev/null || {
            log_warn "Swarm schema may already be applied or error occurred"
        }
    fi
    
    log_success "Migrations complete"
}

# Seed initial data
seed_data() {
    log_step "Seeding Initial Data"
    
    # Create default admin user if not exists
    log_info "Creating default admin user..."
    
    local admin_email="admin@squadops.local"
    local admin_password="SquadOps2024!"
    local admin_name="Admin User"
    
    # Check if admin user already exists
    local existing_user
    existing_user=$(docker exec squadops-postgres psql -U squadops -d squadops -t -c "SELECT id FROM users WHERE email = '$admin_email' LIMIT 1;" 2>/dev/null | xargs)
    
    if [[ -z "$existing_user" ]]; then
        # Create admin user using the API
        local response
        response=$(curl -s -X POST http://localhost:4000/api/auth/register \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$admin_email\",\"name\":\"$admin_name\",\"password\":\"$admin_password\"}" 2>/dev/null || echo "{}")
        
        if echo "$response" | grep -q "registered successfully\|already registered"; then
            log_success "Default admin user created"
            echo "  Email: $admin_email"
            echo "  Password: $admin_password"
        else
            log_warn "Could not create admin user (may already exist)"
        fi
    else
        log_success "Admin user already exists"
    fi
    
    log_success "Seeding complete"
}

# Display success message
show_success() {
    local admin_email="admin@squadops.local"
    local admin_password="SquadOps2024!"
    
    echo ""
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║                                                              ║${NC}"
    echo -e "${GREEN}${BOLD}║         🚀 SquadOps Setup Complete!                          ║${NC}"
    echo -e "${GREEN}${BOLD}║                                                              ║${NC}"
    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Access URLs:${NC}"
    echo "  📊 Dashboard:     http://localhost:3000"
    echo "  🔌 API:           http://localhost:4000"
    echo "  📚 API Docs:      http://localhost:4000/api (explore routes)"
    echo ""
    echo -e "${BOLD}Default Login:${NC}"
    echo "  Email:    $admin_email"
    echo "  Password: $admin_password"
    echo ""
    echo -e "${BOLD}Useful Commands:${NC}"
    echo "  View logs:     $COMPOSE_CMD logs -f"
    echo "  Stop services: $COMPOSE_CMD down"
    echo "  Reset all:     ./scripts/reset.sh"
    echo "  Test swarm:    ./scripts/test-swarm.sh"
    echo ""
    echo -e "${BOLD}Services:${NC}"
    $COMPOSE_CMD -f "$PROJECT_ROOT/docker-compose.yml" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
        docker ps --filter "name=squadops" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    log_warn "Remember to change the default admin password!"
    echo ""
}

# Main function
main() {
    parse_args "$@"
    
    cd "$PROJECT_ROOT"
    
    log_info "Starting SquadOps setup..."
    
    if [[ "$SEED_ONLY" == true ]]; then
        setup_env
        seed_data
        show_success
        exit 0
    fi
    
    check_docker
    check_openclaw
    setup_env
    validate_env
    build_containers
    wait_for_services
    run_migrations
    seed_data
    show_success
}

# Run main function
main "$@"
