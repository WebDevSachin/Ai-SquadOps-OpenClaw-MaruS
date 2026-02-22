#!/bin/bash
# SquadOps Local Production Deployment Script
# Sets up full production environment on your laptop

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         SquadOps Local Production Deployment                  ║"
echo "║              Full Stack on Your Laptop                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Initialize Docker Swarm if not already
if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
    log_info "Initializing Docker Swarm..."
    docker swarm init --advertise-addr 127.0.0.1 || true
    log_success "Docker Swarm initialized"
else
    log_info "Docker Swarm already active"
fi

# Generate SSL certificates for local HTTPS
log_info "Setting up SSL certificates..."
mkdir -p nginx/ssl
if [ ! -f nginx/ssl/localhost.crt ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/localhost.key \
        -out nginx/ssl/localhost.crt \
        -subj "/C=US/ST=Local/L=Local/O=SquadOps/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,DNS:squadops.local,IP:127.0.0.1"
    log_success "SSL certificates generated"
fi

# Create required directories
log_info "Creating required directories..."
mkdir -p monitoring/prometheus-data monitoring/grafana-data
mkdir -p logs

# Set environment variables
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(openssl rand -base64 32)}
export REDIS_PASSWORD=${REDIS_PASSWORD:-$(openssl rand -base64 32)}
export JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 64)}
export JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-$(openssl rand -base64 64)}
export ENCRYPTION_SECRET=${ENCRYPTION_SECRET:-$(openssl rand -base64 48)}
export OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN:-$(openssl rand -base64 32)}

# Save environment to .env.local
log_info "Saving environment configuration..."
cat > .env.local << EOF
# SquadOps Local Production Environment
# Generated on $(date)

# Database
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# Cache
REDIS_PASSWORD=$REDIS_PASSWORD

# Security
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
ENCRYPTION_SECRET=$ENCRYPTION_SECRET

# OpenClaw
OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN

# Monitoring
GRAFANA_PASSWORD=admin

# API Keys (add your own)
# OPENROUTER_API_KEY=your_key_here
# ANTHROPIC_API_KEY=your_key_here
EOF

log_success "Environment saved to .env.local"

# Stop existing containers
log_info "Stopping existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true
docker stack rm squadops 2>/dev/null || true

# Wait for cleanup
sleep 5

# Build images
log_info "Building Docker images..."
docker-compose -f docker-compose.prod.yml build --parallel

# Deploy with Docker Compose (recommended for local)
log_info "Deploying SquadOps stack..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
log_info "Waiting for services to start..."
sleep 10

# Health checks
log_info "Running health checks..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:4000/health > /dev/null 2>&1; then
        log_success "API is healthy"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    log_info "Waiting for API... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "API failed to start. Check logs: docker-compose -f docker-compose.prod.yml logs api"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              DEPLOYMENT COMPLETE!                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
log_success "SquadOps is running on your laptop!"
echo ""
echo "Access URLs:"
echo "  Dashboard:  http://localhost:3000"
echo "  API:        http://localhost:4000"
echo "  OpenClaw:   http://localhost:18789"
echo "  Grafana:    http://localhost:3001 (admin/admin)"
echo "  Prometheus: http://localhost:9090"
echo ""
echo "Login Credentials:"
echo "  Email:    admin@squadops.local"
echo "  Password: SquadOps2024!"
echo ""
echo "Useful Commands:"
echo "  View logs:    docker-compose -f docker-compose.prod.yml logs -f"
echo "  Scale API:    docker-compose -f docker-compose.prod.yml up -d --scale api=5"
echo "  Stop:         docker-compose -f docker-compose.prod.yml down"
echo "  Restart:      docker-compose -f docker-compose.prod.yml restart"
echo ""
log_info "Environment saved in: .env.local"
