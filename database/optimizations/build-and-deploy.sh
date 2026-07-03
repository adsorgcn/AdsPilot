#!/bin/bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
IMAGE_NAME="asia-northeast1-docker.pkg.dev/${PROJECT_ID}/gm-services/db-index-migrator:latest"
JOB_NAME="apply-performance-indexes"

echo "========================================="
echo "  构建并部署索引迁移Job"
echo "========================================="

# 1. 构建镜像
echo "步骤 1/3: 构建Docker镜像..."
docker build -t "$IMAGE_NAME" -f Dockerfile .

# 2. 推送镜像
echo "步骤 2/3: 推送镜像到Artifact Registry..."
docker push "$IMAGE_NAME"

# 3. 创建/更新Cloud Run Job
echo "步骤 3/3: 创建Cloud Run Job..."
gcloud run jobs create "$JOB_NAME" \
  --image="$IMAGE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest \
  --vpc-connector=cr-conn-default-ane1 \
  --vpc-egress=private-ranges-only \
  --service-account=codex-dev@${GCP_PROJECT_ID}.iam.gserviceaccount.com \
  --max-retries=0 \
  --task-timeout=10m \
  || \
gcloud run jobs update "$JOB_NAME" \
  --image="$IMAGE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID"

echo ""
echo "========================================="
echo "  ✅ 部署完成！"
echo "========================================="
echo ""
echo "执行迁移命令:"
echo "  gcloud run jobs execute $JOB_NAME --region=$REGION --project=$PROJECT_ID --wait"
