# SquadOps AWS Deployment Guide

## Overview

Two deployment options available:
- **CDK Deployment** (`cdk-deployment` branch) - AWS CDK v2 with TypeScript
- **SST Deployment** (`sst-deployment` branch) - SST v3 with Pulumi

Both deploy the same infrastructure:
- VPC with 3-tier subnets (Public, Private, Database)
- RDS Aurora PostgreSQL
- ElastiCache Redis
- ECS Fargate (API, Dashboard, OpenClaw)
- Application Load Balancer
- CloudFront CDN

---

## Prerequisites

```bash
# AWS CLI configured
aws configure

# For CDK deployment
npm install -g aws-cdk

# For SST deployment  
npm install -g sst
```

---

## CDK Deployment

### 1. Switch to CDK branch
```bash
git checkout cdk-deployment
cd infra/cdk
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
# Set required env vars
export CDK_DEFAULT_ACCOUNT=your-aws-account-id
export CDK_DEFAULT_REGION=us-east-1

# Optional: Custom domain
export DOMAIN_NAME=yourdomain.com
export HOSTED_ZONE_ID=ZXXXXXXXXXXXX
```

### 4. Deploy
```bash
# Bootstrap (first time only)
npx cdk bootstrap

# Deploy all stacks
./deploy.sh dev
# or
./deploy.sh production
```

### 5. Access application
After deployment completes:
- Dashboard: `https://<cloudfront-domain>`
- API: `https://<cloudfront-domain>/api`
- OpenClaw: `https://<cloudfront-domain>/openclaw`

---

## SST Deployment

### 1. Switch to SST branch
```bash
git checkout sst-deployment
cd infra/sst
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
# Set required env vars
export AWS_PROFILE=your-profile
export DOMAIN_NAME=yourdomain.com  # optional
```

### 4. Deploy
```bash
# Deploy to dev stage
npx sst deploy

# Deploy to production
npx sst deploy --stage production
```

### 5. Access application
After deployment:
- Dashboard: `https://<cloudfront-domain>`
- API: `https://<cloudfront-domain>/api`

---

## Local Development with Swarm Mode

### Start all services locally
```bash
docker-compose up -d
```

### Access URLs
- Dashboard: http://localhost:3000
- API: http://localhost:4000
- OpenClaw: http://localhost:18789

### Login credentials
- Email: `admin@squadops.local`
- Password: `SquadOps2024!`

---

## Architecture

```
                    [CloudFront CDN]
                           |
                    [ALB (Port 80/443)]
                           |
        +------------------+------------------+
        |                  |                  |
   [Dashboard:3000]   [API:4000]    [OpenClaw:18789]
        |                  |                  |
        +------------------+------------------+
                           |
              [ECS Fargate Cluster]
                           |
        +------------------+------------------+
        |                                     |
 [RDS Aurora PostgreSQL]         [ElastiCache Redis]
```

---

## Stack Comparison

| Feature | CDK | SST |
|---------|-----|-----|
| Language | TypeScript | TypeScript |
| Provider | CloudFormation | Pulumi |
| Dev Server | No | Yes (`sst dev`) |
| Live Lambda | No | Yes |
| Console | No | Yes (SST Console) |

---

## Troubleshooting

### Build failures
```bash
# Rebuild Docker images
docker-compose build --no-cache

# Check logs
docker-compose logs -f api
docker-compose logs -f dashboard
```

### CDK issues
```bash
# Clean and rebuild
rm -rf cdk.out node_modules
npm install
npx cdk synth
```

### SST issues
```bash
# Clean and rebuild
rm -rf .sst node_modules
npm install
npx sst deploy
```

---

## Production Checklist

- [ ] Use custom domain with SSL
- [ ] Enable deletion protection on RDS
- [ ] Configure backup retention (30 days)
- [ ] Set up CloudWatch alarms
- [ ] Enable VPC Flow Logs
- [ ] Configure WAF on CloudFront
- [ ] Set up CI/CD pipeline
- [ ] Rotate database credentials
- [ ] Enable AWS Shield (DDoS protection)
