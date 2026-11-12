import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/api-stack';

const synth = (enableWaf: boolean) =>
  Template.fromStack(
    new ApiStack(new App(), 'Test', {
      stage: 'test',
      enableWaf,
      env: { account: '123456789012', region: 'ap-northeast-1' },
    }),
  );

describe('ApiStack', () => {
  it('creates a cost-optimised arm64 Lambda', () => {
    synth(false).hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      MemorySize: 128,
    });
  });

  it('keeps logs for 7 days', () => {
    synth(false).hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 7 });
  });

  it('throttles the API stage', () => {
    synth(false).hasResourceProperties('AWS::ApiGateway::Stage', {
      MethodSettings: Match.arrayWith([
        Match.objectLike({ ThrottlingRateLimit: 10, ThrottlingBurstLimit: 20 }),
      ]),
    });
  });

  it('omits WAF when disabled', () => {
    synth(false).resourceCountIs('AWS::WAFv2::WebACL', 0);
  });

  it('creates WAF with common rules + rate limit when enabled', () => {
    const t = synth(true);
    t.resourceCountIs('AWS::WAFv2::WebACLAssociation', 1);
    t.hasResourceProperties('AWS::WAFv2::WebACL', {
      Scope: 'REGIONAL',
      Rules: Match.arrayWith([
        Match.objectLike({ Name: 'AWSManagedRulesCommonRuleSet' }),
        Match.objectLike({
          Name: 'RateLimitPerIp',
          Statement: { RateBasedStatement: Match.objectLike({ Limit: 100, AggregateKeyType: 'IP' }) },
        }),
      ]),
    });
  });
});
