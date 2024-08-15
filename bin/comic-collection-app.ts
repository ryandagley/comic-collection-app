#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ComicCollectionStack } from '../lib/comic-collection-app-stack';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();
const environment = app.node.tryGetContext('environment') || 'dev';

const stackName = `ComicCollectionStack`;

new ComicCollectionStack(app, stackName, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new PipelineStack(app, `PipelineStack`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});