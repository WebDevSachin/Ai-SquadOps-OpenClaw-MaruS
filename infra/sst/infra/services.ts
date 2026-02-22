/**
 * ECS Services for SquadOps SST
 * API, Dashboard, and OpenClaw services
 */
import * as aws from "@pulumi/aws";
import {
  cluster,
  taskRole,
  executionRole,
  ecsSecurityGroup,
  privateSubnetIds,
  apiTargetGroup,
  dashboardTargetGroup,
  openclawTargetGroup,
  apiLogGroup,
  dashboardLogGroup,
  openclawLogGroup,
} from "./cluster";
import { database, redis, dbSecret } from "./database";

const stage = $app.stage;
const isProd = stage === "production";

// Get secret values
const dbCreds = dbSecret.secretString.apply((s) => JSON.parse(s || "{}"));

// Common environment variables
const commonEnv = [
  { name: "NODE_ENV", value: stage },
  { name: "DATABASE_URL", value: database.endpoint.apply((e) => `postgresql://squadops:${dbCreds.password}@${e}:5432/squadops`) },
  { name: "REDIS_URL", value: redis.primaryEndpointAddress.apply((h) => `redis://${h}:6379`) },
];

// ===== API Task Definition =====
const apiTaskDef = new aws.ecs.TaskDefinition(`squadops-api-task-${stage}`, {
  family: `squadops-api-${stage}`,
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  cpu: isProd ? "1024" : "512",
  memory: isProd ? "2048" : "1024",
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  runtimePlatform: {
    cpuArchitecture: "ARM64",
    operatingSystemFamily: "LINUX",
  },
  containerDefinitions: JSON.stringify([
    {
      name: "api",
      image: "squadops/api:latest", // Will be updated by CI/CD
      portMappings: [{ containerPort: 4000, protocol: "tcp" }],
      environment: [
        ...commonEnv,
        { name: "PORT", value: "4000" },
        { name: "CORS_ORIGIN", value: "*" },
        { name: "OPENCLAW_GATEWAY_URL", value: "http://localhost:18789" },
      ],
      secrets: [
        { name: "JWT_SECRET", valueFrom: dbSecret.arn },
        { name: "JWT_REFRESH_SECRET", valueFrom: dbSecret.arn },
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": apiLogGroup.name,
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "api",
        },
      },
      healthCheck: {
        command: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:4000/health || exit 1"],
        interval: 30,
        timeout: 5,
        retries: 3,
        startPeriod: 60,
      },
    },
  ]),
});

// ===== Dashboard Task Definition =====
const dashboardTaskDef = new aws.ecs.TaskDefinition(`squadops-dashboard-task-${stage}`, {
  family: `squadops-dashboard-${stage}`,
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  cpu: isProd ? "1024" : "512",
  memory: isProd ? "2048" : "1024",
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  runtimePlatform: {
    cpuArchitecture: "ARM64",
    operatingSystemFamily: "LINUX",
  },
  containerDefinitions: JSON.stringify([
    {
      name: "dashboard",
      image: "squadops/dashboard:latest",
      portMappings: [{ containerPort: 3000, protocol: "tcp" }],
      environment: [
        { name: "NODE_ENV", value: stage },
        { name: "NEXT_PUBLIC_API_URL", value: "/api" },
        { name: "API_URL", value: "http://localhost:4000" },
        { name: "PORT", value: "3000" },
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": dashboardLogGroup.name,
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "dashboard",
        },
      },
      healthCheck: {
        command: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3000 || exit 1"],
        interval: 30,
        timeout: 5,
        retries: 3,
        startPeriod: 60,
      },
    },
  ]),
});

// ===== OpenClaw Task Definition =====
const openclawTaskDef = new aws.ecs.TaskDefinition(`squadops-openclaw-task-${stage}`, {
  family: `squadops-openclaw-${stage}`,
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  cpu: isProd ? "2048" : "1024",
  memory: isProd ? "4096" : "2048",
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  runtimePlatform: {
    cpuArchitecture: "ARM64",
    operatingSystemFamily: "LINUX",
  },
  containerDefinitions: JSON.stringify([
    {
      name: "openclaw",
      image: "fourplayers/openclaw:latest",
      portMappings: [
        { containerPort: 18789, protocol: "tcp" },
        { containerPort: 18790, protocol: "tcp" },
      ],
      environment: [
        { name: "HOME", value: "/home/node" },
        { name: "TERM", value: "xterm-256color" },
        { name: "OPENCLAW_TLS_ENABLED", value: "false" },
        { name: "OPENCLAW_SKIP_ONBOARD", value: "true" },
        { name: "OPENCLAW_GATEWAY_TOKEN", value: stage },
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": openclawLogGroup.name,
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "openclaw",
        },
      },
      healthCheck: {
        command: ["CMD-SHELL", "wget -q -O- http://localhost:18789/health || exit 1"],
        interval: 30,
        timeout: 10,
        retries: 5,
        startPeriod: 30,
      },
    },
  ]),
});

