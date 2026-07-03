#!/bin/bash
# Siterank服务部署脚本 - Preview环境
# 包含：运行测试 → 构建镜像 → 部署到Cloud Run

set -e  # 遇到错误立即退出

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
SERVICE_NAME="siterank-preview"
IMAGE_NAME="asia-northeast1-docker.pkg.dev/${PROJECT_ID}/gm-services/siterank"

echo "========================================="
echo "Siterank Preview环境部署"
echo "========================================="

# 1. 运行单元测试
echo ""
echo "步骤 1/4: 运行单元测试..."
gcloud builds submit \
  --config=test.cloudbuild.yaml \
  --project=${PROJECT_ID} \
  .

if [ $? -ne 0 ]; then
  echo "❌ 测试失败，停止部署"
  exit 1
fi

echo "✅ 测试通过"

# 2. 构建Docker镜像
echo ""
echo "步骤 2/4: 构建Docker镜像..."
gcloud builds submit \
  --tag=${IMAGE_NAME}:preview-latest \
  --project=${PROJECT_ID} \
  .

if [ $? -ne 0 ]; then
  echo "❌ 镜像构建失败"
  exit 1
fi

echo "✅ 镜像构建成功: ${IMAGE_NAME}:preview-latest"

# 3. 获取当前git commit SHA（用于标记版本）
GIT_SHA=$(git rev-parse --short HEAD)
echo "Git SHA: ${GIT_SHA}"

# 同时打上commit SHA标签
gcloud container images add-tag \
  ${IMAGE_NAME}:preview-latest \
  ${IMAGE_NAME}:preview-${GIT_SHA} \
  --quiet

# 4. 部署到Cloud Run
echo ""
echo "步骤 3/4: 部署到Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME}:preview-latest \
  --platform=managed \
  --region=${REGION} \
  --project=${PROJECT_ID} \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --concurrency=80 \
  --max-instances=10 \
  --min-instances=1 \
  --set-env-vars="ENVIRONMENT=preview" \
  --allow-unauthenticated \
  --quiet

if [ $? -ne 0 ]; then
  echo "❌ Cloud Run部署失败"
  exit 1
fi

# 5. 获取服务URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region=${REGION} \
  --project=${PROJECT_ID} \
  --format='value(status.url)')

echo ""
echo "========================================="
echo "✅ 部署成功！"
echo "========================================="
echo "服务名称: ${SERVICE_NAME}"
echo "镜像版本: ${IMAGE_NAME}:preview-${GIT_SHA}"
echo "服务URL: ${SERVICE_URL}"
echo ""
echo "验证命令:"
echo "  curl ${SERVICE_URL}/healthz"
echo "  curl ${SERVICE_URL}/metrics | grep siterank"
echo ""
echo "步骤 4/4: 验证部署..."
sleep 5

# 健康检查
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" ${SERVICE_URL}/healthz)
if [ "${HTTP_CODE}" = "200" ]; then
  echo "✅ 健康检查通过 (HTTP ${HTTP_CODE})"
else
  echo "⚠️ 健康检查异常 (HTTP ${HTTP_CODE})"
fi

# 检查新增的Gemini metrics
echo ""
echo "检查新增Prometheus指标..."
METRICS_OUTPUT=$(curl -s ${SERVICE_URL}/metrics | grep -E "(gemini_input_tokens|gemini_output_tokens|gemini_api_cost)" | head -3)
if [ -n "${METRICS_OUTPUT}" ]; then
  echo "✅ 新增Gemini成本监控指标已生效:"
  echo "${METRICS_OUTPUT}"
else
  echo "⚠️ 未检测到Gemini成本监控指标（可能尚未有AI评估请求）"
fi

echo ""
echo "部署完成！"
