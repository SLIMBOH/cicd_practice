#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack';
import { GithubOidcStack } from '../lib/github-oidc-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
};

// Toggle with: cdk deploy -c enableWaf=true
const enableWafCtx = app.node.tryGetContext('enableWaf');
const enableWaf = enableWafCtx === true || enableWafCtx === 'true';
const stage = app.node.tryGetContext('stage') ?? 'dev';

const apiStack = new ApiStack(app, `AwsPractice-${stage}`, { stage, enableWaf, env });
cdk.Tags.of(apiStack).add('Project', 'aws-practice');

// One-time setup, deployed manually:
//   npx cdk deploy GithubOidc   (githubRepo / IDs are set in cdk.json context)
const githubRepo = app.node.tryGetContext('githubRepo');
if (githubRepo) {
  const oidcStack = new GithubOidcStack(app, 'GithubOidc', {
    githubRepo,
    githubOwnerId: app.node.tryGetContext('githubOwnerId')?.toString(),
    githubRepoId: app.node.tryGetContext('githubRepoId')?.toString(),
    existingProviderArn: app.node.tryGetContext('existingOidcProviderArn'),
    env,
  });
  cdk.Tags.of(oidcStack).add('Project', 'aws-practice');
}
