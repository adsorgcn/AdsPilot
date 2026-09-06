# Adscenter 服务

AdsPilot 的可选历史适配层，不是 Agent Skill 的安装依赖。
主产品见根目录 `skills/adspilot/`。下述本地运行仅供维护旧代码。

2026-09-06 安全修复：默认 stub 不再返回伪造执行结果；未完成的批量、回滚、
AB、MCC、预算转移等入口明确返回 501。`ads_live` 构建的 Google REST 基线更新
为 v25，但旧写入路径仍关闭，仅支持测试覆盖的只读/validate-only 适配能力。
单元测试通过不等于已接通真实 Google Ads 账户。

## 可选适配层本地开发

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
| `ADS_MUTATE_LIVE` | 历史配置保留；当前未完成的真实写入仍会明确失败 |
| `PORT` | 默认 8080 |

## 批量操作类型

`ADJUST_CPC`、`ADJUST_BUDGET`、`ADD_NEGATIVE_KEYWORDS`、`REMOVE_NEGATIVE_KEYWORDS`、
`PAUSE_KEYWORDS`、`ENABLE_KEYWORDS`、`SET_AD_SCHEDULES`、`SET_TARGET_CPA`、
`SET_TARGET_ROAS`,以及广告/广告组/系列的暂停与启用。
以上是历史操作模型，不是已可用功能清单。`-tags ads_live` 不会绕过当前写入封闭。

## 构建与测试

```bash
# 独立构建(与 CI 一致)
node scripts/verify-go.mjs --module services/adscenter
```

OpenAPI 规范源在 `specs/openapi/adscenter.yaml`,改动后执行
`scripts/openapi/gen-go-stubs.sh adscenter` 重新生成 `internal/oapi`,
本目录的 `openapi.yaml` 只是镜像。
