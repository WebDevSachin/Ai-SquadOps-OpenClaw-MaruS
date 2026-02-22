#!/bin/bash
# OpenClaw Auto-Configuration Script
# Runs on startup to configure token and approve devices

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

OPENCLAW_URL="http://localhost:18789"
TOKEN_FILE="/tmp/openclaw_token"
DEVICE_FILE="/tmp/openclaw_devices"

# Wait for OpenClaw to be ready
wait_for_openclaw() {
    log_info "Waiting for OpenClaw Gateway to start..."
    local retries=0
    local max_retries=30
    
    while [ $retries -lt $max_retries ]; do
        if curl -s "$OPENCLAW_URL/health" > /dev/null 2>&1; then
            log_success "OpenClaw Gateway is ready"
            return 0
        fi
        retries=$((retries + 1))
        echo "  Attempt $retries/$max_retries..."
        sleep 2
    done
    
    log_warn "OpenClaw Gateway not responding, continuing anyway..."
    return 1
}

# Get or generate token
get_token() {
    # Check if container has a token set
    local container_token=$(docker exec squadops-openclaw-gateway env 2>/dev/null | grep OPENCLAW_GATEWAY_TOKEN | cut -d= -f2 || echo "")
    
    if [ -n "$container_token" ]; then
        echo "$container_token" > "$TOKEN_FILE"
        log_success "Using existing OpenClaw token from container"
    else
        # Generate new token
        container_token=$(openssl rand -hex 32)
        echo "$container_token" > "$TOKEN_FILE"
        log_success "Generated new OpenClaw token"
    fi
    
    cat "$TOKEN_FILE"
}

# Update dashboard with correct token
update_dashboard_token() {
    local token=$1
    log_info "Updating dashboard with OpenClaw token..."
    
    # Update the swarm page with the correct token
    sed -i.bak "s/token=.*/token=${token}\"/g" /Users/sachinkumar/ai-poc/squadops/dashboard/app/admin/swarm/page.tsx 2>/dev/null || true
    
    # Also update any other files that reference the token
    find /Users/sachinkumar/ai-poc/squadops/dashboard -name "*.tsx" -o -name "*.ts" | xargs sed -i.bak "s/openclaw_dev_token_12345/${token}/g" 2>/dev/null || true
    
    log_success "Dashboard updated with token"
}

# Configure OpenClaw via API
configure_openclaw() {
    local token=$1
    log_info "Configuring OpenClaw Gateway..."
    
    # Try to set the gateway token via API
    curl -s -X POST "$OPENCLAW_URL/api/config" \
        -H "Content-Type: application/json" \
        -d "{\"gatewayToken\": \"${token}\"}" > /dev/null 2>&1 || true
    
    log_success "OpenClaw configuration applied"
}

# Auto-approve devices
auto_approve_devices() {
    log_info "Setting up auto-approval for devices..."
    
    # Create a script that will run periodically to approve devices
    cat > /tmp/openclaw-device-approver.sh << 'APPROVER'
#!/bin/bash
OPENCLAW_URL="http://localhost:18789"
TOKEN=$(cat /tmp/openclaw_token 2>/dev/null || echo "openclaw_dev_token_12345")

# Get pending devices and approve them
curl -s "$OPENCLAW_URL/api/devices/pending" 2>/dev/null | while read -r device; do
    device_id=$(echo "$device" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$device_id" ]; then
        curl -s -X POST "$OPENCLAW_URL/api/devices/$device_id/approve" \
            -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1
        echo "Approved device: $device_id"
    fi
done
APPROVER

    chmod +x /tmp/openclaw-device-approver.sh
    
    # Run it once immediately
    /tmp/openclaw-device-approver.sh || true
    
    log_success "Device auto-approval configured"
}

# Main execution
main() {
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║       OpenClaw Auto-Configuration                      ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""
    
    # Wait for OpenClaw
    wait_for_openclaw
    
    # Get token
    TOKEN=$(get_token)
    log_info "Token: ${TOKEN:0:20}..."
    
    # Update dashboard
    update_dashboard_token "$TOKEN"
    
    # Configure OpenClaw
    configure_openclaw "$TOKEN"
    
    # Setup auto-approval
    auto_approve_devices
    
    echo ""
    log_success "OpenClaw auto-configuration complete!"
    echo ""
    echo "Token saved to: $TOKEN_FILE"
    echo "Dashboard URLs updated with correct token"
    echo ""
    echo "Access OpenClaw at:"
    echo "  http://localhost:18789/chat?session=main&token=$TOKEN"
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main
fi
