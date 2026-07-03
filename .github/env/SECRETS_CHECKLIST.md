# ClawCloud 部署密钥检查清单

## 必需的密钥（请在 GitHub 仓库设置中配置）

### 应用配置
- `PROD_DOMAIN`: 生产环境域名
- `PROD_BASE_URL`: 生产环境基础 URL
- `PREVIEW_DOMAIN`: Preview 环境域名
- `PREVIEW_BASE_URL`: Preview 环境基础 URL

### Google Ads API
- `PROD_GOOGLE_CLIENT_ID`: 生产环境 Google 客户端 ID
- `PROD_GOOGLE_CLIENT_SECRET`: 生产环境 Google 客户端密钥
- `PROD_GOOGLE_DEVELOPER_TOKEN`: 生产环境 Google 开发者令牌
- `PROD_GOOGLE_REFRESH_TOKEN`: 生产环境 Google 刷新令牌
- `PREVIEW_GOOGLE_CLIENT_ID`: Preview 环境 Google 客户端 ID
- `PREVIEW_GOOGLE_CLIENT_SECRET`: Preview 环境 Google 客户端密钥
- `PREVIEW_GOOGLE_DEVELOPER_TOKEN`: Preview 环境 Google 开发者令牌
- `PREVIEW_GOOGLE_REFRESH_TOKEN`: Preview 环境 Google 刷新令牌

### SimilarWeb API
- `PROD_SIMILARWEB_API_KEY`: 生产环境 SimilarWeb API 密钥
- `PREVIEW_SIMILARWEB_API_KEY`: Preview 环境 SimilarWeb API 密钥

### 数据库
- `PROD_DATABASE_URL`: 生产环境数据库 URL
- `PREVIEW_DATABASE_URL`: Preview 环境数据库 URL

### 其他服务
- `SLACK_WEBHOOK_URL`: Slack 通知 Webhook（可选）
- `WEBHOOK_URL`: 通用 Webhook URL（可选）

## 配置步骤

1. 访问: https://github.com/ScientificInternet/url-batch-checker/settings/secrets/actions
2. 点击 "New repository secret"
3. 按照上面的清单逐一添加密钥
4. 确保所有必需的密钥都已配置

## 验证配置

运行以下命令验证配置：
```bash
gh secret list
```