// ===== ECS Services =====

// API Service
export const api = new aws.ecs.Service(`squadops-api-${stage}`, {
  cluster: cluster.arn,
  taskDefinition: apiTaskDef.arn,
  desiredCount: isProd ? 2 : 1,
  launchType: "FARGATE",
  networkConfiguration: {
    assignPublicIp: false,
    subnets: privateSubnetIds,
    securityGroups: [ecsSecurityGroup.id],
  },
  loadBalancers: [{
    targetGroupArn: apiTargetGroup.arn,
    containerName: "api",
    containerPort: 4000,
  }],
  deploymentConfiguration: {
    maximumPercent: 200,
    minimumHealthyPercent: 100,
  },
  tags: {
    Name: `squadops-api-${stage}`,
  },
});

// Dashboard Service
export const dashboard = new aws.ecs.Service(`squadops-dashboard-${stage}`, {
  cluster: cluster.arn,
  taskDefinition: dashboardTaskDef.arn,
  desiredCount: isProd ? 2 : 1,
  launchType: "FARGATE",
  networkConfiguration: {
    assignPublicIp: false,
    subnets: privateSubnetIds,
    securityGroups: [ecsSecurityGroup.id],
  },
  loadBalancers: [{
    targetGroupArn: dashboardTargetGroup.arn,
    containerName: "dashboard",
    containerPort: 3000,
  }],
  deploymentConfiguration: {
    maximumPercent: 200,
    minimumHealthyPercent: 100,
  },
  tags: {
    Name: `squadops-dashboard-${stage}`,
  },
});

// OpenClaw Service
export const openclaw = new aws.ecs.Service(`squadops-openclaw-${stage}`, {
  cluster: cluster.arn,
  taskDefinition: openclawTaskDef.arn,
  desiredCount: 1,
  launchType: "FARGATE",
  networkConfiguration: {
    assignPublicIp: false,
    subnets: privateSubnetIds,
    securityGroups: [ecsSecurityGroup.id],
  },
  loadBalancers: [{
    targetGroupArn: openclawTargetGroup.arn,
    containerName: "openclaw",
    containerPort: 18789,
  }],
  deploymentConfiguration: {
    maximumPercent: 200,
    minimumHealthyPercent: 100,
  },
  tags: {
    Name: `squadops-openclaw-${stage}`,
  },
});

// Auto-scaling for API
const apiTargetTracking = new aws.appautoscaling.Target(`squadops-api-autoscale-${stage}`, {
  maxCapacity: isProd ? 10 : 3,
  minCapacity: isProd ? 2 : 1,
  resourceId: cluster.name.apply((name) => `service/${name}/${api.name}`),
  scalableDimension: "ecs:service:DesiredCount",
  serviceNamespace: "ecs",
});

new aws.appautoscaling.Policy(`squadops-api-cpu-${stage}`, {
  policyType: "TargetTrackingScaling",
  resourceId: apiTargetTracking.resourceId,
  scalableDimension: apiTargetTracking.scalableDimension,
  serviceNamespace: apiTargetTracking.serviceNamespace,
  targetTrackingScalingPolicyConfiguration: {
    predefinedMetricSpecification: {
      predefinedMetricType: "ECSServiceAverageCPUUtilization",
    },
    targetValue: 70,
    scaleInCooldown: 60,
    scaleOutCooldown: 60,
  },
});

// Auto-scaling for Dashboard
const dashboardTargetTracking = new aws.appautoscaling.Target(`squadops-dashboard-autoscale-${stage}`, {
  maxCapacity: isProd ? 10 : 3,
  minCapacity: isProd ? 2 : 1,
  resourceId: cluster.name.apply((name) => `service/${name}/${dashboard.name}`),
  scalableDimension: "ecs:service:DesiredCount",
  serviceNamespace: "ecs",
});

new aws.appautoscaling.Policy(`squadops-dashboard-cpu-${stage}`, {
  policyType: "TargetTrackingScaling",
  resourceId: dashboardTargetTracking.resourceId,
  scalableDimension: dashboardTargetTracking.scalableDimension,
  serviceNamespace: dashboardTargetTracking.serviceNamespace,
  targetTrackingScalingPolicyConfiguration: {
    predefinedMetricSpecification: {
      predefinedMetricType: "ECSServiceAverageCPUUtilization",
    },
    targetValue: 70,
    scaleInCooldown: 60,
    scaleOutCooldown: 60,
  },
});

// Outputs
export const apiUrl = albDnsName.apply((dns) => `http://${dns}/api`);
export const dashboardUrl = albDnsName.apply((dns) => `http://${dns}`);
