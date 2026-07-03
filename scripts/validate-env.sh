#!/usr/bin/env bash
set -euo pipefail

echo "[ENV] Validating environment variables for Google-Monetize (Next + Go)"

MISSING=()
WARN=()

# Core (shared)
REQUIRED_CORE=(
  DATABASE_URL
  AUTH_SECRET
  NEXT_PUBLIC_DOMAIN
  NEXT_PUBLIC_DEPLOYMENT_ENV
)

# 普通必填项
for k in "${REQUIRED_CORE[@]}"; do
  v=${!k:-}
  if [[ -z "$v" ]]; then MISSING+=("$k"); fi
done

# Redis 实例：要求 REDIS_URL
if [[ -z "${REDIS_URL:-}" ]]; then
  MISSING+=("REDIS_URL")
fi

# Internal JWT (Next -> Go)
if [[ -z "${INTERNAL_JWT_PRIVATE_KEY:-}" ]]; then WARN+=("INTERNAL_JWT_PRIVATE_KEY (Next 签发内部JWT)"); fi
if [[ -z "${INTERNAL_JWT_PUBLIC_KEY:-}" ]]; then WARN+=("INTERNAL_JWT_PUBLIC_KEY (Go 验签公钥)"); fi

# Optional
[[ -z "${BACKEND_URL:-}" ]] && WARN+=("BACKEND_URL (默认 http://127.0.0.1:8080)")

echo "[ENV] Required (missing if any):"
for k in "${REQUIRED_CORE[@]}"; do
  if printf '%s\n' "${MISSING[@]:-}" | grep -qx "$k"; then
    echo " - $k : MISSING"
  else
    echo " - $k : OK"
  fi
done

if ((${#MISSING[@]})); then
  echo "[ENV] Missing required variables:" >&2
  printf ' - %s\n' "${MISSING[@]}" >&2
  exit 1
fi

echo "[ENV] Warnings (recommended to set):"
for k in "${WARN[@]:-}"; do
  echo " - $k"
done

echo "[ENV] Validation passed."
