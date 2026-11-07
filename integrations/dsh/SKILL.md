---
name: adspilot
description: "让 DSH 用 AdsPilot 做本机自检，并用 dry-run 验证广告联盟投放的首轮报告。"
version: 2.1.2
author: ilang-ai
license: MIT
metadata:
  hermes:
    tags: [adspilot, advertising, affiliate, dry-run]
---

# AdsPilot

在 DSH 创造模式粘贴下面一句，把尖括号部分换成克隆后的本机绝对路径。

```text
把 https://github.com/adsorgcn/AdsPilot 克隆到我的 DSH 记忆仓库旁边，读 AdsPilot 的 AGENTS.md，先自检，再按使用方法走，然后把 <AdsPilot 绝对路径>/core/agent/mcp_server.py 这个 stdio MCP 服务器配置到当前 profile，命名为 adspilot，立即启用它的工具。
```

## 三把钥匙从哪里拿

- Cloudflare：`CF_API_TOKEN`，或 `CF_EMAIL` 与 `CF_GLOBAL_API_KEY`。[Cloudflare 令牌页](https://dash.cloudflare.com/profile/api-tokens)
- Google Ads：`GOOGLE_ADS_CLIENT_ID`、`GOOGLE_ADS_CLIENT_SECRET`、`GOOGLE_ADS_REFRESH_TOKEN`、`GOOGLE_ADS_CUSTOMER_ID`；经理账号按需填写 `GOOGLE_ADS_LOGIN_CUSTOMER_ID`，访问方式需要时填写 `GOOGLE_ADS_DEVELOPER_TOKEN`。[Google Ads OAuth 设置](https://developers.google.com/google-ads/api/docs/oauth/overview)
- CJ：`CJ_ACCESS_TOKEN`、`CJ_PUBLISHER_ID`、`CJ_WEBSITE_ID`。[CJ 令牌页](https://developers.cj.com/account/personal-access-tokens) · [CJ 推广媒介](https://accounts.cj.com/promotional-properties)

## 验收与证据

在 AdsPilot 根目录按循环使用方法运行首轮 dry-run。退出码为 0，且本轮 `runs/<id>/report.json` 存在，才记作样例通过。沿用 README「走到哪了」的证据级别：自测用无凭据样例；只读实测需实际访问；投放或写入实测需实际执行并留下脱敏结果。首轮 dry-run 只支持样例这一档。
