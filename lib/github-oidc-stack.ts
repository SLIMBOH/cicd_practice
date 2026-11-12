import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GithubOidcStackProps extends StackProps {
  /** e.g. "your-name/aws-practice" */
  readonly githubRepo: string;
  /**
   * GitHub Environment the deploy job runs in.
   * When a job uses `environment:`, the OIDC token's `sub` claim becomes
   * `repo:<owner>/<repo>:environment:<name>` (no branch info), so trust must match that.
   * Branch restriction is enforced by the environment's "Deployment branches" rule.
   */
  readonly environment?: string;
  /**
   * Set when the account already has the GitHub OIDC provider
   * (only one per URL is allowed per account).
   */
  readonly existingProviderArn?: string;
}

/**
 * One-time bootstrap stack, deployed manually from your laptop.
 * Lets GitHub Actions obtain short-lived credentials via OIDC (no access keys).
 */
export class GithubOidcStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubOidcStackProps) {
    super(scope, id, props);

    const providerArn =
      props.existingProviderArn ??
      new iam.OidcProviderNative(this, 'GithubProvider', {
        url: 'https://token.actions.githubusercontent.com',
        clientIds: ['sts.amazonaws.com'],
      }).oidcProviderArn;

    const role = new iam.Role(this, 'GithubDeployRole', {
      roleName: 'github-actions-aws-practice-deploy',
      assumedBy: new iam.WebIdentityPrincipal(providerArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `repo:${props.githubRepo}:environment:${props.environment ?? 'dev'}`,
        },
      }),
      description: 'Assumed by GitHub Actions; can only assume CDK bootstrap roles',
    });

    // Least privilege: the actual deployment is done by the roles `cdk bootstrap` created.
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
    );

    new CfnOutput(this, 'DeployRoleArn', { value: role.roleArn });
  }
}
