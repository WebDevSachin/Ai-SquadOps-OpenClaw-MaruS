/**
 * VPC Infrastructure for SquadOps
 * SST v3 uses Pulumi under the hood
 */
import * as aws from "@pulumi/aws";

const stage = $app.stage;
const isProd = stage === "production";

// Create VPC
export const vpc = new aws.ec2.Vpc(`squadops-vpc-${stage}`, {
  cidrBlock: "10.0.0.0/16",
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: `squadops-vpc-${stage}`,
    Environment: stage,
  },
});

// Internet Gateway
const igw = new aws.ec2.InternetGateway(`squadops-igw-${stage}`, {
  vpcId: vpc.id,
  tags: {
    Name: `squadops-igw-${stage}`,
  },
});

// Availability Zones
const azs = await aws.getAvailabilityZones({ state: "available" });

// Public Subnets
export const publicSubnets: aws.ec2.Subnet[] = [];
for (let i = 0; i < 3; i++) {
  publicSubnets.push(
    new aws.ec2.Subnet(`squadops-public-${i}-${stage}`, {
      vpcId: vpc.id,
      cidrBlock: `10.0.${i}.0/24`,
      availabilityZone: azs.names[i],
      mapPublicIpOnLaunch: true,
      tags: {
        Name: `squadops-public-${i}-${stage}`,
        Type: "public",
      },
    })
  );
}

// Private Subnets
export const privateSubnets: aws.ec2.Subnet[] = [];
for (let i = 0; i < 3; i++) {
  privateSubnets.push(
    new aws.ec2.Subnet(`squadops-private-${i}-${stage}`, {
      vpcId: vpc.id,
      cidrBlock: `10.0.${i + 10}.0/24`,
      availabilityZone: azs.names[i],
      mapPublicIpOnLaunch: false,
      tags: {
        Name: `squadops-private-${i}-${stage}`,
        Type: "private",
      },
    })
  );
}

// Database Subnets
export const databaseSubnets: aws.ec2.Subnet[] = [];
for (let i = 0; i < 3; i++) {
  databaseSubnets.push(
    new aws.ec2.Subnet(`squadops-db-${i}-${stage}`, {
      vpcId: vpc.id,
      cidrBlock: `10.0.${i + 20}.0/24`,
      availabilityZone: azs.names[i],
      mapPublicIpOnLaunch: false,
      tags: {
        Name: `squadops-db-${i}-${stage}`,
        Type: "database",
      },
    })
  );
}

// NAT Gateways (one per AZ in prod, one in dev)
const natGateways: aws.ec2.NatGateway[] = [];
const eips: aws.ec2.Eip[] = [];

for (let i = 0; i < (isProd ? 3 : 1); i++) {
  eips.push(
    new aws.ec2.Eip(`squadops-eip-${i}-${stage}`, {
      domain: "vpc",
      tags: {
        Name: `squadops-nat-${i}-${stage}`,
      },
    })
  );

  natGateways.push(
    new aws.ec2.NatGateway(`squadops-nat-${i}-${stage}`, {
      subnetId: publicSubnets[i].id,
      allocationId: eips[i].id,
      tags: {
        Name: `squadops-nat-${i}-${stage}`,
      },
    })
  );
}

// Route Tables
const publicRouteTable = new aws.ec2.RouteTable(`squadops-public-rt-${stage}`, {
  vpcId: vpc.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      gatewayId: igw.id,
    },
  ],
  tags: {
    Name: `squadops-public-rt-${stage}`,
  },
});

// Associate public subnets with public route table
for (let i = 0; i < 3; i++) {
  new aws.ec2.RouteTableAssociation(`squadops-public-rta-${i}-${stage}`, {
    subnetId: publicSubnets[i].id,
    routeTableId: publicRouteTable.id,
  });
}

// Private route tables with NAT
for (let i = 0; i < 3; i++) {
  const privateRt = new aws.ec2.RouteTable(`squadops-private-rt-${i}-${stage}`, {
    vpcId: vpc.id,
    routes: [
      {
        cidrBlock: "0.0.0.0/0",
        natGatewayId: natGateways[Math.min(i, natGateways.length - 1)].id,
      },
    ],
    tags: {
      Name: `squadops-private-rt-${i}-${stage}`,
    },
  });

  new aws.ec2.RouteTableAssociation(`squadops-private-rta-${i}-${stage}`, {
    subnetId: privateSubnets[i].id,
    routeTableId: privateRt.id,
  });
}

// Security Groups
export const albSecurityGroup = new aws.ec2.SecurityGroup(`squadops-alb-sg-${stage}`, {
  vpcId: vpc.id,
  description: "ALB Security Group",
  ingress: [
    { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
    { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
    { protocol: "tcp", fromPort: 18789, toPort: 18789, cidrBlocks: ["0.0.0.0/0"] },
  ],
  egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
  tags: {
    Name: `squadops-alb-sg-${stage}`,
  },
});

export const ecsSecurityGroup = new aws.ec2.SecurityGroup(`squadops-ecs-sg-${stage}`, {
  vpcId: vpc.id,
  description: "ECS Security Group",
  ingress: [
    { protocol: "tcp", fromPort: 3000, toPort: 3000, securityGroups: [albSecurityGroup.id] },
    { protocol: "tcp", fromPort: 4000, toPort: 4000, securityGroups: [albSecurityGroup.id] },
    { protocol: "tcp", fromPort: 18789, toPort: 18789, securityGroups: [albSecurityGroup.id] },
  ],
  egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
  tags: {
    Name: `squadops-ecs-sg-${stage}`,
  },
});

export const rdsSecurityGroup = new aws.ec2.SecurityGroup(`squadops-rds-sg-${stage}`, {
  vpcId: vpc.id,
  description: "RDS Security Group",
  ingress: [
    { protocol: "tcp", fromPort: 5432, toPort: 5432, securityGroups: [ecsSecurityGroup.id] },
  ],
  tags: {
    Name: `squadops-rds-sg-${stage}`,
  },
});

export const redisSecurityGroup = new aws.ec2.SecurityGroup(`squadops-redis-sg-${stage}`, {
  vpcId: vpc.id,
  description: "Redis Security Group",
  ingress: [
    { protocol: "tcp", fromPort: 6379, toPort: 6379, securityGroups: [ecsSecurityGroup.id] },
  ],
  tags: {
    Name: `squadops-redis-sg-${stage}`,
  },
});

// Outputs
export const vpcId = vpc.id;
export const publicSubnetIds = publicSubnets.map((s) => s.id);
export const privateSubnetIds = privateSubnets.map((s) => s.id);
export const databaseSubnetIds = databaseSubnets.map((s) => s.id);
