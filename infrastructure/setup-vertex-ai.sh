#!/bin/bash

# INFRA-002: 配置 Vertex AI 服务账号
# Google-Monetize Vertex AI 配置脚本

set -e

echo "🤖 Google-Monetize Vertex AI 配置"
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

# 启用 Vertex AI API
echo "🔧 启用 Vertex AI API..."
gcloud services enable aiplatform.googleapis.com --project=$PROJECT_ID
echo "✅ Vertex AI API 已启用"
echo ""

# 配置 Vertex AI 位置
VERTEX_AI_LOCATION=${VERTEX_AI_LOCATION:-"us-central1"}
echo "📍 Vertex AI 位置: $VERTEX_AI_LOCATION"
echo ""

# 配置 Siterank Service Account
SITERANK_SA="siterank@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🔍 检查 siterank Service Account..."
if ! gcloud iam service-accounts describe $SITERANK_SA --project=$PROJECT_ID &>/dev/null; then
  echo "📝 创建 siterank Service Account..."
  gcloud iam service-accounts create siterank \
    --display-name="Siterank Service Account" \
    --description="Service account for siterank service to access Vertex AI" \
    --project=$PROJECT_ID
  echo "✅ siterank Service Account 已创建"
else
  echo "✅ siterank Service Account 已存在"
fi
echo ""

# 授予 Vertex AI User 权限
echo "🔐 授予 Vertex AI 权限..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SITERANK_SA}" \
  --role="roles/aiplatform.user" \
  --condition=None

echo "✅ Vertex AI User 权限已授予"
echo ""

# 授予 Storage Object Viewer 权限（用于访问模型）
echo "🔐 授予 Storage Object Viewer 权限..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SITERANK_SA}" \
  --role="roles/storage.objectViewer" \
  --condition=None

echo "✅ Storage Object Viewer 权限已授予"
echo ""

# 测试 Vertex AI 访问
echo "🧪 测试 Vertex AI 访问..."
echo "📝 尝试列出可用的模型..."

# 注意：这个命令需要 gcloud 认证，在 Cloud Run 上会自动使用 Service Account
gcloud ai models list \
  --region=$VERTEX_AI_LOCATION \
  --project=$PROJECT_ID \
  --limit=5 2>/dev/null && echo "✅ Vertex AI 访问测试成功" || echo "⚠️  Vertex AI 访问测试失败（可能需要等待权限生效）"

echo ""

# 配置环境变量建议
echo "📋 Siterank Service 需要的环境变量:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "GCP_PROJECT_ID=${PROJECT_ID}"
echo "VERTEX_AI_LOCATION=${VERTEX_AI_LOCATION}"
echo "GEMINI_MODEL=gemini-1.5-flash"
echo ""

# Cloud Run 部署命令示例
echo "📋 Cloud Run 部署命令示例:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat <<EOF
gcloud run deploy siterank \\
  --image gcr.io/${PROJECT_ID}/siterank:latest \\
  --platform managed \\
  --region ${VERTEX_AI_LOCATION} \\
  --service-account ${SITERANK_SA} \\
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},VERTEX_AI_LOCATION=${VERTEX_AI_LOCATION},GEMINI_MODEL=gemini-1.5-flash" \\
  --no-allow-unauthenticated
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Vertex AI 配置完成！"
echo ""
echo "📋 配置总结:"
echo "  - Vertex AI API: 已启用"
echo "  - Service Account: ${SITERANK_SA}"
echo "  - 权限: aiplatform.user, storage.objectViewer"
echo "  - 位置: ${VERTEX_AI_LOCATION}"
echo "  - 推荐模型: gemini-1.5-flash"
echo ""
echo "📖 Vertex AI Gemini 模型文档:"
echo "  https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini"
echo ""
echo "🔍 查看 Service Account 权限:"
echo "  gcloud projects get-iam-policy $PROJECT_ID \\"
echo "    --flatten=\"bindings[].members\" \\"
echo "    --filter=\"bindings.members:${SITERANK_SA}\""
echo ""
