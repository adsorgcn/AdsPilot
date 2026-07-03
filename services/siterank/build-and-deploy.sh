#!/bin/bash
#
# Siterank服务优化构建和部署脚本
# 只上传必需的文件,减少构建时间和成本
#
set -e

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
SERVICE_NAME="siterank-preview"
REPO="gm-services"
IMAGE_NAME="siterank"
IMAGE_TAG="preview-$(date +%Y%m%d-%H%M%S)"
IMAGE_FULL="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$IMAGE_NAME:$IMAGE_TAG"

echo "🚀 Siterank服务构建和部署"
echo "========================================="
echo "Project: $PROJECT_ID"
echo "Image: $IMAGE_FULL"
echo "Service: $SERVICE_NAME"
echo ""

# 准备构建上下文 - 只包含必需文件
echo "📦 步骤1: 准备构建上下文..."
cd /Users/jason/Documents/Kiro/gm

# 创建临时目录
BUILD_DIR="/tmp/siterank-build-$(date +%s)"
mkdir -p $BUILD_DIR

# 复制必需的文件
echo "   复制Go源码..."
cp -r services/siterank $BUILD_DIR/
cp -r pkg $BUILD_DIR/
cp go.work $BUILD_DIR/ 2>/dev/null || true
cp go.work.sum $BUILD_DIR/ 2>/dev/null || true

# 清理不必要的文件
echo "   清理临时文件..."
find $BUILD_DIR -name "*.md" -delete
find $BUILD_DIR -name "*_test.go" -delete
find $BUILD_DIR -name "*.log" -delete
find $BUILD_DIR -name ".DS_Store" -delete
rm -rf $BUILD_DIR/services/siterank/scripts/*.json 2>/dev/null || true
rm -rf $BUILD_DIR/services/siterank/scripts/*.js 2>/dev/null || true
rm -rf $BUILD_DIR/services/siterank/scripts/*.go 2>/dev/null || true

# 显示构建上下文大小
BUILD_SIZE=$(du -sh $BUILD_DIR | cut -f1)
FILE_COUNT=$(find $BUILD_DIR -type f | wc -l | tr -d ' ')
echo "   构建上下文: $BUILD_SIZE ($FILE_COUNT 个文件)"
echo ""

# 构建镜像
echo "🔨 步骤2: 构建Docker镜像..."
gcloud builds submit $BUILD_DIR \
  --config=/Users/jason/Documents/Kiro/gm/services/siterank/cloudbuild-optimized.yaml \
  --substitutions="_IMAGE=$IMAGE_FULL" \
  --project=$PROJECT_ID \
  --region=$REGION

echo "✅ 镜像构建完成: $IMAGE_FULL"
echo ""

# 部署到Cloud Run
echo "🚢 步骤3: 部署到Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE_FULL \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --concurrency=80 \
  --max-instances=10 \
  --min-instances=0 \
  --service-account=codex-dev@$PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID" \
  --project=$PROJECT_ID \
  --quiet

echo "✅ 部署完成!"
echo ""

# 清理临时目录
rm -rf $BUILD_DIR
echo "🧹 清理临时文件: $BUILD_DIR"
echo ""

# 验证部署
echo "🔍 步骤4: 验证部署..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)")

echo "   Service URL: $SERVICE_URL"
echo "   健康检查: $SERVICE_URL/health"

sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health" || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ 健康检查成功 (HTTP $HTTP_CODE)"
else
  echo "   ⚠️  健康检查失败 (HTTP $HTTP_CODE)"
fi

echo ""
echo "========================================="
echo "🎉 部署完成!"
echo ""
echo "📝 快速链接:"
echo "   • Service: $SERVICE_URL"
echo "   • Logs: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/logs?project=$PROJECT_ID"
echo "   • Metrics: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/metrics?project=$PROJECT_ID"
echo ""
echo "🧪 测试命令:"
echo "   curl -X POST $SERVICE_URL/api/v1/evaluations \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"domain\":\"nike.com\",\"brand_name\":\"Nike\"}'"
