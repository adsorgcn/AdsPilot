#!/bin/bash
#
# Siterank服务部署脚本 - 使用Vertex AI Gemini API
#
set -e

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
SERVICE_NAME="siterank-preview"
REPO="gm-services"
IMAGE_TAG="preview-$(date +%Y%m%d-%H%M%S)"

echo "🚀 开始部署Siterank服务..."
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo "   Image Tag: $IMAGE_TAG"
echo ""

# 1. 从项目根目录构建镜像
echo "📦 步骤1: 构建Docker镜像..."
cd /Users/jason/Documents/Kiro/gm
gcloud builds submit \
  --config=services/siterank/cloudbuild.yaml \
  --substitutions=_IMAGE_TAG="$IMAGE_TAG" \
  --project=$PROJECT_ID

echo "✅ 镜像构建完成!"
echo ""

# 2. 部署到Cloud Run
echo "🚢 步骤2: 部署到Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/siterank:$IMAGE_TAG" \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --concurrency=80 \
  --max-instances=10 \
  --service-account=codex-dev@$PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID" \
  --project=$PROJECT_ID

echo "✅ 部署完成!"
echo ""

# 3. 验证部署
echo "🔍 步骤3: 验证部署..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
echo "   Service URL: $SERVICE_URL"

# 健康检查
echo "   检查健康状态..."
curl -s "$SERVICE_URL/health" || echo "   警告: 健康检查失败"

echo ""
echo "🎉 部署完成!"
echo ""
echo "📝 下一步:"
echo "   1. 查看日志: gcloud run services logs read $SERVICE_NAME --region=$REGION"
echo "   2. 查看metrics: gcloud run services describe $SERVICE_NAME --region=$REGION"
echo "   3. 测试评估API: curl -X POST $SERVICE_URL/api/v1/evaluations -H 'Content-Type: application/json' -d '{\"domain\":\"nike.com\"}'"
