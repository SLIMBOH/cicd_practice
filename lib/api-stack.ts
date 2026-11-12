import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import { Waf } from './waf-construct';

export interface ApiStackProps extends StackProps {
  readonly stage: string;
  readonly enableWaf: boolean;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const logGroup = new logs.LogGroup(this, 'HelloFnLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const helloFn = new NodejsFunction(this, 'HelloFn', {
      entry: path.join(__dirname, '../src/handlers/hello.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64, // ~20% cheaper than x86
      memorySize: 128,
      timeout: Duration.seconds(5),
      logGroup,
      environment: { STAGE: props.stage },
      bundling: { minify: true, sourceMap: false },
    });

    // REST API (v1) is required: HTTP API (v2) cannot be associated with WAF.
    const api = new apigw.LambdaRestApi(this, 'HelloApi', {
      handler: helloFn,
      proxy: false,
      deployOptions: {
        stageName: props.stage,
        // Stage-level throttling to cap cost if someone floods the endpoint
        throttlingRateLimit: 10,
        throttlingBurstLimit: 20,
      },
    });
    api.root.addResource('hello').addMethod('GET');

    if (props.enableWaf) {
      new Waf(this, 'Waf', { apiStageArn: api.deploymentStage.stageArn });
    }

    new CfnOutput(this, 'ApiUrl', { value: `${api.url}hello` });
  }
}
