# scripts/

本地开发与验证脚本。云部署时代的脚本已全部清除(可从 git 历史找回)。

| 脚本 | 用途 |
| --- | --- |
| `dev-local.ps1` / `dev-local.sh` | 本地模式一键启动(自动加载仓库根 `.env`,设 `ADSPILOT_LOCAL=1`) |
| `verify-build.sh` | 全部 Go 服务独立构建验证(`GOWORK=off` + tidy,期望 11/11 通过) |
| `check-go-mod-tidy.sh` | 检查各模块 go.mod/go.sum 是否 tidy |
| `openapi/` | OpenAPI 工具:`gen-go-stubs.sh`(生成 `internal/oapi`)、`gen-ts-sdk.sh`(生成 TS 类型)、`sync-mirrors.sh`(同步服务内镜像)等。规范源在 `specs/openapi/*.yaml` |
| `security/` | `scan-secrets.sh`(pre-commit 凭证扫描)、`enable-hooks.sh`(启用 git hooks,`npm run prepare` 自动执行) |
