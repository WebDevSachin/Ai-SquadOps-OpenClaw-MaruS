#!/bin/bash
set -e

# SquadOps CDK Deployment Script
# Usage: ./deploy.sh [dev|staging|production]

ENV=${1:-dev}
PROJECT_NAME="squadops"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           SquadOps CDK Deployment                          ║"
echo "║           Environment: $ENV                                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
check_prerequisites() {
    echo "→ Checking prerequisites..."
    
    if ! command -v node &> /dev/null; then
        echo "✗ Node.js is not installed"
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        echo "✗ AWS CLI is not installed"
        exit 1
    fi
    
    if ! command -v cdk &> /dev/null; then
        echo "→ Installing AWS CDK..."
        npm install -g aws-cdk
    fi
    
    echo "✓ All prerequisites met"
}

# Install dependencies
install_deps() {
    echo "→ Installing dependencies..."
    npm ci
    echo "✓ Dependencies installed"
}

# Bootstrap CDK (if needed)
bootstrap() {
    echo "→ Bootstrapping CDK..."
    npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/$(aws configure get region) \
        --tags Project=SquadOps \
        --tags Environment=$ENV
    echo "✓ CDK bootstrapped"
}

# Run CDK synth
synth() {
    echo "→ Synthesizing CloudFormation templates..."
    npx cdk synth --context env=$ENV
    echo "✓ Templates synthesized"
}

# Deploy stacks
deploy() {
    echo "→ Deploying stacks..."
    
    # Deploy in order: VPC → DB → ECS → CDN
    npx cdk deploy \
        "${PROJECT_NAME}-vpc-${ENV}" \
        "${PROJECT_NAME}-db-${ENV}" \
        "${PROJECT_NAME}-ecs-${ENV}" \
        "${PROJECT_NAME}-cdn-${ENV}" \
        --context env=$ENV \
        --require-approval never \
        --progress events \
        --tags Project=SquadOps \
        --tags Environment=$ENV
    
    echo "✓ Deployment complete"
}

# Get outputs
show_outputs() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "                    DEPLOYMENT OUTPUTS                         "
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    
    # Get CloudFront domain
    CF_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-cdn-${ENV}" \
        --query 'Stacks[0].Outputs[?OutputKey==`DistributionDomainName`].OutputValue' \
        --output text 2>/dev/null || echo "N/A")
    
    # Get ALB DNS
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-ecs-${ENV}" \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDns`].OutputValue' \
        --output text 2>/dev/null || echo "N/A")
    
    echo "CloudFront Domain: $CF_DOMAIN"
    echo "ALB DNS:           $ALB_DNS"
    echo ""
    echo "Application URLs:"
    echo "  Dashboard: https://$CF_DOMAIN"
    echo "  API:       https://$CF_DOMAIN/api"
    echo "  OpenClaw:  https://$CF_DOMAIN/openclaw"
    echo ""
}

# Main execution
main() {
    cd "$(dirname "$0")"
    
    check_prerequisites
    install_deps
    bootstrap
    synth
    deploy
    show_outputs
    
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║              DEPLOYMENT SUCCESSFUL!                        ║"
    echo "╚════════════════════════════════════════════════════════════╝"
}

main
