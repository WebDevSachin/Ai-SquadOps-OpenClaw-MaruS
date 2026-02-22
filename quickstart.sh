#!/bin/bash
# SquadOps Quick Start - Deploy Full Application Locally

set -e

echo "🚀 SquadOps Quick Start"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if ! docker-compose version &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose found${NC}"

# Navigate to project directory
cd "$(dirname "$0")"

echo ""
echo -e "${BLUE}Step 2: Setting up environment...${NC}"

# Generate secure passwords if not exists
if [ ! -f .env.local ]; then
    echo "Generating secure credentials..."
    
    cat > .env.local << EOF
# SquadOps Environment
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
ENCRYPTION_SECRET=$(openssl rand -base64 48)
OPENCLAW_GATEWAY_TOKEN=$(openssl rand -base64 32)
GRAFANA_PASSWORD=admin
EOF
    
    echo -e "${GREEN}✓ Environment file created (.env.local)${NC}"
fi

# Source environment
set -a
source .env.local
set +a

echo ""
echo -e "${BLUE}Step 3: Starting services...${NC}"

# Start with standard docker-compose (works on all systems)
docker-compose down --remove-orphans 2>/dev/null || true
sleep 2

docker-compose up -d

echo ""
echo -e "${BLUE}Step 4: Waiting for services to start...${NC}"

# Wait for API
for i in {1..30}; do
    if curl -s http://localhost:4000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is ready${NC}"
        break
    fi
    echo "  Waiting for API... ($i/30)"
    sleep 2
done

# Wait for Dashboard
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Dashboard is ready${NC}"
        break
    fi
    echo "  Waiting for Dashboard... ($i/30)"
    sleep 2
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}         🎉 SquadOps is Ready!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Access your application:"
echo ""
echo "  🌐 Dashboard:  http://localhost:3000"
echo "  🔌 API:        http://localhost:4000"
echo "  🤖 OpenClaw:   http://localhost:18789"
echo ""
echo "Login Credentials:"
echo "  📧 Email:    admin@squadops.local"
echo "  🔑 Password: SquadOps2024!"
echo ""
echo "Useful Commands:"
echo "  View logs:     docker-compose logs -f"
echo "  Stop:          docker-compose down"
echo "  Restart:       docker-compose restart"
echo ""
echo "═══════════════════════════════════════════════════════════"
