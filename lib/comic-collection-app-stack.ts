import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { BlockPublicAccess } from 'aws-cdk-lib/aws-s3';

export class ComicCollectionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = this.node.tryGetContext('environment') || process.env.ENVIRONMENT || 'dev';

    // S3 Bucket for storing comic images - private bucket
    const bucketName = `comic-collection-${environment}-bucket`;
    let websiteBucket: s3.IBucket;
    try {
      websiteBucket = s3.Bucket.fromBucketName(this, `ImportedWebsiteBucket-${environment}`, bucketName);
    } catch (e) {
      websiteBucket = new s3.Bucket(this, `WebsiteBucket-${environment}`, {
        bucketName: bucketName,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });
    }

    // DynamoDB Table for storing comic metadata
    const tableName = `ComicsTable-${environment}`;
    let comicsTable: dynamodb.ITable;
    try {
      comicsTable = dynamodb.Table.fromTableName(this, `ImportedComicsTable-${environment}`, tableName);
    } catch (e) {
      comicsTable = new dynamodb.Table(this, `ComicsTable-${environment}`, {
        tableName: tableName,
        partitionKey: { name: 'comicId', type: dynamodb.AttributeType.STRING },
        removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });
    }

    // Lambda Function for handling backend logic
    const lambdaName = `ComicsLambda-${environment}`;
    let comicsLambda: lambda.IFunction;

    try {
      // Try to import the existing Lambda function
      comicsLambda = lambda.Function.fromFunctionName(this, `ImportedComicsLambda-${environment}`, lambdaName);
      console.log(`Lambda function ${lambdaName} exists and was imported.`);
    } catch (e) {
      // If the Lambda function does not exist, create a new one
      console.warn(`Lambda function ${lambdaName} not found. Creating a new one.`);
      comicsLambda = new lambda.Function(this, `ComicsLambda-${environment}`, {
        functionName: lambdaName,
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
    }

    // Ensure the Lambda function is created before the API Gateway is created
    comicsLambda.node.addDependency(websiteBucket);
    comicsLambda.node.addDependency(comicsTable);

    // API Gateway to expose Lambda function as a REST API
    const api = new apigateway.LambdaRestApi(this, `ComicsApi-${environment}`, {
      restApiName: `ComicsApi-${environment}`,
      handler: comicsLambda,
      deployOptions: {
        stageName: environment,
      },
    });

    // Ensure API Gateway is created after the Lambda function
    api.node.addDependency(comicsLambda);

    // Output the API Gateway URL for this environment
    new cdk.CfnOutput(this, `ApiUrl-${environment}`, {
      value: api.url,
      description: `The URL of the API Gateway for ${environment} environment`,
    });
  }
}
