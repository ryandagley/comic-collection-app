import * as cdk from 'aws-cdk-lib';
import { ComicCollectionStack } from '../lib/comic-collection-app-stack';

const app = new cdk.App();

new ComicCollectionStack(app, 'ComicCollectionStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
