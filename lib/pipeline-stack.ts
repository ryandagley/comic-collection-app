import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const secret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubSecret', 'comicsAppAuth');

    // Parse the secret JSON
    const githubOwner = secret.secretValueFromJson('githubOwner').unsafeUnwrap();
    const githubRepo = secret.secretValueFromJson('githubRepo').unsafeUnwrap();
    const githubToken = secret.secretValueFromJson('githubToken');
    const githubBranch = secret.secretValueFromJson('githubBranch').unsafeUnwrap() || 'main';

    const artifactBucket = new s3.Bucket(this, 'PipelineArtifactBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const sourceOutput = new codepipeline.Artifact();
    const buildOutputDev = new codepipeline.Artifact('BuildOutput_Dev');
    const buildOutputProd = new codepipeline.Artifact('BuildOutput_Prod');

    // Source Stage: Pull code from GitHub
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: githubOwner,
      repo: githubRepo,
      oauthToken: githubToken,
      output: sourceOutput,
      branch: githubBranch,
    });

    // Build Stage: CodeBuild to build and test the application for Dev environment
    const buildProjectDev = new codebuild.PipelineProject(this, 'BuildProjectDev', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
    });

    const buildActionDev = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild_Dev',
      project: buildProjectDev,
      input: sourceOutput,
      outputs: [buildOutputDev],
      environmentVariables: {
        ENVIRONMENT: { value: 'dev' },
      },
    });

    // Deploy to Dev Stage
    const deployDevAction = new codepipeline_actions.CloudFormationCreateUpdateStackAction({
      actionName: 'Deploy_Dev',
      stackName: 'ComicCollectionStack-dev',
      templatePath: buildOutputDev.atPath('ComicCollectionStack.template.json'),
      adminPermissions: true,
    });

    // Manual Approval before Production Deployment
    const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Manual_Approval',
      runOrder: 2,
    });

    // Build Stage: CodeBuild to build and test the application for Prod environment
    const buildProjectProd = new codebuild.PipelineProject(this, 'BuildProjectProd', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
    });

    const buildActionProd = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild_Prod',
      project: buildProjectProd,
      input: sourceOutput,
      outputs: [buildOutputProd],
      environmentVariables: {
        ENVIRONMENT: { value: 'prod' },
      },
    });

    // Deploy to Prod Stage
    const deployProdAction = new codepipeline_actions.CloudFormationCreateUpdateStackAction({
      actionName: 'Deploy_Prod',
      stackName: 'ComicCollectionStack-prod',
      templatePath: buildOutputProd.atPath('ComicCollectionStack.template.json'),
      adminPermissions: true,
    });

    // Define the pipeline
    new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'ComicCollectionPipeline',
      artifactBucket: artifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'Build_Dev',
          actions: [buildActionDev],
        },
        {
          stageName: 'Deploy_Dev',
          actions: [deployDevAction],
        },
        {
          stageName: 'Approve',
          actions: [manualApprovalAction],
        },
        {
          stageName: 'Build_Prod',
          actions: [buildActionProd],
        },
        {
          stageName: 'Deploy_Prod',
          actions: [deployProdAction],
        },
      ],
    });
  }
}
