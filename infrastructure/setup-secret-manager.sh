#!/bin/bash

# INFRA-001: 配置 Secret Manager（SimilarWeb API）
# Google-Monetize Secret Manager 配置脚本

set -e

echo "🔐 Google-Monetize Secret Manager 配置"
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

# 启用 Secret Manager API
echo "🔧 启用 Secret Manager API..."
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID
echo "✅ Secret Manager API 已启用"
echo ""

# 创建 SimilarWeb API Key Secret
echo "🔑 配置 SimilarWeb API Key..."
read -sp "请输入 SimilarWeb API Key: " SIMILARWEB_API_KEY
echo ""

if [ -z "$SIMILARWEB_API_KEY" ]; then
  echo "❌ SimilarWeb API Key 不能为空"
  exit 1
fi

# 检查 secret 是否已存在
if gcloud secrets describe similarweb-api-key --project=$PROJECT_ID &>/dev/null; then
  echo "⚠️  Secret 'similarweb-api-key' 已存在，正在添加新版本..."
  echo -n "$SIMILARWEB_API_KEY" | gcloud secrets versions add similarweb-api-key \
    --data-file=- \
    --project=$PROJECT_ID
else
  echo "📝 创建新 Secret 'similarweb-api-key'..."
  echo -n "$SIMILARWEB_API_KEY" | gcloud secrets create similarweb-api-key \
    --data-file=- \
    --replication-policy="automatic" \
    --project=$PROJECT_ID
fi

echo "✅ SimilarWeb API Key 已配置"
echo ""

# 创建 Supabase Service Role Key Secret
echo "🔑 配置 Supabase Service Role Key..."
read -sp "请输入 Supabase Service Role Key: " SUPABASE_SERVICE_ROLE_KEY
echo ""

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Supabase Service Role Key 不能为空"
  exit 1
fi

if gcloud secrets describe supabase-service-role-key --project=$PROJECT_ID &>/dev/null; then
  echo "⚠️  Secret 'supabase-service-role-key' 已存在，正在添加新版本..."
  echo -n "$SUPABASE_SERVICE_ROLE_KEY" | gcloud secrets versions add supabase-service-role-key \
    --data-file=- \
    --project=$PROJECT_ID
else
  echo "📝 创建新 Secret 'supabase-service-role-key'..."
  echo -n "$SUPABASE_SERVICE_ROLE_KEY" | gcloud secrets create supabase-service-role-key \
    --data-file=- \
    --replication-policy="automatic" \
    --project=$PROJECT_ID
fi

echo "✅ Supabase Service Role Key 已配置"
echo ""

# 创建 Redis URL Secret
echo "🔑 配置 Redis URL..."
read -p "请输入 Redis URL (例如: 10.0.0.3:6379): " REDIS_URL

if [ -z "$REDIS_URL" ]; then
  echo "⚠️  Redis URL 为空，跳过配置"
else
  if gcloud secrets describe redis-url --project=$PROJECT_ID &>/dev/null; then
    echo "⚠️  Secret 'redis-url' 已存在，正在添加新版本..."
    echo -n "$REDIS_URL" | gcloud secrets versions add redis-url \
      --data-file=- \
      --project=$PROJECT_ID
  else
    echo "📝 创建新 Secret 'redis-url'..."
    echo -n "$REDIS_URL" | gcloud secrets create redis-url \
      --data-file=- \
      --replication-policy="automatic" \
      --project=$PROJECT_ID
  fi
  echo "✅ Redis URL 已配置"
fi
echo ""

# 配置 Service Account 权限
echo "🔐 配置 Service Account 权限..."

# Browser-exec service account
BROWSER_EXEC_SA="browser-exec@${PROJECT_ID}.iam.gserviceaccount.com"

# 检查 service account 是否存在
if ! gcloud iam service-accounts describe $BROWSER_EXEC_SA --project=$PROJECT_ID &>/dev/null; then
  echo "📝 创建 browser-exec Service Account..."
  gcloud iam service-accounts create browser-exec \
    --display-name="Browser Exec Service Account" \
    --description="Service account for browser-exec service to access SimilarWeb API" \
    --project=$PROJECT_ID
fi

# 授予 Secret Accessor 权限
echo "🔓 授予 browser-exec 访问 SimilarWeb API Secret 的权限..."
gcloud secrets add-iam-policy-binding similarweb-api-key \
  --member="serviceAccount:${BROWSER_EXEC_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID

echo "✅ browser-exec Service Account 权限已配置"
echo ""

# Siterank service account
SITERANK_SA="siterank@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe $SITERANK_SA --project=$PROJECT_ID &>/dev/null; then
  echo "📝 创建 siterank Service Account..."
  gcloud iam service-accounts create siterank \
    --display-name="Siterank Service Account" \
    --description="Service account for siterank service" \
    --project=$PROJECT_ID
fi

echo "✅ siterank Service Account 已创建"
echo ""

# 所有后端服务访问 Supabase Service Role Key
echo "🔓 授予后端服务访问 Supabase Service Role Key 的权限..."

BACKEND_SERVICES=("offer" "billing" "useractivity" "console" "adscenter" "bff" "siterank" "browser-exec")

for service in "${BACKEND_SERVICES[@]}"; do
  SERVICE_SA="${service}@${PROJECT_ID}.iam.gserviceaccount.com"

  # 创建 service account（如果不存在）
  if ! gcloud iam service-accounts describe $SERVICE_SA --project=$PROJECT_ID &>/dev/null; then
    echo "📝 创建 ${service} Service Account..."
    gcloud iam service-accounts create $service \
      --display-name="${service} Service Account" \
      --project=$PROJECT_ID
  fi

  # 授予权限
  gcloud secrets add-iam-policy-binding supabase-service-role-key \
    --member="serviceAccount:${SERVICE_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID 2>/dev/null || true

  # 如果配置了 Redis，也授予访问权限
  if [ -n "$REDIS_URL" ]; then
    gcloud secrets add-iam-policy-binding redis-url \
      --member="serviceAccount:${SERVICE_SA}" \
      --role="roles/secretmanager.secretAccessor" \
      --project=$PROJECT_ID 2>/dev/null || true
  fi

  echo "✅ ${service} Service Account 权限已配置"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Secret Manager 配置完成！"
echo ""
echo "📋 已配置的 Secrets:"
echo "  1. similarweb-api-key"
echo "  2. supabase-service-role-key"
if [ -n "$REDIS_URL" ]; then
  echo "  3. redis-url"
fi
echo ""
echo "📋 已配置的 Service Accounts:"
for service in "${BACKEND_SERVICES[@]}"; do
  echo "  - ${service}@${PROJECT_ID}.iam.gserviceaccount.com"
done
echo ""
echo "🔍 查看所有 Secrets:"
echo "  gcloud secrets list --project=$PROJECT_ID"
echo ""
echo "🔍 访问 Secret 值（示例）:"
echo "  gcloud secrets versions access latest --secret=similarweb-api-key --project=$PROJECT_ID"
echo ""
