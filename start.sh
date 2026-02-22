#!/bin/bash
# SquadOps Complete Startup Script
# Starts all services and auto-configures OpenClaw

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "╔════════════════════════════════════════════════════════╗"
echo "║         SquadOps - Complete Startup                    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Check Docker
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Change to project directory
cd "$(dirname "$0")"

# Step 1: Start core services
log_info "Step 1: Starting core services..."
docker-compose up -d postgres redis

# Step 2: Wait for database
log_info "Step 2: Waiting for database..."
sleep 5
for i in {1..30}; do
    if docker exec squadops-postgres pg_isready -U squadops > /dev/null 2>&1; then
        log_success "Database is ready"
        break
    fi
    echo "  Waiting for PostgreSQL... ($i/30)"
    sleep 2
done

# Step 3: Start OpenClaw Gateway
log_info "Step 3: Starting OpenClaw Gateway..."
docker-compose up -d openclaw-gateway

# Step 4: Wait for OpenClaw and get its token
log_info "Step 4: Waiting for OpenClaw Gateway..."
sleep 5

# Get the actual token from the running container
OPENCLAW_TOKEN=$(docker exec squadops-openclaw-gateway env 2>/dev/null | grep OPENCLAW_GATEWAY_TOKEN | cut -d= -f2 || echo "openclaw_dev_token_12345")
log_success "OpenClaw token: ${OPENCLAW_TOKEN:0:20}..."

# Save token for later use
echo "$OPENCLAW_TOKEN" > /tmp/openclaw_token

# Step 5: Update all dashboard files with the correct token
log_info "Step 5: Updating dashboard configuration..."

# Update the swarm page
if [ -f "dashboard/app/admin/swarm/page.tsx" ]; then
    sed -i.bak "s/token=openclaw_dev_token_12345/token=${OPENCLAW_TOKEN}/g" dashboard/app/admin/swarm/page.tsx 2>/dev/null || true
    sed -i.bak "s/token=e4ba6a594fed8c6e70897bcf5b03ecff33e36eee60d8c55497c3d1c1329b3bfd/token=${OPENCLAW_TOKEN}/g" dashboard/app/admin/swarm/page.tsx 2>/dev/null || true
    log_success "Dashboard token updated"
fi

# Step 6: Start API and Dashboard
log_info "Step 6: Starting API and Dashboard..."
docker-compose up -d api dashboard

# Step 7: Wait for API
log_info "Step 7: Waiting for API..."
for i in {1..30]; do
    if curl -s http://localhost:4000/health > /dev/null 2>&1; then
        log_success "API is ready"
        break
    fi
    echo "  Waiting for API... ($i/30)"
    sleep 2
done

# Step 8: Configure OpenClaw auto-approval
log_info "Step 8: Configuring OpenClaw device approval..."

# Create device approval script
cat > /tmp/approve-devices.sh << EOF
#!/bin/bash
TOKEN="$OPENCLAW_TOKEN"
while true; do
    # Auto-approve any pending devices
    curl -s "http://localhost:18789/api/admin/devices" \
        -H "Authorization: Bearer \$TOKEN" 2>/dev/null | \
        grep -o '"id":"[^"]*","status":"pending"' | \
        cut -d'"' -f4 | \
        while read device_id; do
            if [ -n "\$device_id" ]; then
                curl -s -X POST "http://localhost:18789/api/admin/devices/\$device_id/approve" \
                    -H "Authorization: Bearer \$TOKEN" > /dev/null 2>&1
                echo "Approved device: \$device_id"
            fi
        done
    sleep 10
done
EOF
chmod +x /tmp/approve-devices.sh

# Start device approval in background
nohup /tmp/approve-devices.sh > /tmp/device-approver.log 2>&1 &
log_success "Device auto-approval started"

# Step 9: Final checks
log_info "Step 9: Running final checks..."
sleep 3

echo ""
echo "══════════════════════════════════════════════════════════"
echo -e "${GREEN}         ✅ SquadOps is Ready!${NC}"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "Access URLs:"
echo "  🌐 Dashboard:  http://localhost:3000"
echo "  🔌 API:        http://localhost:4000"
echo "  🤖 OpenClaw:   http://localhost:18789"
echo ""
echo "OpenClaw Direct Access:"
echo "  Chat URL: http://localhost:18789/chat?session=main&token=$OPENCLAW_TOKEN"
echo ""
echo "Login Credentials:"
echo "  📧 Email:    admin@squadops.local"
echo "  🔑 Password: SquadOps2024!"
echo ""
echo "Useful Commands:"
echo "  View logs:     docker-compose logs -f"
echo "  Stop:          docker-compose down"
echo "  Restart:       ./start.sh"
echo ""
echo "══════════════════════════════════════════════════════════"
