---
name: adspilot
description: "让 DSH 通过 adspilot 插件包与本机 mcp-adspilot 做自检、建站选品、OAuth/Preflight 与 dry-run，并保持广告联盟投放无人值守。"
version: 2.2.2
author: adsorgcn
homepage: https://ilang.ai
license: MIT
say:
  - SEM
  - 付费投流
metadata:
  hermes:
    tags: [adspilot, ilang, sem, advertising, affiliate, dry-run]
---

# AdsPilot（DSH 接入说明）

AdsPilot（[iLang](https://ilang.ai) 协议参考应用 · [DSH 插件指南](https://dsh.ilang.guide)）现在同时以仓库内置的 DSH 插件组合包（npm 包名 `adspilot`，带 `cordis.patch.yml`、`skills/sem.md` 与工程书 `BOOK.md`）和本机执行仓两种形态工作：

1. **启用工程书插件与触发口令**：在 DSH profile 中加入 `adspilot`（`cordis.patch.yml` 挂入 `id: adspilot`）。用户说出 **「SEM」** 或 **「付费投流」** 时加载 `sem` 技能，并通过 `adspilot_book` 按段读取工程书（`toc` → `head` → `M0_SETUP`..`M5_REPORT` → `tail`）。
2. **挂载本机执行仓与 MCP**：在 DSH 创造模式粘贴下句，把尖括号部分换成克隆后的本机绝对路径（推荐与 `dsh-memory` 同级，即 `../AdsPilot`）。

```text
把 https://github.com/adsorgcn/AdsPilot 克隆到我的 dsh-memory 同级目录，读 AdsPilot 的 AGENTS.md，先跑 core/agent/selfcheck.py 与 core/selfcheck/preflight.py，再按 core/agent/mcp_server.py 和 integrations/dsh/mcp.json 把 mcp-adspilot 配置到当前 profile，立即启用全部 39 个工具并用 judge.judge 样例核验。
```

## 凭据账本与开局前置

- **DSH 3.1 凭据账本**：三组平台凭据（Cloudflare、Google Ads、CJ 或 Impact）与可选通知 Webhook 存入用户自己的 DSH 凭据账本（`env/ledger.env` + `env/keys.env`，经本机 `tools/brain.py grant` 在启动任务或子进程时按需注入进程环境），或存入仓库外 `0600` 环境变量文件，绝不写进仓库、记忆、`config/` 或对话文本。
- Cloudflare：`CF_API_TOKEN`，或 `CF_EMAIL` 与 `CF_GLOBAL_API_KEY`。[Cloudflare 令牌页](https://dash.cloudflare.com/profile/api-tokens)
- Google Ads：`GOOGLE_ADS_CLIENT_ID`、`GOOGLE_ADS_CLIENT_SECRET`、`GOOGLE_ADS_REFRESH_TOKEN`、`GOOGLE_ADS_CUSTOMER_ID`；经理账号按需填写 `GOOGLE_ADS_LOGIN_CUSTOMER_ID`，过渡期或特定访问需要时填写 `GOOGLE_ADS_DEVELOPER_TOKEN`。缺双作用域 refresh token 时可由 Agent 运行 `plugins/traffic/google-ads/oauth_helper.py` 走 PKCE 回环一次性拿到 `adwords` + `datamanager` 双作用域。[Google Ads OAuth 设置](https://developers.google.com/google-ads/api/docs/oauth/overview)
- 联盟网络（单线起步）：CJ（`CJ_ACCESS_TOKEN`、`CJ_PUBLISHER_ID`、`CJ_WEBSITE_ID`）或 Impact（`IMPACT_ACCOUNT_SID`、`IMPACT_AUTH_TOKEN`）。[CJ 令牌页](https://developers.cj.com/account/personal-access-tokens) · [CJ 推广媒介](https://accounts.cj.com/promotional-properties)

## 验收、交接与证据

- **上线前总检**：离线执行 `python3 core/selfcheck/preflight.py`；放行外部试跑前带 `--apply` 实测 Google Ads 账户币种等于 `config.currency`、双 OAuth scope 及 Cloudflare `/health`、`/export`。
- **首轮 dry-run 与交接**：在 AdsPilot 根目录运行 `python3 core/loop/daily.py --dry-run`，退出码 `0` 且 `runs/<id>/report.json` 存在即通过离线首轮；再用 `python3 integrations/dsh/handoff.py --report runs/<id>/report.json --memory ../dsh-memory`（或 MCP `dsh.handoff`）向 `dsh-memory/handoff/CURRENT.md` 追加单行状态摘要。
- 沿用 README「走到哪了」的证据级别：离线用无凭据自测/样例，只读实测需实际访问，写入实测需实际执行并保留脱敏结果。

