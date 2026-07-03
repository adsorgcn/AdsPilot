#!/usr/bin/env bash
set -euo pipefail

cat <<'MSG'
[deprecated] scripts/update-supabase-secrets.sh 已废弃。

请改用统一的环境变量管理流程：
  1. 在 configs/environment/variables.json 中维护变量清单；
  2. 运行 python scripts/env/audit_secrets.py --project <PROJECT_ID> 审计 Secret；
  3. （可选）通过 scripts/env/export-secrets.sh 导出最新变量或在部署时使用 --update-secrets。

本脚本不会对 Secret Manager 做任何修改。
MSG
