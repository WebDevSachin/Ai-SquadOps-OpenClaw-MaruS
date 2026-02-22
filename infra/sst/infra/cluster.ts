/**
 * ECS Cluster Infrastructure for SquadOps SST
 */
import * as aws from "@pulumi/aws";
import { vpc, privateSubnetIds, albSecurityGroup, ecsSecurityGroup } from "./vpc";

const stage = $app.stage;
const isProd = stage === "production";

// ECS Cluster
export const cluster = new aws.ecs.Cluster(`squadops-cluster-${stage}`, {
  setting: [{
    name: "containerInsights",
    value: "enabled",
  }],
  tags: {
    Name: `squadops-cluster-${stage}`,
  },
});

// CloudWatch Log Groups
export const apiLogGroup = new aws.cloudwatch.LogGroup(`squadops-api-logs-${stage}`, {
  retentionInDays: isProd ? 30 : 7,
  tags: {
    Name: `squadops-api-logs-${stage}`,
  },
});

export const dashboardLogGroup = new aws.cloudwatch.LogGroup(`squadops-dashboard-logs-${stage}`, {
  retentionInDays: isProd ? 30 : 7,
  tags: {
    Name: `squadops-dashboard-logs-${stage}`,
  },
});

export const openclawLogGroup = new aws.cloudwatch.LogGroup(`squadops-openclaw-logs-${stage}`, {
  retentionInDays: isProd ? 30 : 7,
  tags: {
    Name: `squadops-openclaw-logs-${stage}`,
  },
});

// Application Load Balancer
export const alb = new aws.lb.LoadBalancer(`squadops-alb-${stage}`, {
  loadBalancerType: "application",
  internal: false,
  securityGroups: [albSecurityGroup.id],
  subnets: privateSubnetIds, // Use private subnets but with public IPs via IGW
  enableDeletionProtection: isProd,
  idleTimeout: 60,
  tags: {
    Name: `squadops-alb-${stage}`,
  },
});

// Target Groups
export const apiTargetGroup = new aws.lb.TargetGroup(`squadops-api-tg-${stage}`, {
  port: 4000,
  protocol: "HTTP",
  targetType: "ip",
  vpcId: vpc.id,
  healthCheck: {
    path: "/health",
    port: "4000",
    healthyThreshold: 2,
    unhealthyThreshold: 3,
    timeout: 5,
    interval: 30,
    matcher: "200",
  },
});

export const dashboardTargetGroup = new aws.lb.TargetGroup(`squadops-dashboard-tg-${stage}`, {
  port: 3000,
  protocol: "HTTP",
  targetType: "ip",
  vpcId: vpc.id,
  healthCheck: {
    path: "/",
    port: "3000",
    healthyThreshold: 2,
    unhealthyThreshold: 3,
    timeout: 5,
    interval: 30,
    matcher: "200",
  },
});

export const openclawTargetGroup = new aws.lb.TargetGroup(`squadops-openclaw-tg-${stage}`, {
  port: 18789,
  protocol: "HTTP",
  targetType: "ip",
  vpcId: vpc.id,
  healthCheck: {
    path: "/",
    port: "18789",
    healthyThreshold: 2,
    unhealthyThreshold: 5,
    timeout: 10,
    interval: 30,
    matcher: "200",
  },
});

// ALB Listeners
export const httpListener = new aws.lb.Listener(`squadops-http-${stage}`, {
  loadBalancerArn: alb.arn,
  port: 80,
  protocol: "HTTP",
  defaultActions: [{
    type: "forward",
    targetGroupArn: dashboardTargetGroup.arn,
  }],
});

// Path-based routing rules
new aws.lb.ListenerRule(`squadops-api-rule-${stage}`, {
  listenerArn: httpListener.arn,
  priority: 1,
  actions: [{
    type: "forward",
    targetGroupArn: apiTargetGroup.arn,
  }],
  conditions: [{
    pathPattern: {
      values: ["/api/*", "/api"],
    },
  }],
});

new aws.lb.ListenerRule(`squadops-openclaw-rule-${stage}`, {
  listenerArn: httpListener.arn,
  priority: 2,
  actions: [{
    type: "forward",
    targetGroupArn: openclawTargetGroup.arn,
  }],
  conditions: [{
    pathPattern: {
      values: ["/openclaw/*"],
    },
  }],
});

// IAM Role for ECS Tasks
export const taskRole = new aws.iam.Role(`squadops-task-role-${stage}`, {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Action: "sts:AssumeRole",
      Effect: "Allow",
      Principal: {
        Service: "ecs-tasks.amazonaws.com",
      },
    }],
  }),
});

new aws.iam.RolePolicyAttachment(`squadops-task-role-policy-${stage}`, {
  role: taskRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

// Execution Role
export const executionRole = new aws.iam.Role(`squadops-execution-role-${stage}`, {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Action: "sts:AssumeRole",
      Effect: "Allow",
      Principal: {
        Service: "ecs-tasks.amazonaws.com",
      },
    }],
  }),
});

new aws.iam.RolePolicyAttachment(`squadops-execution-role-policy-${stage}`, {
  role: executionRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

// Outputs
export const clusterName = cluster.name;
export const albDnsName = alb.dnsName;
