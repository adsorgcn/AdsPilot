#!/usr/bin/env bash
set -euo pipefail

# 通用回滚脚本（占位版）
# 说明：在 ClawCloud 或自管环境，请将此脚本集成到你的部署流水线中。
# 目标：
#  - 回滚到上一版本镜像 tag（例如 ghcr.io/ScientificInternet/Google-Monetize:prod-previous）
#  - 保持单镜像、对外仅暴露 3000 端口，Go 通过 /go 反代

IMAGE_TAG=${1:-"ghcr.io/ScientificInternet/Google-Monetize:prod-previous"}
CONTAINER_NAME=${CONTAINER_NAME:-"gm-app"}
PORT=${PORT:-3000}

echo "[Rollback] Target image: ${IMAGE_TAG}"
echo "[Rollback] Container: ${CONTAINER_NAME}"

echo "[Rollback] Pulling image..."
docker pull "${IMAGE_TAG}"

echo "[Rollback] Stopping existing container (if any)..."
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

echo "[Rollback] Starting container on port ${PORT} (single image, Next at 3000)..."
docker run -d --name "${CONTAINER_NAME}" \
  -p ${PORT}:3000 \
  --env-file .env \
  "${IMAGE_TAG}"

echo "[Rollback] Started. Verifying health..."
"$(dirname "$0")/health-check.sh" "http://127.0.0.1:${PORT}" || {
  echo "[Rollback] Health check failed." >&2
  exit 1
}

echo "[Rollback] Done."

