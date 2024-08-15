import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const githubOwner = process.env.GITHUB_OWNER || this.node.tryGetContext('githubOwner');
    const githubRepo = process.env.GITHUB_REPO || this.node.tryGetContext('githubRepo');
    const githubBranch = process.env.GITHUB_BRANCH || this.node.tryGetContext('githubBranch') || 'main';

    const githubToken = cdk.SecretValue.secretsManager('comicsAppAuth');

    const artifactBucket = new s3.Bucket(this, 'PipelineArtifactBucket', {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    // Source Stage: Pull code from GitHub
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: githubOwner,
      repo: githubRepo,
      oauthToken: githubToken,
      output: sourceOutput,
      branch: githubBranch,
    });

    // Build Stage: CodeBuild to build and test the application
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
    });

    // Define the build action for the CodePipeline.  This defines components of the CodeBuild like Project.
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    // Deploy to Dev Stage
    const deployDevAction = new codepipeline_actions.CloudFormationCreateUpdateStackAction({
      actionName: 'Deploy_Dev',
      stackName: 'ComicCollectionStack-dev',
      templatePath: buildOutput.atPath('ComicCollectionStack.template.json'),
      adminPermissions: true,
    });

    // Manual Approval before Production Deployment
    const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Manual_Approval',
      runOrder: 2,
    });

    // Deploy to Prod Stage
    const deployProdAction = new codepipeline_actions.CloudFormationCreateUpdateStackAction({
      actionName: 'Deploy_Prod',
      stackName: 'ComicCollectionStack-prod',
      templatePath: buildOutput.atPath('ComicCollectionStack.template.json'),
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
          stageName: 'Build',
          actions: [buildAction],
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
          stageName: 'Deploy_Prod',
          actions: [deployProdAction],
        },
      ],
    });
  }
}