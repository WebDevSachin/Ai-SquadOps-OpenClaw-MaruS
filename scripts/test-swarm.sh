#!/usr/bin/env bash
# SquadOps — Test YouTube Research Swarm Script
# Authenticates and runs the YouTube research swarm to find 300 creators
#
# Usage: ./scripts/test-swarm.sh [options]
# Options:
#   --niches "n1,n2,n3"   Comma-separated list of niches (default: 100 niches)
#   --creators N          Max creators per niche (default: 3)
#   --email EMAIL         Login email (default: admin@squadops.local)
#   --password PASS       Login password (default: SquadOps2024!)
#   --wait                Wait for completion and display results
#   --help                Show this help message

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly MAGENTA='\033[0;35m'
readonly NC='\033[0m' # No Color
readonly BOLD='\033[1m'

# Configuration
readonly API_URL="${API_URL:-http://localhost:4000}"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
EMAIL="admin@squadops.local"
PASSWORD="SquadOps2024!"
MAX_CREATORS_PER_NICHE=3
WAIT_FOR_COMPLETION=false
SWARM_ID=""
ACCESS_TOKEN=""

# Default niches (100 diverse niches to get ~300 creators)
DEFAULT_NICHES=(
    "fitness" "yoga" "bodybuilding" "crossfit" "running"
    "cooking" "baking" "vegan" "meal prep" "bbq"
    "travel" "adventure travel" "budget travel" "luxury travel" "van life"
    "technology" "gadgets" "smartphones" "laptops" "gaming"
    "programming" "web development" "python" "javascript" "devops"
    "photography" "portrait photography" "landscape photography" "street photography" "photo editing"
    "music" "guitar" "piano" "electronic music" "music production"
    "drawing" "digital art" "watercolor" "oil painting" "character design"
    "fashion" "streetwear" "sustainable fashion" "vintage fashion" "minimalist wardrobe"
    "skincare" "makeup" "hair care" "men's grooming" "natural beauty"
    "finance" "investing" "cryptocurrency" "personal finance" "retirement planning"
    "productivity" "time management" "habit building" "morning routines" "study techniques"
    "meditation" "mindfulness" "mental health" "therapy" "self improvement"
    "parenting" "homeschooling" "toddler activities" "teen parenting" "positive discipline"
    "gardening" "indoor plants" "vegetable gardening" "flower gardening" "hydroponics"
    "diy" "woodworking" "home renovation" "interior design" "organization"
    "language learning" "spanish" "japanese" "french" "mandarin"
    "history" "ancient history" "world war 2" "mythology" "archaeology"
    "science" "physics" "chemistry" "biology" "astronomy"
    "documentary" "true crime" "conspiracy theories" "unsolved mysteries" "space exploration"
    "comedy" "standup comedy" "sketch comedy" "reaction videos" "pranks"
    "education" "online courses" "career advice" "job interviews" "resume tips"
    "sports" "basketball" "football" "soccer" "tennis" "golf"
    "outdoor" "hiking" "camping" "fishing" "hunting" "survival"
    "pets" "dog training" "cat care" "aquariums" "exotic pets"
    "cars" "car reviews" "car restoration" "electric vehicles" "motorcycles"
    "aviation" "flight training" "drone flying" "rc planes" "aircraft reviews"
    "boating" "sailing" "fishing boats" "kayaking" "paddleboarding"
    "real estate" "house flipping" "rental properties" "commercial real estate" "architecture"
    "entrepreneurship" "startups" "small business" "e-commerce" "dropshipping"
    "marketing" "social media marketing" "seo" "email marketing" "content marketing"
    "writing" "creative writing" "copywriting" "blogging" "screenwriting"
    "animation" "3d modeling" "motion graphics" "vfx" "game art"
    "filmmaking" "video editing" "cinematography" "directing" "film analysis"
    "books" "book reviews" "reading" "literary analysis" "author interviews"
    "board games" "tabletop rpg" "dungeons and dragons" "miniature painting" "strategy games"
    "collecting" "trading cards" "coins" "stamps" "vintage items"
    "magic" "card tricks" "mentalism" "illusion" "street magic"
)

NICHE_STRING=""

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_step() { echo -e "\n${CYAN}${BOLD}▶ $1${NC}"; }
log_swarm() { echo -e "${MAGENTA}[SWARM]${NC} $1"; }

# Show help
show_help() {
    cat << EOF
SquadOps YouTube Research Swarm Test Script

Usage: ./scripts/test-swarm.sh [options]

Options:
  --niches "n1,n2"      Comma-separated list of niches to research
  --creators N          Max creators per niche (default: 3)
  --email EMAIL         Login email (default: admin@squadops.local)
  --password PASS       Login password (default: SquadOps2024!)
  --wait                Wait for completion and display results
  --help                Show this help message

Examples:
  ./scripts/test-swarm.sh --wait                    # Use 100 default niches
  ./scripts/test-swarm.sh --niches "tech,fitness"   # Test specific niches
  ./scripts/test-swarm.sh --creators 5 --wait       # Get 5 creators per niche

EOF
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --niches)
                NICHE_STRING="$2"
                shift 2
                ;;
            --creators)
                MAX_CREATORS_PER_NICHE="$2"
                shift 2
                ;;
            --email)
                EMAIL="$2"
                shift 2
                ;;
            --password)
                PASSWORD="$2"
                shift 2
                ;;
            --wait)
                WAIT_FOR_COMPLETION=true
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

