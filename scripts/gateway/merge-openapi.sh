#!/bin/bash
# Merge multiple service OpenAPI specs into unified API Gateway spec
# Usage: ./merge-openapi.sh output.yaml

set -euo pipefail

OUTPUT_FILE="${1:-out/gateway.yaml}"
SERVICES_DIR="services"

mkdir -p "$(dirname "$OUTPUT_FILE")"

echo "🔍 扫描服务 OpenAPI 规范..."

services=()
while IFS= read -r spec_path; do
  services+=("$spec_path")
done < <(find "$SERVICES_DIR" -maxdepth 2 -name "openapi.yaml" -o -name "openapi.json" | sort)

if [ ${#services[@]} -eq 0 ]; then
  echo "⚠️  未在 $SERVICES_DIR 下找到任何 OpenAPI 规范" >&2
  exit 1
fi

echo "📋 共检测到 ${#services[@]} 个服务规范"

get_service_name() {
  basename "$(dirname "$1")"
}

get_service_url() {
  local service_name="$1"
  local region="${REGION:-asia-northeast1}"
  local env_suffix="${ENV:+\-$ENV}"

  # 先尝试基础服务名
  local url=$(gcloud run services describe "$service_name" \
    --region "$region" \
    --platform managed \
    --format='value(status.url)' 2>/dev/null || echo "")

  # 如果找不到，且设置了ENV，尝试带环境后缀的服务名
  if [ -z "$url" ] && [ -n "${ENV:-}" ]; then
    url=$(gcloud run services describe "${service_name}-${ENV}" \
      --region "$region" \
      --platform managed \
      --format='value(status.url)' 2>/dev/null || echo "")
  fi

  echo "$url"
}

declare -a service_args

for spec_file in "${services[@]}"; do
  service_name=$(get_service_name "$spec_file")
  service_url=$(get_service_url "$service_name")
  if [ -z "$service_url" ]; then
    echo "⚠️  未找到服务 '$service_name' 的 Cloud Run URL，跳过" >&2
    continue
  fi
  echo "✅ $service_name → $service_url"
  service_args+=("--service=${spec_file}::${service_name}::${service_url}")
done

if [ ${#service_args[@]} -eq 0 ]; then
  echo "❌ 未能收集到任何服务 URL" >&2
  exit 1
fi

# Check if Gateway Middleware should be used as unified backend
GATEWAY_MIDDLEWARE_ARGS=""
if [ "${USE_GATEWAY_MIDDLEWARE:-false}" = "true" ]; then
  echo "ℹ️  检测到 USE_GATEWAY_MIDDLEWARE=true，查询 Gateway Middleware URL..."
  GATEWAY_SERVICE_NAME="gateway-middleware"
  if [ -n "${ENV:-}" ] && [ "$ENV" != "prod" ]; then
    GATEWAY_SERVICE_NAME="${GATEWAY_SERVICE_NAME}-${ENV}"
  fi

  GATEWAY_MIDDLEWARE_URL=$(get_service_url "$GATEWAY_SERVICE_NAME")
  if [ -z "$GATEWAY_MIDDLEWARE_URL" ]; then
    echo "⚠️  未找到 Gateway Middleware 服务，回退到直连模式" >&2
  else
    echo "✅ Gateway Middleware URL: $GATEWAY_MIDDLEWARE_URL"
    GATEWAY_MIDDLEWARE_ARGS="--gateway-middleware-url=${GATEWAY_MIDDLEWARE_URL}"
  fi
fi

OAS3_TMP=$(mktemp)
SWAGGER_TMP=$(mktemp)
GO_CACHE_DIR=$(mktemp -d)
trap 'rm -f "$OAS3_TMP" "$SWAGGER_TMP"; rm -rf "$GO_CACHE_DIR"' EXIT

export GOCACHE="$GO_CACHE_DIR"

python3 "$(dirname "$0")/merge_openapi.py" \
  --output "$OAS3_TMP" \
  --project "${PROJECT_ID:?PROJECT_ID required}" \
  ${GATEWAY_MIDDLEWARE_ARGS} \
  "${service_args[@]}"

(cd scripts/gateway/oasconvert && GO111MODULE=on GOWORK=off go run . \
  --in "$OAS3_TMP" \
  --out "$SWAGGER_TMP")

mv "$SWAGGER_TMP" "$OUTPUT_FILE"

echo "✅ 已生成网关规范: $OUTPUT_FILE"
echo "📊 预览前 50 行:"
head -n 50 "$OUTPUT_FILE"
