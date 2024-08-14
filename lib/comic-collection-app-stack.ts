import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class ComicCollectionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get environment context
    const environment = this.node.tryGetContext('environment');

    // S3 Bucket for Frontend
    const bucketName = `comic-collection-${environment}-bucket`;
    new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: bucketName,
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
    });

    // DynamoDB Table
    new dynamodb.Table(this, 'ComicsTable', {
      tableName: `ComicsTable-${environment}`,
      partitionKey: { name: 'comicId', type: dynamodb.AttributeType.STRING },
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Function
    const comicsLambda = new lambda.Function(this, 'ComicsLambda', {
      functionName: `ComicsLambda-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'app.handler'
    });

    // API Gateway
    new apigateway.LambdaRestApi(this, 'ComicsApi', {
      restApiName: `ComicsApi-${environment}`,
      handler: comicsLambda
    });
  }
}
