#!/bin/bash

# INFRA-005: 配置 Cloud Scheduler（试用期到期检查）
# Google-Monetize 定时任务配置脚本

set -e

echo "⏰ Google-Monetize Cloud Scheduler 配置"
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

# 启用 Cloud Scheduler API
echo "🔧 启用 Cloud Scheduler API..."
gcloud services enable cloudscheduler.googleapis.com --project=$PROJECT_ID
echo "✅ Cloud Scheduler API 已启用"
echo ""

# 配置参数
REGION="asia-northeast1"
LOCATION="asia-northeast1"

# 获取服务 URL
echo "🔍 获取服务 URL..."

# Preview 环境
BILLING_PREVIEW_URL=$(gcloud run services describe billing-preview \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)" 2>/dev/null || echo "")

# Production 环境
BILLING_PROD_URL=$(gcloud run services describe billing \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)" 2>/dev/null || echo "")

if [ -z "$BILLING_PREVIEW_URL" ] && [ -z "$BILLING_PROD_URL" ]; then
  echo "⚠️  未找到 billing 服务，请先部署 billing 服务"
  echo "提示：稍后可以手动更新 scheduler 的 URL"
fi

# Service Account
SERVICE_ACCOUNT="codex-dev@${PROJECT_ID}.iam.gserviceaccount.com"

# 创建或更新 Preview 环境的定时任务
if [ -n "$BILLING_PREVIEW_URL" ]; then
  JOB_NAME="trial-expiration-check-preview"
  echo "📝 配置 Preview 环境定时任务: $JOB_NAME..."

  if gcloud scheduler jobs describe $JOB_NAME --location=$LOCATION --project=$PROJECT_ID &>/dev/null; then
    echo "⚠️  定时任务 '$JOB_NAME' 已存在，正在更新..."
    gcloud scheduler jobs update http $JOB_NAME \
      --location=$LOCATION \
      --project=$PROJECT_ID \
      --schedule="0 2 * * *" \
      --uri="${BILLING_PREVIEW_URL}/api/v1/billing/trials/expire" \
      --http-method=POST \
      --oidc-service-account-email=$SERVICE_ACCOUNT \
      --oidc-token-audience="${BILLING_PREVIEW_URL}" \
      --time-zone="Asia/Shanghai" \
      --attempt-deadline=600s
  else
    echo "📝 创建新定时任务: $JOB_NAME..."
    gcloud scheduler jobs create http $JOB_NAME \
      --location=$LOCATION \
      --project=$PROJECT_ID \
      --schedule="0 2 * * *" \
      --uri="${BILLING_PREVIEW_URL}/api/v1/billing/trials/expire" \
      --http-method=POST \
      --oidc-service-account-email=$SERVICE_ACCOUNT \
      --oidc-token-audience="${BILLING_PREVIEW_URL}" \
      --time-zone="Asia/Shanghai" \
      --attempt-deadline=600s \
      --description="Preview: 每天凌晨2点检查并标记过期的试用期"
  fi

  echo "✅ Preview 环境定时任务已配置"
  echo ""
fi

# 创建或更新 Production 环境的定时任务
if [ -n "$BILLING_PROD_URL" ]; then
  JOB_NAME="trial-expiration-check-production"
  echo "📝 配置 Production 环境定时任务: $JOB_NAME..."

  if gcloud scheduler jobs describe $JOB_NAME --location=$LOCATION --project=$PROJECT_ID &>/dev/null; then
    echo "⚠️  定时任务 '$JOB_NAME' 已存在，正在更新..."
    gcloud scheduler jobs update http $JOB_NAME \
      --location=$LOCATION \
      --project=$PROJECT_ID \
      --schedule="0 2 * * *" \
      --uri="${BILLING_PROD_URL}/api/v1/billing/trials/expire" \
      --http-method=POST \
      --oidc-service-account-email=$SERVICE_ACCOUNT \
      --oidc-token-audience="${BILLING_PROD_URL}" \
      --time-zone="Asia/Shanghai" \
      --attempt-deadline=600s
  else
    echo "📝 创建新定时任务: $JOB_NAME..."
    gcloud scheduler jobs create http $JOB_NAME \
      --location=$LOCATION \
      --project=$PROJECT_ID \
      --schedule="0 2 * * *" \
      --uri="${BILLING_PROD_URL}/api/v1/billing/trials/expire" \
      --http-method=POST \
      --oidc-service-account-email=$SERVICE_ACCOUNT \
      --oidc-token-audience="${BILLING_PROD_URL}" \
      --time-zone="Asia/Shanghai" \
      --attempt-deadline=600s \
      --description="Production: 每天凌晨2点检查并标记过期的试用期"
  fi

  echo "✅ Production 环境定时任务已配置"
  echo ""
fi

# 测试定时任务
echo "🧪 测试定时任务（手动触发）..."
if [ -n "$BILLING_PREVIEW_URL" ]; then
  echo "📝 触发 Preview 环境定时任务..."
  gcloud scheduler jobs run trial-expiration-check-preview \
    --location=$LOCATION \
    --project=$PROJECT_ID && echo "✅ Preview 环境定时任务已触发" || echo "⚠️  Preview 环境定时任务触发失败"
fi

if [ -n "$BILLING_PROD_URL" ]; then
  echo "📝 触发 Production 环境定时任务（跳过，避免影响生产）..."
  # gcloud scheduler jobs run trial-expiration-check-production \
  #   --location=$LOCATION \
  #   --project=$PROJECT_ID
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cloud Scheduler 配置完成！"
echo ""
echo "📋 配置总结:"
echo "  - Preview 任务: trial-expiration-check-preview"
echo "  - Production 任务: trial-expiration-check-production"
echo "  - 执行时间: 每天凌晨2点（Asia/Shanghai）"
echo "  - 端点: POST /api/v1/billing/trials/expire"
echo "  - 超时: 600秒"
echo "  - 认证: OIDC Service Account Token"
echo ""
echo "🔍 查看所有定时任务:"
echo "  gcloud scheduler jobs list --location=$LOCATION --project=$PROJECT_ID"
echo ""
echo "🔍 查看任务详情:"
echo "  gcloud scheduler jobs describe trial-expiration-check-preview \\"
echo "    --location=$LOCATION --project=$PROJECT_ID"
echo ""
echo "🧪 手动触发任务:"
echo "  gcloud scheduler jobs run trial-expiration-check-preview \\"
echo "    --location=$LOCATION --project=$PROJECT_ID"
echo ""
echo "🔍 查看任务执行历史:"
echo "  gcloud logging read 'resource.type=\"cloud_scheduler_job\" AND \\"
echo "    resource.labels.job_id=\"trial-expiration-check-preview\"' \\"
echo "    --limit=10 --project=$PROJECT_ID"
echo ""
echo "📖 Cloud Scheduler 文档:"
echo "  https://cloud.google.com/scheduler/docs"
echo ""
