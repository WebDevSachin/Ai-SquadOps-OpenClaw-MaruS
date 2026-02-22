/**
 * ECS Stack for SquadOps
 * Creates ECS cluster, task definitions, and services for API, Dashboard, and OpenClaw
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { SquadOpsConfig } from '../config';

export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  albSecurityGroup: ec2.SecurityGroup;
  ecsSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.Secret;
  redisEndpoint: string;
}

export class EcsStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly apiService: ecs.FargateService;
  public readonly dashboardService: ecs.FargateService;
  public readonly openclawService: ecs.FargateService;

  constructor(scope: Construct, id: string, config: SquadOpsConfig, props: EcsStackProps) {
    super(scope, id, props);

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'SquadOpsCluster', {
      vpc: props.vpc,
      clusterName: `${config.projectName}-${config.environment}-cluster`,
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });

    // CloudWatch Log Groups
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/ecs/${config.projectName}-${config.environment}-api`,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    const dashboardLogGroup = new logs.LogGroup(this, 'DashboardLogGroup', {
      logGroupName: `/ecs/${config.projectName}-${config.environment}-dashboard`,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    const openclawLogGroup = new logs.LogGroup(this, 'OpenclawLogGroup', {
      logGroupName: `/ecs/${config.projectName}-${config.environment}-openclaw`,
      retention: logs.RetentionDays.ONE_WEEK,
    });

    // IAM Role for ECS Tasks
    const taskRole = new iam.Role(this, 'EcsTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'ssm:GetParameter',
        'ssm:GetParameters',
      ],
      resources: ['*'],
    }));

    // Task Execution Role
    const executionRole = new iam.Role(this, 'EcsExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant execution role access to secrets
    props.dbSecret.grantRead(executionRole);

    // Database URL construction
    const dbUrl = `postgresql://${config.dbUsername}:${props.dbSecret.secretValueFromJson('password').unsafeUnwrap()}@${props.dbSecret.secretValueFromJson('host').unsafeUnwrap() || 'localhost'}:5432/${config.dbName}`;

    // Common environment variables
    const commonEnv = {
      NODE_ENV: config.environment,
      DATABASE_URL: dbUrl,
      REDIS_URL: `redis://${props.redisEndpoint}:6379`,
    };

    // ===== API Task Definition =====
    const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      cpu: config.apiCpu,
      memoryLimitMiB: config.apiMemory,
      taskRole,
      executionRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    apiTaskDef.addContainer('ApiContainer', {
      image: ecs.ContainerImage.fromAsset('../../../api'),
      containerName: 'api',
      portMappings: [{ containerPort: 4000, protocol: ecs.Protocol.TCP }],
      environment: {
        ...commonEnv,
        PORT: '4000',
        CORS_ORIGIN: '*',
        OPENCLAW_GATEWAY_URL: `http://localhost:18789`,
      },
      secrets: {
        JWT_SECRET: ecs.Secret.fromSecretsManager(props.dbSecret, 'jwt_secret'),
        JWT_REFRESH_SECRET: ecs.Secret.fromSecretsManager(props.dbSecret, 'jwt_refresh_secret'),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: apiLogGroup,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'wget --quiet --tries=1 --spider http://localhost:4000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ===== Dashboard Task Definition =====
    const dashboardTaskDef = new ecs.FargateTaskDefinition(this, 'DashboardTaskDef', {
      cpu: config.dashboardCpu,
      memoryLimitMiB: config.dashboardMemory,
      taskRole,
      executionRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    dashboardTaskDef.addContainer('DashboardContainer', {
      image: ecs.ContainerImage.fromAsset('../../../dashboard'),
      containerName: 'dashboard',
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      environment: {
        NODE_ENV: config.environment,
        NEXT_PUBLIC_API_URL: '/api',
        API_URL: 'http://localhost:4000',
        PORT: '3000',
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'dashboard',
        logGroup: dashboardLogGroup,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'wget --quiet --tries=1 --spider http://localhost:3000 || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ===== OpenClaw Task Definition =====
    const openclawTaskDef = new ecs.FargateTaskDefinition(this, 'OpenclawTaskDef', {
      cpu: config.openclawCpu,
      memoryLimitMiB: config.openclawMemory,
      taskRole,
      executionRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    openclawTaskDef.addContainer('OpenclawContainer', {
      image: ecs.ContainerImage.fromRegistry('fourplayers/openclaw:latest'),
      containerName: 'openclaw',
      portMappings: [
        { containerPort: 18789, protocol: ecs.Protocol.TCP },
        { containerPort: 18790, protocol: ecs.Protocol.TCP },
      ],
      environment: {
        HOME: '/home/node',
        TERM: 'xterm-256color',
        OPENCLAW_TLS_ENABLED: 'false',
        OPENCLAW_SKIP_ONBOARD: 'true',
        OPENCLAW_GATEWAY_TOKEN: config.environment,
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'openclaw',
        logGroup: openclawLogGroup,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'wget -q -O- http://localhost:18789/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 5,
        startPeriod: cdk.Duration.seconds(30),
      },
    });

    // Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: true,
      loadBalancerName: `${config.projectName}-${config.environment}-alb`,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // Target Groups
    const apiTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      vpc: props.vpc,
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        port: '4000',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        timeout: cdk.Duration.seconds(5),
        interval: cdk.Duration.seconds(30),
      },
    });

    const dashboardTargetGroup = new elbv2.ApplicationTargetGroup(this, 'DashboardTargetGroup', {
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        port: '3000',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        timeout: cdk.Duration.seconds(5),
        interval: cdk.Duration.seconds(30),
      },
    });

    const openclawTargetGroup = new elbv2.ApplicationTargetGroup(this, 'OpenclawTargetGroup', {
      vpc: props.vpc,
      port: 18789,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        port: '18789',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 5,
        timeout: cdk.Duration.seconds(10),
        interval: cdk.Duration.seconds(30),
      },
    });

    // Listeners
    const httpListener = this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    // Path-based routing
    httpListener.addAction('ApiRoute', {
      priority: 1,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*', '/api'])],
      action: elbv2.ListenerAction.forward([apiTargetGroup]),
    });

    httpListener.addAction('OpenclawRoute', {
      priority: 2,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/openclaw/*'])],
      action: elbv2.ListenerAction.forward([openclawTargetGroup]),
    });

    httpListener.addAction('DefaultRoute', {
      action: elbv2.ListenerAction.forward([dashboardTargetGroup]),
    });

    // ECS Services
    this.apiService = new ecs.FargateService(this, 'ApiService', {
      cluster: this.cluster,
      taskDefinition: apiTaskDef,
      serviceName: 'api',
      desiredCount: config.minCapacity,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.ecsSecurityGroup],
      assignPublicIp: false,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      circuitBreaker: {
        rollback: true,
      },
    });

    this.dashboardService = new ecs.FargateService(this, 'DashboardService', {
      cluster: this.cluster,
      taskDefinition: dashboardTaskDef,
      serviceName: 'dashboard',
      desiredCount: config.minCapacity,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.ecsSecurityGroup],
      assignPublicIp: false,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      circuitBreaker: {
        rollback: true,
      },
    });

    this.openclawService = new ecs.FargateService(this, 'OpenclawService', {
      cluster: this.cluster,
      taskDefinition: openclawTaskDef,
      serviceName: 'openclaw',
      desiredCount: 1,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.ecsSecurityGroup],
      assignPublicIp: false,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    // Attach services to target groups
    this.apiService.attachToApplicationTargetGroup(apiTargetGroup);
    this.dashboardService.attachToApplicationTargetGroup(dashboardTargetGroup);
    this.openclawService.attachToApplicationTargetGroup(openclawTargetGroup);

    // Auto-scaling for API
    const apiScaling = this.apiService.autoScaleTaskCount({
      minCapacity: config.minCapacity,
      maxCapacity: config.maxCapacity,
    });

    apiScaling.scaleOnCpuUtilization('ApiCpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    apiScaling.scaleOnMemoryUtilization('ApiMemoryScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Auto-scaling for Dashboard
    const dashboardScaling = this.dashboardService.autoScaleTaskCount({
      minCapacity: config.minCapacity,
      maxCapacity: config.maxCapacity,
    });

    dashboardScaling.scaleOnCpuUtilization('DashboardCpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Outputs
    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster Name',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: this.alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
    });

    new cdk.CfnOutput(this, 'ApiServiceName', {
      value: this.apiService.serviceName,
      description: 'API Service Name',
    });

    new cdk.CfnOutput(this, 'DashboardServiceName', {
      value: this.dashboardService.serviceName,
      description: 'Dashboard Service Name',
    });
  }
}
