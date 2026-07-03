#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/gofly_admin_v3"
CONFIG_PATH="${1:-$APP_DIR/config.yaml}"
PORT="${PORT:-8080}"

if [ ! -f "$APP_DIR/server" ]; then
  echo "未找到后端可执行文件，先执行构建..."
  "$ROOT_DIR/scripts/admin-build.sh"
fi

echo "使用配置: $CONFIG_PATH (若不存在将使用环境变量配置)"
cd "$APP_DIR"
exec ./server -config="$CONFIG_PATH" -port="$PORT"