# Check API is reachable
check_api() {
    log_step "Checking API"
    
    if ! curl -s "$API_URL/health" &> /dev/null; then
        log_error "API is not reachable at $API_URL"
        log_info "Make sure SquadOps is running: ./scripts/setup.sh"
        exit 1
    fi
    
    log_success "API is reachable"
}

# Authenticate and get JWT token
authenticate() {
    log_step "Authenticating"
    
    log_info "Logging in as: $EMAIL"
    
    local response
    response=$(curl -s -X POST "$API_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>/dev/null) || {
        log_error "Failed to connect to authentication endpoint"
        exit 1
    }
    
    # Extract access token
    ACCESS_TOKEN=$(echo "$response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    
    if [[ -z "$ACCESS_TOKEN" ]]; then
        log_error "Authentication failed"
        log_info "Response: $response"
        exit 1
    fi
    
    log_success "Authenticated successfully"
}

# Build niches JSON array
build_niches_json() {
    local niches=()
    
    if [[ -n "$NICHE_STRING" ]]; then
        # Parse comma-separated niches
        IFS=',' read -ra niches <<< "$NICHE_STRING"
    else
        # Use default niches (100 niches)
        niches=("${DEFAULT_NICHES[@]}")
    fi
    
    # Build JSON array
    local json="["
    local first=true
    for niche in "${niches[@]}"; do
        if [[ "$first" == true ]]; then
            first=false
        else
            json+=","
        fi
        json+="\"$(echo "$niche" | xargs)\""
    done
    json+="]"
    
    echo "$json"
}

# Start YouTube research swarm
start_swarm() {
    log_step "Starting YouTube Research Swarm"
    
    local niches_json
    niches_json=$(build_niches_json)
    
    local niches_count
    niches_count=$(echo "$niches_json" | tr ',' '\n' | wc -l)
    
    log_info "Niches: $niches_count"
    log_info "Max creators per niche: $MAX_CREATORS_PER_NICHE"
    log_info "Estimated total creators: $((niches_count * MAX_CREATORS_PER_NICHE))"
    
    local response
    response=$(curl -s -X POST "$API_URL/api/swarm/youtube-research" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -d "{
            \"niches\": $niches_json,
            \"maxCreatorsPerNiche\": $MAX_CREATORS_PER_NICHE,
            \"config\": {
                \"maxConcurrent\": 20,
                \"timeoutSeconds\": 300,
                \"retryAttempts\": 2,
                \"batchSize\": 50,
                \"minSubscribers\": 10000,
                \"includeStats\": true
            }
        }" 2>/dev/null) || {
        log_error "Failed to start swarm"
        exit 1
    }
    
    # Extract swarm ID
    SWARM_ID=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [[ -z "$SWARM_ID" ]]; then
        log_error "Failed to start swarm"
        log_info "Response: $response"
        exit 1
    fi
    
    log_success "Swarm started successfully!"
    log_swarm "Swarm ID: $SWARM_ID"
    
    # Parse and display response
    local total_agents
    total_agents=$(echo "$response" | grep -o '"totalAgents":[0-9]*' | cut -d':' -f2)
    local estimated_time
    estimated_time=$(echo "$response" | grep -o '"estimatedTimeSeconds":[0-9]*' | cut -d':' -f2)
    
    echo ""
    echo -e "${BOLD}Swarm Details:${NC}"
    echo "  Total Agents: $total_agents"
    echo "  Estimated Time: ${estimated_time}s ($(($estimated_time / 60))m $(($estimated_time % 60))s)"
    echo ""
}

