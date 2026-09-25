#!/usr/bin/env bash
# 部署中转到用户自己的 Cloudflare 账号。默认 dry-run；--apply 才真部署。
# 前提：wrangler 已登录（npx wrangler login，本人在浏览器里授权），wrangler.toml 已从 example 填好，EXPORT_KEY 已 secret put。
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f wrangler.toml ]; then echo "wrangler.toml 不存在：cp wrangler.toml.example wrangler.toml 然后填值"; exit 4; fi
if ! command -v npx >/dev/null 2>&1; then echo "需要 node/npx"; exit 4; fi
if [ "${1:-}" != "--apply" ]; then
  echo "dry-run: npx wrangler deploy --dry-run"
  npx --yes wrangler deploy --dry-run
  exit 0
fi
npx --yes wrangler deploy
