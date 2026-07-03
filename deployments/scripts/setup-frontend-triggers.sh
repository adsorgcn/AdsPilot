#!/bin/bash
# 设置 Frontend Cloud Build 触发器

set -e

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
REPO_NAME="ScientificInternet/Google-Monetize"

echo "🔧 设置 Frontend Cloud Build 触发器..."

# Preview 环境触发器 (main 分支)
echo "📝 创建 Preview 环境触发器..."
gcloud builds triggers create github \
  --project=$PROJECT_ID \
  --region=$REGION \
  --name="frontend-preview" \
  --repo-name=$REPO_NAME \
  --repo-owner="ScientificInternet" \
  --branch-pattern="^main$" \
  --build-config="deployments/cloudbuild/frontend-preview.yaml" \
  --description="Deploy frontend to Firebase Hosting (Preview)" \
  --included-files="apps/frontend/**" \
  || echo "⚠️  Preview 触发器可能已存在"

# Production 环境触发器 (production 分支)
echo "📝 创建 Production 环境触发器..."
gcloud builds triggers create github \
  --project=$PROJECT_ID \
  --region=$REGION \
  --name="frontend-production" \
  --repo-name=$REPO_NAME \
  --repo-owner="ScientificInternet" \
  --branch-pattern="^production$" \
  --build-config="deployments/cloudbuild/frontend-production.yaml" \
  --description="Deploy frontend to Firebase Hosting (Production)" \
  --included-files="apps/frontend/**" \
  || echo "⚠️  Production 触发器可能已存在"

# Production Tag 触发器
echo "📝 创建 Production Tag 触发器..."
gcloud builds triggers create github \
  --project=$PROJECT_ID \
  --region=$REGION \
  --name="frontend-production-tag" \
  --repo-name=$REPO_NAME \
  --repo-owner="ScientificInternet" \
  --tag-pattern="^v[0-9]+\\.[0-9]+\\.[0-9]+$" \
  --build-config="deployments/cloudbuild/frontend-production.yaml" \
  --description="Deploy frontend to Firebase Hosting (Production Tag)" \
  || echo "⚠️  Production Tag 触发器可能已存在"

echo "✅ Frontend 触发器设置完成！"
echo ""
echo "📋 触发规则:"
echo "  - main 分支推送 → Preview 环境 (www.urlchecker.dev)"
echo "  - production 分支推送 → Production 环境 (www.${APP_DOMAIN})"
echo "  - Tag 推送 (v*.*.*)  → Production 环境 (www.${APP_DOMAIN})"
echo ""
echo "🔍 查看触发器:"
echo "  gcloud builds triggers list --project=$PROJECT_ID --region=$REGION"