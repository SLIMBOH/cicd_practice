import { Stack } from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface WafProps {
  /** Stage ARN of the REST API to protect */
  readonly apiStageArn: string;
  /** Max requests per IP in a 5-minute window */
  readonly rateLimit?: number;
}

/**
 * Basic WAF: AWS Common Rule Set + per-IP rate limit.
 * Cost: $5/month (Web ACL) + $1/month per rule (2 rules) + $0.60 per 1M requests.
 * Written with L1 (Cfn*) constructs to stay close to CloudFormation.
 */
export class Waf extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: WafProps) {
    super(scope, id);

    const prefix = Stack.of(this).stackName;
    const visibility = (metricName: string): wafv2.CfnWebACL.VisibilityConfigProperty => ({
      cloudWatchMetricsEnabled: true,
      sampledRequestsEnabled: true,
      metricName: `${prefix}-${metricName}`,
    });

    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: visibility('WebAcl'),
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 0,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: visibility('CommonRuleSet'),
        },
        {
          name: 'RateLimitPerIp',
          priority: 1,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: props.rateLimit ?? 100,
              evaluationWindowSec: 300,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: visibility('RateLimit'),
        },
      ],
    });

    new wafv2.CfnWebACLAssociation(this, 'Association', {
      resourceArn: props.apiStageArn,
      webAclArn: this.webAcl.attrArn,
    });
  }
}
