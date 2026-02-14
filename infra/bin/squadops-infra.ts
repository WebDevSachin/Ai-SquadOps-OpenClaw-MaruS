#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SquadOpsStack } from '../lib/squadops-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new SquadOpsStack(app, 'SquadOpsStack', {
  env,
  tags: {
    Project: 'SquadOps',
    ManagedBy: 'CDK',
  },
});
