#!/bin/bash
# Siterank API+Worker 架构部署脚本 (Preview环境)
#
# 用法: ./deploy-api-worker-preview.sh
#
# 前置条件:
# - gcloud CLI 已配置
# - 有权限访问 ${GCP_PROJECT_ID} 项目
# - Pub/Sub Topic 'evaluation-tasks' 已创建
# - Pub/Sub Subscription 'evaluation-tasks-sub' 已创建

set -e  # 遇到错误立即退出

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"

echo "=========================================="
echo "Siterank API+Worker 部署脚本"
echo "环境: Preview"
echo "项目: $PROJECT_ID"
echo "=========================================="

# 1. 构建并部署 API 服务
echo ""
echo "[1/4] 构建并部署 Siterank API 服务..."
gcloud builds submit \
  --config=services/siterank/cloudbuild-api-preview.yaml \
  --project=$PROJECT_ID \
  --async

echo "✓ API 服务构建已启动（异步）"

# 2. 构建并部署 Worker 服务
echo ""
echo "[2/4] 构建并部署 Siterank Worker 服务..."
gcloud builds submit \
  --config=services/siterank/cloudbuild-worker-preview.yaml \
  --project=$PROJECT_ID \
  --async

echo "✓ Worker 服务构建已启动（异步）"

# 等待构建完成
echo ""
echo "[3/4] 等待构建完成（约5-10分钟）..."
echo "可以通过以下命令监控构建进度："
echo "  gcloud builds list --ongoing --project=$PROJECT_ID"
echo ""
read -p "构建完成后按 Enter 继续配置环境变量..."

# 3. 配置 API 服务环境变量
echo ""
echo "[4/4] 配置 API 服务环境变量..."
gcloud run services update siterank-api-preview \
  --region=$REGION \
  --project=$PROJECT_ID \
  --update-secrets=DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest \
  --update-env-vars=\
BROWSER_EXEC_URL=https://browser-exec-preview-yt54xvsg5q-an.a.run.app,\
BILLING_API_URL=https://billing-preview-yt54xvsg5q-an.a.run.app,\
GCP_PROJECT_ID=$PROJECT_ID,\
GOOGLE_CLOUD_PROJECT=$PROJECT_ID,\
LOG_LEVEL=info,\
ENVIRONMENT=preview

echo "✓ API 服务环境变量已配置"

# 4. 配置 Worker 服务环境变量
echo ""
echo "配置 Worker 服务环境变量..."
gcloud run services update siterank-worker-preview \
  --region=$REGION \
  --project=$PROJECT_ID \
  --update-secrets=DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest \
  --update-env-vars=\
BROWSER_EXEC_URL=https://browser-exec-preview-yt54xvsg5q-an.a.run.app,\
BILLING_API_URL=https://billing-preview-yt54xvsg5q-an.a.run.app,\
GCP_PROJECT_ID=$PROJECT_ID,\
GOOGLE_CLOUD_PROJECT=$PROJECT_ID,\
PUBSUB_SUBSCRIPTION=evaluation-tasks-sub,\
PROJECT_ID=$PROJECT_ID,\
LOG_LEVEL=info,\
ENVIRONMENT=preview

echo "✓ Worker 服务环境变量已配置"

# 5. 验证部署
echo ""
echo "=========================================="
echo "部署完成！开始验证..."
echo "=========================================="

API_URL=$(gcloud run services describe siterank-api-preview \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)")

WORKER_URL=$(gcloud run services describe siterank-worker-preview \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)")

echo ""
echo "API 服务 URL: $API_URL"
echo "Worker 服务 URL: $WORKER_URL"

echo ""
echo "测试 API 健康检查..."
curl -s "$API_URL/health" | jq .

echo ""
echo "=========================================="
echo "✓ 部署成功完成！"
echo "=========================================="
echo ""
echo "后续步骤:"
echo "1. 更新 offer 服务的 SITERANK_API_URL 环境变量:"
echo "   export SITERANK_API_URL=$API_URL"
echo ""
echo "2. 监控 Worker 服务日志:"
echo "   gcloud run logs read siterank-worker-preview --limit=50"
echo ""
echo "3. 检查 Pub/Sub 订阅状态:"
echo "   gcloud pubsub subscriptions describe evaluation-tasks-sub"
echo ""
