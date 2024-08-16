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
    const environment = this.node.tryGetContext('environment') || process.env.ENVIRONMENT || 'dev';

    // S3 Bucket for storing comic images
    const websiteBucket = new s3.Bucket(this, `WebsiteBucket-${environment}`, {
      bucketName: `comic-collection-${environment}-bucket`,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // DynamoDB Table for storing comic metadata
    const comicsTable = new dynamodb.Table(this, `ComicsTable-${environment}`, {
      tableName: `ComicsTable-${environment}`,
      partitionKey: { name: 'comicId', type: dynamodb.AttributeType.STRING },
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Function for handling backend logic
    const comicsLambda = new lambda.Function(this, `ComicsLambda-${environment}`, {
      functionName: `ComicsLambda-${environment}`,
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'app.handler',
      environment: {
        BUCKET_NAME: websiteBucket.bucketName,
        TABLE_NAME: comicsTable.tableName,
      },
    });

    // Grant the Lambda function permission to read/write from the S3 bucket and the DynamoDB table
    websiteBucket.grantReadWrite(comicsLambda);
    comicsTable.grantReadWriteData(comicsLambda);

    // API Gateway to expose Lambda function as a REST API
    const api = new apigateway.LambdaRestApi(this, `ComicsApi-${environment}`, {
      restApiName: `ComicsApi-${environment}`,
      handler: comicsLambda,
      deployOptions: {
        stageName: environment,  // Explicitly set the stage name to the environment (e.g., 'dev' or 'prod')
      },
    });

    // Output the API Gateway URL for this environment
    new cdk.CfnOutput(this, `ApiUrl-${environment}`, {
      value: api.url,
      description: `The URL of the API Gateway for ${environment} environment`,
    });
  }
}
