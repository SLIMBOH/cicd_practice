# aws-practice

CDK (TypeScript) + Lambda + API Gateway (REST) + WAF + GitHub Actions 的 CI/CD 练习项目。

## 结构

```
bin/app.ts                  CDK 入口（context: stage / enableWaf / githubRepo）
lib/api-stack.ts            Lambda (arm64, 128MB) + REST API（stage 限流）
lib/waf-construct.ts        WAF：AWS Common Rule Set + IP 限流（L1 构造）
lib/github-oidc-stack.ts    GitHub Actions 用的 OIDC Provider + 部署 Role（手动部署一次）
src/handlers/hello.ts       Lambda 业务代码
test/                       Jest 单元测试 + CDK assertions
.github/workflows/ci.yml    PR：lint / typecheck / test / synth（不访问 AWS）
.github/workflows/deploy.yml main：CI → OIDC → cdk diff → deploy → 冒烟测试
```

## 本地命令

```bash
npm ci
npm run lint && npm run typecheck && npm test
npx cdk synth                      # 不带 WAF
npx cdk synth -c enableWaf=true    # 带 WAF
```

## 首次搭建步骤

1. **AWS 准备**
   - 用 IAM Identity Center 用户登录：`aws sso login --profile <p>`，之后的命令都加 `--profile <p>`
   - 在 Billing 里创建 AWS Budgets，超过 $5 发邮件提醒
2. **CDK bootstrap**（每个账号和 Region 一次）
   ```bash
   npx cdk bootstrap aws://058264388691/ap-northeast-1
   ```
3. **本地部署验证**
   ```bash
   npx cdk deploy AwsPractice-dev
   curl "https://irbaod44wg.execute-api.ap-northeast-1.amazonaws.com/dev/hello?name=me"
   ```
4. **创建 GitHub OIDC Role**（一次）
   ```bash
   npx cdk deploy GithubOidc -c githubRepo=SLIMBOH/cicd_practice
   # 如果账号里已经有 token.actions.githubusercontent.com 的 Provider：
   #   追加 -c existingOidcProviderArn=arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com
   ```
   记下输出的 `DeployRoleArn`。
5. **GitHub 仓库设置**（Settings → Secrets and variables → Actions → Variables）
   | Variable | 值 |
   |---|---|
   | `AWS_DEPLOY_ROLE_ARN` | 第 4 步的 DeployRoleArn |
   | `AWS_REGION` | `ap-northeast-1` |
   | `ENABLE_WAF` | `false`（平时）/ `true` |

   在 Settings → Environments 中创建 `dev`（可选：设置 Required reviewers 实现手动审批）。
   建议在 Branch protection 中把 `CI / check` 设为必须通过。
6. **推送代码**
   ```bash
   git init && git add . && git commit -m "init"
   git remote add origin https://github.com/SLIMBOH/cicd_practice.git
   git push -u origin main
   ```

## WAF 验证

1. 在 **GitHub 仓库页面**的 Actions → Deploy → Run workflow 中勾选 `enableWaf` 并运行（手动触发 `workflow_dispatch`）
2. 部署完成后，从 Smoke test 步骤的日志中复制 API URL，在**本地终端**执行：

```bash
URL=<ApiUrl>
curl -i "$URL?name=<script>alert(1)</script>"            # → 403（Common Rule Set 拦截）
for i in $(seq 1 150); do curl -s -o /dev/null -w "%{http_code}\n" "$URL"; done | sort | uniq -c
# 超过 100 次后返回 403（限流规则判定最多会延迟几十秒）
```

> 注意：下一次 push 时如果 `ENABLE_WAF` 不是 `true`，WAF 会被删除，用来避免忘记关闭而持续产生费用。

## 费用与清理

- 不带 WAF：基本在免费额度内
- 带 WAF：约 $7/月（按小时折算）
- 练习结束后执行：
  ```bash
  npx cdk destroy AwsPractice-dev
  npx cdk destroy GithubOidc -c githubRepo=SLIMBOH/cicd_practice
  ```
  CDKToolkit stack（bootstrap 创建的 S3 和 ECR）在 CloudFormation 中删除时，要先把 S3 bucket 清空。
