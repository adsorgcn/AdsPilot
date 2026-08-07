# Adscenter 服务

AdsPilot 的核心服务:Google Ads 账户管理、批量广告操作(校验/执行/审计/回滚)、
诊断与优化建议、OAuth 授权。

## 本地运行(唯一支持的方式)

```powershell
# 仓库根目录,凭证放 .env(模板见根目录 .env.example)
.\scripts\dev-local.ps1
```

- `ADSPILOT_LOCAL=1` 时绑定 127.0.0.1:8080,回环请求自动获得 `local` 用户身份。
- `DATABASE_URL` 未设置时自动启动内嵌 PostgreSQL(数据在 `~/.adspilot/pg`),
  迁移见 `internal/migrations/local`。
- Google Ads 授权走回环 OAuth(Desktop 客户端 + PKCE):
  `GET /api/v1/adscenter/oauth/url` 拿链接,浏览器同意后 refresh token 存进
  `~/.adspilot/credentials.json`。详见 `docs/local-auth.md`。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `GOOGLE_ADS_OAUTH_CLIENT_ID` / `GOOGLE_ADS_OAUTH_CLIENT_SECRET` | Desktop 类型 OAuth 客户端 |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API 开发者令牌 |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | MCC(经理账号)CID,纯数字 |
| `ADS_MUTATE_LIVE` | `true` 才真正写 Google Ads,否则一律 validateOnly |
| `PORT` | 默认 8080 |

## 批量操作类型

`ADJUST_CPC`、`ADJUST_BUDGET`、`ADD_NEGATIVE_KEYWORDS`、`REMOVE_NEGATIVE_KEYWORDS`、
`PAUSE_KEYWORDS`、`ENABLE_KEYWORDS`、`SET_AD_SCHEDULES`、`SET_TARGET_CPA`、
`SET_TARGET_ROAS`,以及广告/广告组/系列的暂停与启用。
真实变更路径需要 `-tags ads_live` 构建(见 `internal/executor/executor_live.go`)。

## 构建与测试

```bash
# 独立构建(与 CI 一致)
GOWORK=off go mod tidy && go build ./... && go test ./...
```

OpenAPI 规范源在 `specs/openapi/adscenter.yaml`,改动后执行
`scripts/openapi/gen-go-stubs.sh adscenter` 重新生成 `internal/oapi`,
本目录的 `openapi.yaml` 只是镜像。
