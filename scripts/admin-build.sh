#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/gofly_admin_v3/web"
APP_DIR="$ROOT_DIR/gofly_admin_v3"

echo "[1/2] 构建前端 (Vite) ..."
cd "$WEB_DIR"
PKG="npm"
if command -v pnpm >/dev/null 2>&1; then PKG="pnpm"; elif command -v yarn >/dev/null 2>&1; then PKG="yarn"; fi
if [ "$PKG" = "npm" ]; then npm install; else $PKG install; fi
$PKG run build

echo "[2/2] 构建后端 (Go) ..."
cd "$APP_DIR"
CGO_ENABLED=${CGO_ENABLED:-0} go build -o server cmd/server/main.go
echo "✅ 构建完成：$APP_DIR/server"

