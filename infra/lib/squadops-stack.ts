import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

const PLACEHOLDER_IMAGE = 'public.ecr.aws/docker/library/node:20-slim';

export interface SquadOpsStackProps extends cdk.StackProps {
  /** ECR image URI for OpenClaw gateway. Default: placeholder. */
  openclawGatewayImage?: string;
  /** ECR image URI for API. Default: placeholder. */
  apiImage?: string;
  /** ECR image URI for Dashboard. Default: placeholder. */
  dashboardImage?: string;
}

export class SquadOpsStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly cluster: ecs.Cluster;
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly redisCluster: elasticache.CfnCacheCluster;
  public readonly secrets: secretsmanager.Secret;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: SquadOpsStackProps) {
    super(scope, id, props);

    const openclawImage = props?.openclawGatewayImage ?? PLACEHOLDER_IMAGE;
    const apiImage = props?.apiImage ?? PLACEHOLDER_IMAGE;
    const dashboardImage = props?.dashboardImage ?? PLACEHOLDER_IMAGE;

    // ========== VPC ==========
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      vpcName: 'squadops-vpc',
    });
    cdk.Tags.of(this.vpc).add('Name', 'squadops-vpc');

    // ========== Secrets Manager ==========
    this.secrets = new secretsmanager.Secret(this, 'SquadOpsSecrets', {
      secretName: 'squadops/api-keys',
      description: 'SquadOps API keys and tokens',
      secretObjectValue: {
        ANTHROPIC_API_KEY: cdk.SecretValue.unsafePlainText('REPLACE_IN_AWS_CONSOLE'),
        TELEGRAM_BOT_TOKEN: cdk.SecretValue.unsafePlainText('REPLACE_IN_AWS_CONSOLE'),
        OPENCLAW_GATEWAY_TOKEN: cdk.SecretValue.unsafePlainText('REPLACE_IN_AWS_CONSOLE'),
        JWT_SECRET: cdk.SecretValue.unsafePlainText('REPLACE_IN_AWS_CONSOLE'),
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    cdk.Tags.of(this.secrets).add('Name', 'squadops-api-keys');

    // ========== RDS Postgres ==========
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for SquadOps RDS',
      allowAllOutbound: false,
    });
    cdk.Tags.of(dbSecurityGroup).add('Name', 'squadops-db-sg');

    this.dbInstance = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      databaseName: 'squadops',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // Single AZ for dev; uncomment for prod:
      // multiAz: true,
    });
    cdk.Tags.of(this.dbInstance).add('Name', 'squadops-postgres');

    // ========== ElastiCache Redis ==========
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for SquadOps Redis',
      subnetIds: this.vpc.privateSubnets.map((s) => s.subnetId),
      cacheSubnetGroupName: 'squadops-redis-subnets',
    });

    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for SquadOps Redis',
      allowAllOutbound: false,
    });
    cdk.Tags.of(redisSecurityGroup).add('Name', 'squadops-redis-sg');

    this.redisCluster = new elasticache.CfnCacheCluster(this, 'Redis', {
      cacheNodeType: 'cache.t3.micro',
      engine: 'redis',
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
      clusterName: 'squadops-redis',
    });
    this.redisCluster.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    cdk.Tags.of(this.redisCluster).add('Name', 'squadops-redis');

    // ========== ECS Cluster ==========
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: this.vpc,
      clusterName: 'squadops-cluster',
      enableFargateCapacityProviders: true,
    });
    cdk.Tags.of(this.cluster).add('Name', 'squadops-cluster');

    // ========== Security groups for ECS ==========
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for SquadOps ALB',
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    cdk.Tags.of(albSecurityGroup).add('Name', 'squadops-alb-sg');

    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for SquadOps ECS services',
      allowAllOutbound: true,
    });
    ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(3000), 'Dashboard');
    ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(4000), 'API');
    ecsSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(18789), 'OpenClaw gateway');
    cdk.Tags.of(ecsSecurityGroup).add('Name', 'squadops-ecs-sg');

    dbSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.tcp(5432), 'Postgres from ECS');
    redisSecurityGroup.addIngressRule(ecsSecurityGroup, ec2.Port.tcp(6379), 'Redis from ECS');

    // ========== ALB ==========
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: this.vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      loadBalancerName: 'squadops-alb',
    });
    cdk.Tags.of(this.alb).add('Name', 'squadops-alb');

    // ========== Target groups ==========
    const apiTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      vpc: this.vpc,
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      targetGroupName: 'squadops-api-tg',
    });

    const dashboardTargetGroup = new elbv2.ApplicationTargetGroup(this, 'DashboardTargetGroup', {
      vpc: this.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      targetGroupName: 'squadops-dashboard-tg',
    });

    const gatewayTargetGroup = new elbv2.ApplicationTargetGroup(this, 'GatewayTargetGroup', {
      vpc: this.vpc,
      port: 18789,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      targetGroupName: 'squadops-gateway-tg',
    });

    // Listener: default -> dashboard; /api/* -> API; /gateway/* -> gateway
    const listener = this.alb.addListener('Listener', {
      port: 80,
      open: true,
      defaultTargetGroups: [dashboardTargetGroup],
    });
    listener.addAction('ApiRule', {
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*', '/api'])],
      action: elbv2.ListenerAction.forward([apiTargetGroup]),
    });
    listener.addAction('GatewayRule', {
      priority: 20,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/gateway/*', '/gateway'])],
      action: elbv2.ListenerAction.forward([gatewayTargetGroup]),
    });

    // ========== CloudWatch Log Groups ==========
    const gatewayLogGroup = new logs.LogGroup(this, 'GatewayLogGroup', {
      logGroupName: '/ecs/squadops/openclaw-gateway',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: '/ecs/squadops/api',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const dashboardLogGroup = new logs.LogGroup(this, 'DashboardLogGroup', {
      logGroupName: '/ecs/squadops/dashboard',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========== Fargate Services ==========
    const dbHost = this.dbInstance.dbInstanceEndpointAddress;
    const redisEndpoint = this.redisCluster.attrRedisEndpointAddress;

    // OpenClaw Gateway
    const gatewayTaskDef = new ecs.FargateTaskDefinition(this, 'GatewayTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      taskRole: this.createTaskRole('gateway'),
      executionRole: this.createExecutionRole('gateway'),
    });

    gatewayTaskDef.addContainer('gateway', {
      image: ecs.ContainerImage.fromRegistry(openclawImage),
      portMappings: [{ containerPort: 18789 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'gateway',
        logGroup: gatewayLogGroup,
      }),
      environment: {
        REDIS_URL: `redis://${redisEndpoint}:6379`,
      },
      secrets: {
        OPENCLAW_GATEWAY_TOKEN: ecs.Secret.fromSecretsManager(this.secrets, 'OPENCLAW_GATEWAY_TOKEN'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:18789/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    const gatewayService = new ecs.FargateService(this, 'GatewayService', {
      cluster: this.cluster,
      taskDefinition: gatewayTaskDef,
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      serviceName: 'openclaw-gateway',
    });
    gatewayService.attachToApplicationTargetGroup(gatewayTargetGroup);
    cdk.Tags.of(gatewayService).add('Name', 'openclaw-gateway');

    // API
    const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      taskRole: this.createTaskRole('api'),
      executionRole: this.createExecutionRole('api'),
    });

    apiTaskDef.addContainer('api', {
      image: ecs.ContainerImage.fromRegistry(apiImage),
      portMappings: [{ containerPort: 4000 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: apiLogGroup,
      }),
      environment: {
        DB_HOST: dbHost,
        DB_PORT: this.dbInstance.dbInstanceEndpointPort,
        DB_NAME: 'squadops',
        REDIS_URL: `redis://${redisEndpoint}:6379`,
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(this.dbInstance.secret!, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(this.dbInstance.secret!, 'password'),
        ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(this.secrets, 'ANTHROPIC_API_KEY'),
        TELEGRAM_BOT_TOKEN: ecs.Secret.fromSecretsManager(this.secrets, 'TELEGRAM_BOT_TOKEN'),
        JWT_SECRET: ecs.Secret.fromSecretsManager(this.secrets, 'JWT_SECRET'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:4000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    const apiService = new ecs.FargateService(this, 'ApiService', {
      cluster: this.cluster,
      taskDefinition: apiTaskDef,
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      serviceName: 'squadops-api',
    });
    apiService.attachToApplicationTargetGroup(apiTargetGroup);
    cdk.Tags.of(apiService).add('Name', 'squadops-api');
    this.dbInstance.secret!.grantRead(apiTaskDef.taskRole);

    // Dashboard
    const dashboardTaskDef = new ecs.FargateTaskDefinition(this, 'DashboardTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      taskRole: this.createTaskRole('dashboard'),
      executionRole: this.createExecutionRole('dashboard'),
    });

    dashboardTaskDef.addContainer('dashboard', {
      image: ecs.ContainerImage.fromRegistry(dashboardImage),
      portMappings: [{ containerPort: 3000 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'dashboard',
        logGroup: dashboardLogGroup,
      }),
      environment: {
        NODE_ENV: 'production',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/ || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    const dashboardService = new ecs.FargateService(this, 'DashboardService', {
      cluster: this.cluster,
      taskDefinition: dashboardTaskDef,
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      serviceName: 'squadops-dashboard',
    });
    dashboardService.attachToApplicationTargetGroup(dashboardTargetGroup);
    cdk.Tags.of(dashboardService).add('Name', 'squadops-dashboard');

    // ========== CloudFront ==========
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(this.alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      defaultRootObject: '',
      comment: 'SquadOps Dashboard and API',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });
    cdk.Tags.of(this.distribution).add('Name', 'squadops-distribution');

    // ========== Outputs ==========
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL for Dashboard and API',
      exportName: 'SquadOps-CloudFrontUrl',
    });
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'ALB DNS name',
      exportName: 'SquadOps-AlbDnsName',
    });
    new cdk.CfnOutput(this, 'SecretsArn', {
      value: this.secrets.secretArn,
      description: 'Secrets Manager ARN for API keys',
      exportName: 'SquadOps-SecretsArn',
    });
  }

  private createTaskRole(name: string): iam.IRole {
    const role = new iam.Role(this, `${name}TaskRole`, {
      roleName: `squadops-${name}-task-role`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    this.secrets.grantRead(role);
    return role;
  }

  private createExecutionRole(name: string): iam.IRole {
    return new iam.Role(this, `${name}ExecutionRole`, {
      roleName: `squadops-${name}-execution-role`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
  }
}
