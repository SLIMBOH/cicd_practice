import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { GithubOidcStack } from '../lib/github-oidc-stack';

describe('GithubOidcStack', () => {
  const t = Template.fromStack(
    new GithubOidcStack(new App(), 'Test', {
      githubRepo: 'octo/aws-practice',
      env: { account: '123456789012', region: 'ap-northeast-1' },
    }),
  );

  it('restricts trust to main branch of the repo', () => {
    t.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Condition: {
              StringEquals: Match.objectLike({
                'token.actions.githubusercontent.com:sub': 'repo:octo/aws-practice:ref:refs/heads/main',
              }),
            },
          }),
        ],
      },
    });
  });

  it('only allows assuming CDK bootstrap roles', () => {
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Resource: 'arn:aws:iam::123456789012:role/cdk-hnb659fds-*',
          },
        ],
      },
    });
  });
});
