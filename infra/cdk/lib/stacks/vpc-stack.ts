/**
 * VPC Stack for SquadOps
 * Creates VPC, subnets, NAT gateways, and security groups
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { SquadOpsConfig } from '../config';

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ecsSecurityGroup: ec2.SecurityGroup;
  public readonly rdsSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, config: SquadOpsConfig, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, 'SquadOpsVpc', {
      vpcName: `${config.projectName}-${config.environment}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
      maxAzs: 3,
      natGateways: config.environment === 'production' ? 3 : 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Security Group for Application Load Balancer
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ALB',
      allowAllOutbound: true,
    });
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP from anywhere');
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS from anywhere');
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(18789), 'Allow OpenClaw port');

    // Security Group for ECS services
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true,
    });
    this.ecsSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(3000), 'Allow from ALB');
    this.ecsSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(4000), 'Allow from ALB');
    this.ecsSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(18789), 'Allow OpenClaw from ALB');

    // Security Group for RDS
    this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    });
    this.rdsSecurityGroup.addIngressRule(this.ecsSecurityGroup, ec2.Port.tcp(5432), 'Allow PostgreSQL from ECS');

    // Security Group for ElastiCache Redis
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ElastiCache Redis',
      allowAllOutbound: false,
    });
    this.redisSecurityGroup.addIngressRule(this.ecsSecurityGroup, ec2.Port.tcp(6379), 'Allow Redis from ECS');

    // VPC Flow Logs
    const flowLogRole = new cdk.aws_iam.Role(this, 'FlowLogRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    const flowLogGroup = new cdk.aws_logs.LogGroup(this, 'FlowLogGroup', {
      logGroupName: `/aws/vpc/${config.projectName}-${config.environment}-flowlogs`,
      retention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });

    new ec2.FlowLog(this, 'VpcFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup, flowLogRole),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.vpc.privateSubnets.map(s => s.subnetId).join(','),
      description: 'Private subnet IDs',
    });

    new cdk.CfnOutput(this, 'DatabaseSubnetIds', {
      value: this.vpc.isolatedSubnets.map(s => s.subnetId).join(','),
      description: 'Database subnet IDs',
    });
  }
}
