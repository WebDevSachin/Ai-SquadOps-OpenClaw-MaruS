/**
 * Database Infrastructure for SquadOps SST
 * RDS Aurora PostgreSQL and ElastiCache Redis
 */
import * as aws from "@pulumi/aws";
import { vpc, databaseSubnetIds, rdsSecurityGroup, redisSecurityGroup } from "./vpc";

const stage = $app.stage;
const isProd = stage === "production";

// Database Subnet Group
const dbSubnetGroup = new aws.rds.SubnetGroup(`squadops-db-subnet-${stage}`, {
  subnetIds: databaseSubnetIds,
  tags: {
    Name: `squadops-db-subnet-${stage}`,
  },
});

// Database Credentials Secret
export const dbSecret = new aws.secretsmanager.Secret(`squadops-db-secret-${stage}`, {
  name: `squadops/${stage}/database-credentials`,
  description: "SquadOps database credentials",
  recoveryWindowInDays: isProd ? 30 : 0,
});

const dbSecretVersion = new aws.secretsmanager.SecretVersion(`squadops-db-secret-version-${stage}`, {
  secretId: dbSecret.id,
  secretString: JSON.stringify({
    username: "squadops",
    password: $util.password({ length: 32, special: false }),
  }),
});

// RDS Aurora PostgreSQL Cluster
export const database = new aws.rds.Cluster(`squadops-postgres-${stage}`, {
  engine: "aurora-postgresql",
  engineVersion: "16.1",
  databaseName: "squadops",
  masterUsername: dbSecret.apply((s) => JSON.parse(s.secretString!).username),
  masterPassword: dbSecret.apply((s) => JSON.parse(s.secretString!).password),
  dbSubnetGroupName: dbSubnetGroup.name,
  vpcSecurityGroupIds: [rdsSecurityGroup.id],
  backupRetentionPeriod: isProd ? 30 : 7,
  preferredBackupWindow: "03:00-04:00",
  skipFinalSnapshot: !isProd,
  deletionProtection: isProd,
  storageEncrypted: true,
  enabledCloudwatchLogsExports: ["postgresql"],
  tags: {
    Name: `squadops-postgres-${stage}`,
  },
});

// RDS Cluster Instances
for (let i = 0; i < (isProd ? 2 : 1); i++) {
  new aws.rds.ClusterInstance(`squadops-postgres-instance-${i}-${stage}`, {
    clusterIdentifier: database.id,
    instanceClass: isProd ? "db.t3.medium" : "db.t3.micro",
    engine: "aurora-postgresql",
    publiclyAccessible: false,
    tags: {
      Name: `squadops-postgres-${i}-${stage}`,
    },
  });
}

// ElastiCache Redis Subnet Group
const redisSubnetGroup = new aws.elasticache.SubnetGroup(`squadops-redis-subnet-${stage}`, {
  subnetIds: databaseSubnetIds,
  tags: {
    Name: `squadops-redis-subnet-${stage}`,
  },
});

// ElastiCache Redis Parameter Group
const redisParamGroup = new aws.elasticache.ParameterGroup(`squadops-redis-params-${stage}`, {
  family: "redis7",
  parameters: [
    { name: "maxmemory-policy", value: "allkeys-lru" },
  ],
});

// ElastiCache Redis Cluster
export const redis = new aws.elasticache.ReplicationGroup(`squadops-redis-${stage}`, {
  replicationGroupDescription: "SquadOps Redis cluster",
  engine: "redis",
  engineVersion: "7.1",
  nodeType: isProd ? "cache.t3.medium" : "cache.t3.micro",
  numCacheClusters: isProd ? 2 : 1,
  automaticFailoverEnabled: isProd,
  autoMinorVersionUpgrade: true,
  atRestEncryptionEnabled: true,
  transitEncryptionEnabled: true,
  snapshotRetentionLimit: isProd ? 7 : 1,
  snapshotWindow: "05:00-06:00",
  subnetGroupName: redisSubnetGroup.name,
  securityGroupIds: [redisSecurityGroup.id],
  parameterGroupName: redisParamGroup.name,
  tags: {
    Name: `squadops-redis-${stage}`,
  },
});

// Outputs
export const databaseHost = database.endpoint;
export const databasePort = database.port;
export const redisHost = redis.primaryEndpointAddress;
export const redisPort = 6379;
