#!/bin/bash

# INFRA-007: 配置 Cloud Build（前端构建）
# Google-Monetize Cloud Build 配置脚本

set -e

echo "🔨 Google-Monetize Cloud Build 配置"
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

# 启用 Cloud Build API
echo "🔧 启用 Cloud Build API..."
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID
gcloud services enable artifactregistry.googleapis.com --project=$PROJECT_ID
echo "✅ Cloud Build API 已启用"
echo ""

# 配置参数
REGION="asia-northeast1"
SERVICE_ACCOUNT="codex-dev@${PROJECT_ID}.iam.gserviceaccount.com"
ARTIFACT_REGISTRY="gm-services"

# 检查 Artifact Registry
echo "🔍 检查 Artifact Registry..."
if gcloud artifacts repositories describe $ARTIFACT_REGISTRY \
  --location=$REGION \
  --project=$PROJECT_ID &>/dev/null; then
  echo "✅ Artifact Registry 已存在: $ARTIFACT_REGISTRY"
else
  echo "📝 创建 Artifact Registry..."
  gcloud artifacts repositories create $ARTIFACT_REGISTRY \
    --repository-format=docker \
    --location=$REGION \
    --description="Google-Monetize 服务镜像仓库" \
    --project=$PROJECT_ID
  echo "✅ Artifact Registry 已创建"
fi
echo ""

# 配置 Cloud Build 服务账号权限
echo "🔐 配置 Cloud Build 服务账号权限..."

CLOUD_BUILD_SA="${PROJECT_ID}@cloudbuild.gserviceaccount.com"

# 授予 Service Account User 权限
echo "🔓 授予 Service Account User 权限..."
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --project=$PROJECT_ID 2>/dev/null || echo "  权限已存在或授予失败（可能已有权限）"

# 授予 Cloud Run Admin 权限
echo "🔓 授予 Cloud Run Admin 权限..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin" 2>/dev/null || echo "  权限已存在或授予失败（可能已有权限）"

# 授予 Secret Manager Accessor 权限
echo "🔓 授予 Secret Manager Accessor 权限..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor" 2>/dev/null || echo "  权限已存在或授予失败（可能已有权限）"

echo "✅ Cloud Build 服务账号权限已配置"
echo ""

# 检查构建配置文件
echo "🔍 检查构建配置文件..."
BUILD_CONFIGS=(
  "deployments/cloudbuild/build-frontend-docker.yaml"
  "deployments/cloudbuild/build-offer-docker.yaml"
  "deployments/cloudbuild/build-billing-docker.yaml"
  "deployments/cloudbuild/build-siterank-docker.yaml"
)

for config in "${BUILD_CONFIGS[@]}"; do
  if [ -f "$config" ]; then
    echo "  ✅ $config"
  else
    echo "  ⚠️  $config (不存在)"
  fi
done
echo ""

# 创建 Cloud Build 日志存储桶
LOGS_BUCKET="gm-build-logs-${REGION}"
echo "🔍 检查 Cloud Build 日志存储桶..."
if gsutil ls -b "gs://${LOGS_BUCKET}" &>/dev/null; then
  echo "✅ 日志存储桶已存在: gs://${LOGS_BUCKET}"
else
  echo "📝 创建日志存储桶..."
  gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION "gs://${LOGS_BUCKET}/"
  echo "✅ 日志存储桶已创建"
fi
echo ""

# 测试构建（可选）
echo "🧪 测试构建配置..."
echo "提示：可以手动触发构建测试"
echo ""
echo "示例 - 构建 Frontend (Preview):"
echo "  gcloud builds submit \\"
echo "    --config=deployments/cloudbuild/build-frontend-docker.yaml \\"
echo "    --substitutions=_IMAGE=\"${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}/frontend:preview-test\",_SITE_URL=\"https://www.urlchecker.dev\" \\"
echo "    --project=$PROJECT_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cloud Build 配置完成！"
echo ""
echo "📋 配置总结:"
echo "  - Artifact Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}"
echo "  - Cloud Build 服务账号: ${CLOUD_BUILD_SA}"
echo "  - 部署服务账号: ${SERVICE_ACCOUNT}"
echo "  - 日志存储: gs://${LOGS_BUCKET}"
echo "  - 区域: ${REGION}"
echo ""
echo "📝 GitHub Actions 集成:"
echo "  - 配置文件: .github/workflows/deploy-*.yml"
echo "  - 触发条件: 推送到 main (preview) 或 production 分支"
echo "  - 镜像标签策略:"
echo "    - Preview: preview-{commit_sha}, preview-latest"
echo "    - Production: prod-{commit_sha}, prod-latest"
echo ""
echo "🔍 查看构建历史:"
echo "  gcloud builds list --project=$PROJECT_ID --limit=10"
echo ""
echo "🔍 查看构建详情:"
echo "  gcloud builds describe BUILD_ID --project=$PROJECT_ID"
echo ""
echo "🔍 查看镜像列表:"
echo "  gcloud artifacts docker images list \\"
echo "    ${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY} \\"
echo "    --project=$PROJECT_ID"
echo ""
echo "📖 Cloud Build 文档:"
echo "  https://cloud.google.com/build/docs"
echo ""
echo "💡 提示："
echo "  - 构建触发器已通过 GitHub Actions 配置"
echo "  - 所有环境变量通过 Secret Manager 注入"
echo "  - 使用 E2_HIGHCPU_8 机器类型加速构建"
echo "  - 超时时间设置为 3600 秒（1小时）"
echo ""
