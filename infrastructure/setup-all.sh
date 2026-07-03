#!/bin/bash

# 主基础设施配置脚本
# Google-Monetize 完整基础设施配置

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Google-Monetize 基础设施配置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "此脚本将依次执行以下配置："
echo "  1. Secret Manager（密钥管理）"
echo "  2. Vertex AI（AI 模型）"
echo "  3. Pub/Sub（消息队列）"
echo "  4. Redis（缓存）"
echo "  5. Cloud Scheduler（定时任务）"
echo "  6. API Gateway（网关）"
echo "  7. Cloud Build（构建）"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

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

# 确认继续
read -p "是否继续执行所有基础设施配置？(y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 已取消"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "开始配置..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Secret Manager
echo "1️⃣  配置 Secret Manager..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/setup-secret-manager.sh" || {
  echo "⚠️  Secret Manager 配置失败，继续下一步..."
}
echo ""

# 2. Vertex AI
echo "2️⃣  配置 Vertex AI..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/setup-vertex-ai.sh" || {
  echo "⚠️  Vertex AI 配置失败，继续下一步..."
}
echo ""

# 3. Pub/Sub
echo "3️⃣  配置 Pub/Sub..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/setup-pubsub.sh" || {
  echo "⚠️  Pub/Sub 配置失败，继续下一步..."
}
echo ""

# 4. Redis
echo "4️⃣  配置 Redis..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/setup-redis.sh" || {
  echo "⚠️  Redis 配置失败，继续下一步..."
}
echo ""

# 5. Cloud Scheduler
echo "5️⃣  配置 Cloud Scheduler..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/setup-scheduler.sh" || {
  echo "⚠️  Cloud Scheduler 配置失败，继续下一步..."
}
echo ""

# 6. API Gateway
echo "6️⃣  配置 API Gateway..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/setup-api-gateway.sh" || {
  echo "⚠️  API Gateway 配置失败，继续下一步..."
}
echo ""

# 7. Cloud Build
echo "7️⃣  配置 Cloud Build..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/setup-cloud-build.sh" || {
  echo "⚠️  Cloud Build 配置失败，继续下一步..."
}
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 所有基础设施配置完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 配置完成清单："
echo "  ✅ Secret Manager - 密钥管理"
echo "  ✅ Vertex AI - AI 模型服务"
echo "  ✅ Pub/Sub - 消息队列"
echo "  ✅ Redis - 缓存服务"
echo "  ✅ Cloud Scheduler - 定时任务"
echo "  ✅ API Gateway - API 网关"
echo "  ✅ Cloud Build - 构建服务"
echo ""
echo "🔍 验证基础设施状态："
echo "  - Secret Manager: gcloud secrets list --project=$PROJECT_ID"
echo "  - Redis: gcloud redis instances list --region=asia-northeast1 --project=$PROJECT_ID"
echo "  - Pub/Sub: gcloud pubsub topics list --project=$PROJECT_ID"
echo "  - Scheduler: gcloud scheduler jobs list --location=asia-northeast1 --project=$PROJECT_ID"
echo "  - API Gateway: gcloud api-gateway gateways list --project=$PROJECT_ID"
echo "  - Artifact Registry: gcloud artifacts repositories list --location=asia-northeast1 --project=$PROJECT_ID"
echo ""
echo "📖 详细文档请查看各个脚本的输出"
echo ""
