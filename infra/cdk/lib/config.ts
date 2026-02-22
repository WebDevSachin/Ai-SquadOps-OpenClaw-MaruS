/**
 * SquadOps CDK Configuration
 * Central configuration for all stacks
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, '../../..', '.env') });

export interface SquadOpsConfig {
  // Project settings
  projectName: string;
  environment: string;
  
  // Domain settings
  domainName?: string;
  hostedZoneId?: string;
  
  // VPC settings
  vpcCidr: string;
  availabilityZones: string[];
  
  // Database settings
  dbInstanceType: string;
  dbName: string;
  dbUsername: string;
  
  // ECS settings
  apiCpu: number;
  apiMemory: number;
  dashboardCpu: number;
  dashboardMemory: number;
  openclawCpu: number;
  openclawMemory: number;
  
  // Auto-scaling settings
  minCapacity: number;
  maxCapacity: number;
  
  // Secrets (references, not actual values)
  jwtSecretArn?: string;
  openrouterKeyArn?: string;
  anthropicKeyArn?: string;
  telegramTokenArn?: string;
}

// Default configuration
export function getConfig(environment: string = 'dev'): SquadOpsConfig {
  const isProd = environment === 'production';
  
  return {
    projectName: 'squadops',
    environment,
    
    domainName: process.env['DOMAIN_NAME'],
    hostedZoneId: process.env['HOSTED_ZONE_ID'],
    
    vpcCidr: '10.0.0.0/16',
    availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
    
    dbInstanceType: isProd ? 'db.t3.medium' : 'db.t3.micro',
    dbName: 'squadops',
    dbUsername: 'squadops',
    
    apiCpu: isProd ? 1024 : 512,
    apiMemory: isProd ? 2048 : 1024,
    dashboardCpu: isProd ? 1024 : 512,
    dashboardMemory: isProd ? 2048 : 1024,
    openclawCpu: isProd ? 2048 : 1024,
    openclawMemory: isProd ? 4096 : 2048,
    
    minCapacity: isProd ? 2 : 1,
    maxCapacity: isProd ? 10 : 3,
    
    jwtSecretArn: process.env['JWT_SECRET_ARN'],
    openrouterKeyArn: process.env['OPENROUTER_KEY_ARN'],
    anthropicKeyArn: process.env['ANTHROPIC_KEY_ARN'],
    telegramTokenArn: process.env['TELEGRAM_TOKEN_ARN'],
  };
}

export const tags = {
  Project: 'SquadOps',
  ManagedBy: 'CDK',
  Environment: process.env['CDK_ENV'] || 'dev',
};
