/**
 * Database Stack for SquadOps
 * Creates RDS PostgreSQL and ElastiCache Redis
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { SquadOpsConfig } from '../config';

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  rdsSecurityGroup: ec2.SecurityGroup;
  redisSecurityGroup: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly dbCluster: rds.DatabaseCluster;
  public readonly redisCluster: elasticache.CfnReplicationGroup;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly redisEndpoint: string;

  constructor(scope: Construct, id: string, config: SquadOpsConfig, props: DatabaseStackProps) {
    super(scope, id, props);

    // Database credentials secret
    this.dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: `${config.projectName}-${config.environment}-db-credentials`,
      description: 'PostgreSQL database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: config.dbUsername,
        }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
      },
    });

    // RDS PostgreSQL Aurora Serverless v2 Cluster
    this.dbCluster = new rds.DatabaseCluster(this, 'PostgresCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_1,
      }),
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      defaultDatabaseName: config.dbName,
      instanceProps: {
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        securityGroups: [props.rdsSecurityGroup],
        instanceType: new ec2.InstanceType(config.dbInstanceType),
      },
      instances: config.environment === 'production' ? 2 : 1,
      storageEncrypted: true,
      deletionProtection: config.environment === 'production',
      removalPolicy: config.environment === 'production' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });

    // ElastiCache Redis Subnet Group
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis',
      subnetIds: props.vpc.isolatedSubnets.map(s => s.subnetId),
      cacheSubnetGroupName: `${config.projectName}-${config.environment}-redis-subnet`,
    });

    // ElastiCache Redis Cluster (Cluster Mode Enabled)
    this.redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupDescription: 'SquadOps Redis cluster',
      engine: 'redis',
      cacheNodeType: config.environment === 'production' ? 'cache.t3.medium' : 'cache.t3.micro',
      numCacheClusters: config.environment === 'production' ? 2 : 1,
      automaticFailoverEnabled: config.environment === 'production',
      autoMinorVersionUpgrade: true,
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      securityGroupIds: [props.redisSecurityGroup.securityGroupId],
      snapshotRetentionLimit: config.environment === 'production' ? 7 : 1,
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
    });

    this.redisCluster.addDependency(redisSubnetGroup);
    this.redisEndpoint = this.redisCluster.attrPrimaryEndPointAddress;

    // Outputs
    new cdk.CfnOutput(this, 'DbClusterEndpoint', {
      value: this.dbCluster.clusterEndpoint.hostname,
      description: 'Database cluster endpoint',
    });

    new cdk.CfnOutput(this, 'DbClusterPort', {
      value: this.dbCluster.clusterEndpoint.port.toString(),
      description: 'Database cluster port',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisEndpoint,
      description: 'Redis primary endpoint',
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: '6379',
      description: 'Redis port',
    });
  }
}
