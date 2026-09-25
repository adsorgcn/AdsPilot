#!/usr/bin/env bash
# 看中转是否活着。用法：./status.sh https://go.example.com
set -euo pipefail
base="${1:-}"
if [ -z "$base" ]; then echo "usage: status.sh https://go.example.com"; exit 1; fi
curl -sS -m 10 "$base/health"
echo
