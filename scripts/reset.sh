#!/usr/bin/env bash
# SquadOps — Reset Everything Script
# Stops all containers, removes volumes, and optionally rebuilds
#
# Usage: ./scripts/reset.sh [options]
# Options:
#   --hard          Remove all volumes (including database data)
#   --images        Also remove built images
#   --all           Hard reset + remove images
#   --yes           Skip confirmation prompts
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
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Flags
HARD_RESET=false
REMOVE_IMAGES=false
SKIP_CONFIRM=false

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${CYAN}${BOLD}▶ $1${NC}"; }

# Show help
show_help() {
    cat << EOF
SquadOps Reset Script

Usage: ./scripts/reset.sh [options]

Options:
  --hard          Remove all volumes (database data will be lost!)
  --images        Also remove built Docker images
  --all           Hard reset + remove images (full cleanup)
  --yes           Skip confirmation prompts (dangerous!)
  --help          Show this help message

Examples:
  ./scripts/reset.sh              # Soft reset (stop containers, keep data)
  ./scripts/reset.sh --hard       # Hard reset (remove volumes)
  ./scripts/reset.sh --all        # Full cleanup (volumes + images)
  ./scripts/reset.sh --all --yes  # Full cleanup without prompts

EOF
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --hard)
                HARD_RESET=true
                shift
                ;;
            --images)
                REMOVE_IMAGES=true
                shift
                ;;
            --all)
                HARD_RESET=true
                REMOVE_IMAGES=true
                shift
                ;;
            --yes|-y)
                SKIP_CONFIRM=true
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

# Detect compose command
detect_compose() {
    if docker compose version &> /dev/null; then
        readonly COMPOSE_CMD="docker compose"
    else
        readonly COMPOSE_CMD="docker-compose"
    fi
}

# Confirmation prompt
confirm() {
    local message="$1"
    if [[ "$SKIP_CONFIRM" == true ]]; then
        return 0
    fi
    
    echo -e "${YELLOW}${BOLD}⚠ $message${NC}"
    read -p "Are you sure? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Aborted by user"
        exit 0
    fi
}

# Stop containers
stop_containers() {
    log_step "Stopping Containers"
    
    cd "$PROJECT_ROOT"
    
    if $COMPOSE_CMD ps -q 2>/dev/null | grep -q .; then
        $COMPOSE_CMD down --remove-orphans
        log_success "Containers stopped"
    else
        log_info "No running containers found"
    fi
}

# Remove volumes
remove_volumes() {
    log_step "Removing Volumes"
    
    local volumes=("squadops_postgres-data" "squadops_redis-data")
    local removed=0
    
    for volume in "${volumes[@]}"; do
        if docker volume inspect "$volume" &> /dev/null; then
            docker volume rm "$volume" 2>/dev/null && {
                log_success "Removed volume: $volume"
                ((removed++))
            } || {
                log_warn "Could not remove volume: $volume (may be in use)"
            }
        fi
    done
    
    if [[ $removed -eq 0 ]]; then
        log_info "No volumes to remove"
    fi
}

# Remove images
remove_images() {
    log_step "Removing Images"
    
    local images=("squadops-api" "squadops-dashboard")
    local removed=0
    
    for image in "${images[@]}"; do
        # Find images by repository name
        local image_ids
        image_ids=$(docker images -q "$image" 2>/dev/null)
        if [[ -n "$image_ids" ]]; then
            docker rmi $image_ids 2>/dev/null && {
                log_success "Removed image: $image"
                ((removed++))
            } || {
                log_warn "Could not remove image: $image (may be in use)"
            }
        fi
    done
    
    # Also try to remove dangling images
    local dangling
    dangling=$(docker images -f "dangling=true" -q 2>/dev/null)
    if [[ -n "$dangling" ]]; then
        docker rmi $dangling 2>/dev/null || true
        log_success "Cleaned up dangling images"
    fi
    
    if [[ $removed -eq 0 ]]; then
        log_info "No images to remove"
    fi
}

# Clean up orphaned containers
cleanup_orphans() {
    log_step "Cleaning Up Orphaned Containers"
    
    # Find stopped SquadOps containers
    local orphans
    orphans=$(docker ps -a -f "name=squadops" -q 2>/dev/null)
    
    if [[ -n "$orphans" ]]; then
        docker rm $orphans 2>/dev/null || true
        log_success "Removed orphaned containers"
    else
        log_info "No orphaned containers found"
    fi
}

# Clean up networks
cleanup_networks() {
    log_step "Cleaning Up Networks"
    
    # Remove custom SquadOps network if exists
    if docker network inspect "${PROJECT_NAME}_default" &> /dev/null; then
        docker network rm "${PROJECT_NAME}_default" 2>/dev/null || true
    fi
    
    # Remove dangling networks
    docker network prune -f 2>/dev/null || true
    
    log_success "Networks cleaned up"
}

# Show status after reset
show_status() {
    echo ""
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║                                                              ║${NC}"
    echo -e "${GREEN}${BOLD}║         🧹 SquadOps Reset Complete!                          ║${NC}"
    echo -e "${GREEN}${BOLD}║                                                              ║${NC}"
    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [[ "$HARD_RESET" == true ]]; then
        echo -e "${YELLOW}Database volumes have been removed.${NC}"
        echo "All data will be re-initialized on next setup."
        echo ""
    fi
    
    if [[ "$REMOVE_IMAGES" == true ]]; then
        echo -e "${YELLOW}Docker images have been removed.${NC}"
        echo "Images will be rebuilt on next setup."
        echo ""
    fi
    
    echo -e "${BOLD}Next steps:${NC}"
    echo "  Run setup:   ./scripts/setup.sh"
    echo "  Or start:    $COMPOSE_CMD up -d"
    echo ""
}

# Main function
main() {
    parse_args "$@"
    detect_compose
    
    log_info "Starting SquadOps reset..."
    
    # Show warnings and confirmations
    if [[ "$HARD_RESET" == true && "$REMOVE_IMAGES" == true ]]; then
        confirm "This will remove ALL containers, volumes, and images!"
    elif [[ "$HARD_RESET" == true ]]; then
        confirm "This will remove containers AND database volumes (all data will be lost)!"
    elif [[ "$REMOVE_IMAGES" == true ]]; then
        confirm "This will remove containers AND Docker images!"
    else
        confirm "This will stop and remove all SquadOps containers."
    fi
    
    stop_containers
    
    if [[ "$HARD_RESET" == true ]]; then
        remove_volumes
        cleanup_orphans
        cleanup_networks
    fi
    
    if [[ "$REMOVE_IMAGES" == true ]]; then
        remove_images
    fi
    
    show_status
}

# Run main function
main "$@"
