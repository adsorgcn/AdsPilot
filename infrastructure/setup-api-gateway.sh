#!/bin/bash

# INFRA-006: 配置 API Gateway
# Google-Monetize API Gateway 配置脚本

set -e

echo "🌐 Google-Monetize API Gateway 配置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查是否已登录 GCP
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
  echo "❌ 未登录 GCP，请先运行: gcloud auth login"
  exit 1
fi

# 获取当前项目
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "❌ 未设置 GCP 项目，请先运行: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "📋 当前项目: $PROJECT_ID"
echo ""

# 启用 API Gateway API
echo "🔧 启用 API Gateway API..."
gcloud services enable apigateway.googleapis.com --project=$PROJECT_ID
gcloud services enable servicemanagement.googleapis.com --project=$PROJECT_ID
gcloud services enable servicecontrol.googleapis.com --project=$PROJECT_ID
echo "✅ API Gateway API 已启用"
echo ""

# 配置参数
REGION="asia-northeast1"
GATEWAY_ID_PREVIEW="gm-gw-preview"
GATEWAY_ID_PROD="gm-gw"

# 检查现有网关
echo "🔍 检查现有 API Gateway..."
if gcloud api-gateway gateways describe $GATEWAY_ID_PREVIEW --location=$REGION --project=$PROJECT_ID &>/dev/null; then
  echo "✅ Preview 网关已存在: $GATEWAY_ID_PREVIEW"
  GATEWAY_PREVIEW_URL=$(gcloud api-gateway gateways describe $GATEWAY_ID_PREVIEW \
    --location=$REGION \
    --project=$PROJECT_ID \
    --format="value(defaultHostname)")
  echo "   URL: https://${GATEWAY_PREVIEW_URL}"
else
  echo "⚠️  Preview 网关不存在，需要创建"
fi

if gcloud api-gateway gateways describe $GATEWAY_ID_PROD --location=$REGION --project=$PROJECT_ID &>/dev/null; then
  echo "✅ Production 网关已存在: $GATEWAY_ID_PROD"
  GATEWAY_PROD_URL=$(gcloud api-gateway gateways describe $GATEWAY_ID_PROD \
    --location=$REGION \
    --project=$PROJECT_ID \
    --format="value(defaultHostname)")
  echo "   URL: https://${GATEWAY_PROD_URL}"
else
  echo "⚠️  Production 网关不存在，需要创建"
fi

echo ""

# 生成 OpenAPI 配置
echo "📝 生成 OpenAPI 配置..."
echo "使用 merge-openapi.sh 脚本合并所有服务的 OpenAPI 规范"
echo ""

# 检查 merge-openapi.sh 脚本
MERGE_SCRIPT="scripts/gateway/merge-openapi.sh"
if [ ! -f "$MERGE_SCRIPT" ]; then
  echo "❌ 未找到 merge-openapi.sh 脚本: $MERGE_SCRIPT"
  exit 1
fi

echo "🔨 执行 OpenAPI 合并..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Preview 环境
echo "📋 生成 Preview 环境配置..."
export PROJECT_ID=$PROJECT_ID
export REGION=$REGION
bash "$MERGE_SCRIPT" "out/gateway.preview.yaml" || {
  echo "⚠️  Preview 配置生成失败（可能是服务尚未部署）"
}

# Production 环境
echo "📋 生成 Production 环境配置..."
bash "$MERGE_SCRIPT" "out/gateway.yaml" || {
  echo "⚠️  Production 配置生成失败（可能是服务尚未部署）"
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ API Gateway 配置完成！"
echo ""
echo "📋 配置总结:"
echo "  - Preview 网关: $GATEWAY_ID_PREVIEW"
if [ -n "${GATEWAY_PREVIEW_URL:-}" ]; then
  echo "    URL: https://${GATEWAY_PREVIEW_URL}"
fi
echo "  - Production 网关: $GATEWAY_ID_PROD"
if [ -n "${GATEWAY_PROD_URL:-}" ]; then
  echo "    URL: https://${GATEWAY_PROD_URL}"
fi
echo "  - 区域: $REGION"
echo ""
echo "📝 下一步操作:"
echo ""
echo "1️⃣  创建 API 配置 (Preview):"
echo "  gcloud api-gateway api-configs create gm-config-preview-\$(date +%Y%m%d-%H%M%S) \\"
echo "    --api=gm-api-preview \\"
echo "    --openapi-spec=out/gateway.preview.yaml \\"
echo "    --project=$PROJECT_ID \\"
echo "    --backend-auth-service-account=codex-dev@${PROJECT_ID}.iam.gserviceaccount.com"
echo ""
echo "2️⃣  更新网关 (Preview):"
echo "  gcloud api-gateway gateways update $GATEWAY_ID_PREVIEW \\"
echo "    --api=gm-api-preview \\"
echo "    --api-config=gm-config-preview-YYYYMMDD-HHMMSS \\"
echo "    --location=$REGION \\"
echo "    --project=$PROJECT_ID"
echo ""
echo "3️⃣  验证网关状态:"
echo "  gcloud api-gateway gateways describe $GATEWAY_ID_PREVIEW \\"
echo "    --location=$REGION \\"
echo "    --project=$PROJECT_ID"
echo ""
echo "🔍 查看所有网关:"
echo "  gcloud api-gateway gateways list --project=$PROJECT_ID"
echo ""
echo "🔍 查看 API 配置列表:"
echo "  gcloud api-gateway api-configs list --api=gm-api-preview --project=$PROJECT_ID"
echo ""
echo "📖 API Gateway 文档:"
echo "  https://cloud.google.com/api-gateway/docs"
echo ""
echo "💡 提示："
echo "  - API Gateway 配置更新需要 5-10 分钟生效"
echo "  - 使用 scripts/gateway/merge-openapi.sh 自动生成配置"
echo "  - 每次服务更新后需重新生成并部署 API 配置"
echo ""
