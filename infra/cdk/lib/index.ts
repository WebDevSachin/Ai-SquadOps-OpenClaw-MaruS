#!/usr/bin/env node
/**
 * SquadOps CDK Deployment
 * Main entry point for AWS CDK infrastructure deployment
 */
import * as cdk from 'aws-cdk-lib';
import { getConfig, tags } from './config';
import { VpcStack } from './stacks/vpc-stack';
import { DatabaseStack } from './stacks/database-stack';
import { EcsStack } from './stacks/ecs-stack';
import { CdnStack } from './stacks/cdn-stack';

// Get environment from context or default to dev
const app = new cdk.App();
const env = app.node.tryGetContext('env') || 'dev';
const config = getConfig(env);

// AWS Environment
const awsEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Apply tags to all resources
cdk.Tags.of(app).add('Project', tags.Project);
cdk.Tags.of(app).add('ManagedBy', tags.ManagedBy);
cdk.Tags.of(app).add('Environment', config.environment);

// Stack Props
const stackProps = {
  env: awsEnv,
  terminationProtection: config.environment === 'production',
};

// ============================
// VPC Stack
// ============================
const vpcStack = new VpcStack(app, `${config.projectName}-vpc-${config.environment}`, config, {
  ...stackProps,
  description: `VPC and networking for SquadOps ${config.environment}`,
});

// ============================
// Database Stack
// ============================
const dbStack = new DatabaseStack(app, `${config.projectName}-db-${config.environment}`, config, {
  ...stackProps,
  description: `Database and cache for SquadOps ${config.environment}`,
  vpc: vpcStack.vpc,
  rdsSecurityGroup: vpcStack.rdsSecurityGroup,
  redisSecurityGroup: vpcStack.redisSecurityGroup,
});
dbStack.addDependency(vpcStack);

// ============================
// ECS Stack (API, Dashboard, OpenClaw)
// ============================
const ecsStack = new EcsStack(app, `${config.projectName}-ecs-${config.environment}`, config, {
  ...stackProps,
  description: `ECS services for SquadOps ${config.environment}`,
  vpc: vpcStack.vpc,
  albSecurityGroup: vpcStack.albSecurityGroup,
  ecsSecurityGroup: vpcStack.ecsSecurityGroup,
  dbSecret: dbStack.dbSecret,
  redisEndpoint: dbStack.redisEndpoint,
});
ecsStack.addDependency(vpcStack);
ecsStack.addDependency(dbStack);

// ============================
// CDN Stack (CloudFront)
// ============================
const cdnStack = new CdnStack(app, `${config.projectName}-cdn-${config.environment}`, config, {
  ...stackProps,
  description: `CDN and DNS for SquadOps ${config.environment}`,
  albDnsName: ecsStack.alb.loadBalancerDnsName,
  domainName: config.domainName,
  hostedZoneId: config.hostedZoneId,
});
cdnStack.addDependency(ecsStack);

// Synthesize the app
app.synth();