# Poll for swarm status
poll_swarm_status() {
    local swarm_id="$1"
    local max_attempts=60  # 5 minutes with 5s intervals
    local attempt=0
    
    log_step "Polling Swarm Status"
    log_info "Waiting for completion..."
    echo ""
    
    while [[ $attempt -lt $max_attempts ]]; do
        local response
        response=$(curl -s -X GET "$API_URL/api/swarm/$swarm_id/status" \
            -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null) || {
            log_warn "Failed to get status, retrying..."
            sleep 5
            ((attempt++))
            continue
        }
        
        # Parse status
        local status
        status=$(echo "$response" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        local total
        total=$(echo "$response" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
        
        local completed
        completed=$(echo "$response" | grep -o '"completed":[0-9]*' | head -1 | cut -d':' -f2)
        
        local failed
        failed=$(echo "$response" | grep -o '"failed":[0-9]*' | head -1 | cut -d':' -f2)
        
        local progress
        progress=$(echo "$response" | grep -o '"progress":[0-9]*' | head -1 | cut -d':' -f2)
        
        # Display progress bar
        printf "\r${CYAN}[%3d%%]${NC} Status: %-12s | Total: %3d | Completed: %3d | Failed: %3d" \
            "${progress:-0}" "$status" "${total:-0}" "${completed:-0}" "${failed:-0}"
        
        # Check if completed
        if [[ "$status" == "completed" ]]; then
            echo ""
            echo ""
            log_success "Swarm completed!"
            return 0
        fi
        
        # Check if failed/terminated
        if [[ "$status" == "terminated" || "$status" == "failed" ]]; then
            echo ""
            echo ""
            log_error "Swarm $status"
            return 1
        fi
        
        sleep 5
        ((attempt++))
    done
    
    echo ""
    echo ""
    log_warn "Polling timeout reached"
    return 1
}

# Display swarm results
display_results() {
    local swarm_id="$1"
    
    log_step "Fetching Results"
    
    local response
    response=$(curl -s -X GET "$API_URL/api/swarm/$swarm_id/results?format=compact" \
        -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null) || {
        log_error "Failed to fetch results"
        return 1
    }
    
    echo ""
    echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${GREEN}  📊 YOUTUBE RESEARCH SWARM RESULTS${NC}"
    echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Parse summary
    local total
    total=$(echo "$response" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
    local completed
    completed=$(echo "$response" | grep -o '"completed":[0-9]*' | head -1 | cut -d':' -f2)
    local failed
    failed=$(echo "$response" | grep -o '"failed":[0-9]*' | head -1 | cut -d':' -f2)
    local result_count
    result_count=$(echo "$response" | grep -o '"resultCount":[0-9]*' | cut -d':' -f2)
    
    echo -e "${BOLD}Summary:${NC}"
    echo "  Total Agents:    ${total:-0}"
    echo "  Completed:       ${completed:-0}"
    echo "  Failed:          ${failed:-0}"
    echo "  Results Found:   ${result_count:-0}"
    echo ""
    
    # Display individual results
    if [[ -n "$result_count" && "$result_count" -gt 0 ]]; then
        echo -e "${BOLD}Creators by Niche:${NC}"
        echo ""
        
        # Extract and display results
        local results_json
        results_json=$(echo "$response" | grep -o '\"results\":\[.*\]' | sed 's/"results"://' | head -1)
        
        if command -v jq &> /dev/null; then
            # Pretty print with jq if available
            echo "$response" | jq -r '.results[] | "  📌 \(.niche // .type): \(.creatorsFound // 0) creators"' 2>/dev/null || true
        else
            # Basic parsing without jq
            echo "$response" | grep -o '"niche":"[^"]*","creatorsFound":[0-9]*' | \
                sed 's/"niche":"/  📌 /g; s/","creatorsFound":/ - /g; s/$/ creators/' || true
        fi
        
        echo ""
        echo -e "${GREEN}✓ Found approximately $((result_count * MAX_CREATORS_PER_NICHE)) YouTube creators!${NC}"
        
        # Save full results to file
        local results_file="$PROJECT_ROOT/swarm-results-$swarm_id.json"
        curl -s -X GET "$API_URL/api/swarm/$swarm_id/results" \
            -H "Authorization: Bearer $ACCESS_TOKEN" > "$results_file" 2>/dev/null
        
        log_success "Full results saved to: $results_file"
    else
        log_warn "No results found"
    fi
    
    echo ""
}

# Main function
main() {
    parse_args "$@"
    
    log_info "Starting YouTube Research Swarm Test"
    log_info "API URL: $API_URL"
    
    check_api
    authenticate
    start_swarm
    
    if [[ "$WAIT_FOR_COMPLETION" == true ]]; then
        if poll_swarm_status "$SWARM_ID"; then
            display_results "$SWARM_ID"
        else
            log_warn "Swarm did not complete successfully"
            log_info "You can check status manually:"
            echo "  curl -H \"Authorization: Bearer $ACCESS_TOKEN\" \\"
            echo "    $API_URL/api/swarm/$SWARM_ID/status"
            exit 1
        fi
    else
        echo ""
        echo -e "${BOLD}To check swarm status:${NC}"
        echo "  curl -H \"Authorization: Bearer $ACCESS_TOKEN\" \\"
        echo "    $API_URL/api/swarm/$SWARM_ID/status"
        echo ""
        echo -e "${BOLD}To view results:${NC}"
        echo "  curl -H \"Authorization: Bearer $ACCESS_TOKEN\" \\"
        echo "    '$API_URL/api/swarm/$SWARM_ID/results?format=compact'"
        echo ""
        echo "Or run with --wait flag to poll for completion"
    fi
}

# Run main function
main "$@"
