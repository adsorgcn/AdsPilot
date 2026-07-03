#!/bin/bash

# 预发环境集成测试脚本
# 直接调用预发环境的服务和数据库进行真实测试

set -e

echo "🚀 开始预发环境集成测试..."

# 预发环境配置
export GCP_PROJECT="${GCP_PROJECT_ID}"
export GCP_REGION="asia-northeast1"

# Supabase 数据库配置（预发环境）
export SUPABASE_URL="https://YOUR_SUPABASE_PROJECT.supabase.co"
export SUPABASE_PROJECT_REF="YOUR_SUPABASE_PROJECT"
export DATABASE_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${SUPABASE_PASSWORD}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"

# 预发环境服务 URL（Cloud Run）
export BILLING_SERVICE_URL="https://billing-preview-${GCP_REGION}.a.run.app"
export OFFER_SERVICE_URL="https://offer-preview-${GCP_REGION}.a.run.app"
export SITERANK_SERVICE_URL="https://siterank-preview-${GCP_REGION}.a.run.app"
export ADSCENTER_SERVICE_URL="https://adscenter-preview-${GCP_REGION}.a.run.app"
export BROWSER_EXEC_SERVICE_URL="https://browser-exec-preview-${GCP_REGION}.a.run.app"

# 测试用户 Token（需要从 Supabase 获取）
# 可以通过 Supabase Dashboard 或 API 生成测试用户的 JWT token
export TEST_USER_TOKEN="${TEST_USER_TOKEN:-}"

echo "📋 测试配置:"
echo "  GCP Project: ${GCP_PROJECT}"
echo "  Region: ${GCP_REGION}"
echo "  Supabase URL: ${SUPABASE_URL}"
echo "  Database: Supabase PostgreSQL (PgBouncer)"
echo ""
echo "🌐 服务 URLs:"
echo "  Billing: ${BILLING_SERVICE_URL}"
echo "  Offer: ${OFFER_SERVICE_URL}"
echo "  Siterank: ${SITERANK_SERVICE_URL}"
echo "  Adscenter: ${ADSCENTER_SERVICE_URL}"
echo "  Browser-Exec: ${BROWSER_EXEC_SERVICE_URL}"
echo ""

# 检查必需的环境变量
if [ -z "${SUPABASE_PASSWORD}" ]; then
    echo "❌ 错误: SUPABASE_PASSWORD 环境变量未设置"
    echo "请设置: export SUPABASE_PASSWORD='your-password'"
    exit 1
fi

# 可选：从 Secret Manager 获取密码
if command -v gcloud &> /dev/null; then
    echo "🔐 尝试从 Secret Manager 获取凭证..."
    
    # 获取 Supabase 密码
    if [ -z "${SUPABASE_PASSWORD}" ]; then
        SUPABASE_PASSWORD=$(gcloud secrets versions access latest --secret="supabase-db-password" --project="${GCP_PROJECT}" 2>/dev/null || echo "")
        if [ -n "${SUPABASE_PASSWORD}" ]; then
            export SUPABASE_PASSWORD
            export DATABASE_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${SUPABASE_PASSWORD}@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
            echo "✅ 已从 Secret Manager 获取 Supabase 密码"
        fi
    fi
    
    # 获取测试用户 Token
    if [ -z "${TEST_USER_TOKEN}" ]; then
        TEST_USER_TOKEN=$(gcloud secrets versions access latest --secret="test-user-token" --project="${GCP_PROJECT}" 2>/dev/null || echo "")
        if [ -n "${TEST_USER_TOKEN}" ]; then
            export TEST_USER_TOKEN
            echo "✅ 已从 Secret Manager 获取测试用户 Token"
        fi
    fi
fi

echo ""
echo "🧪 运行集成测试..."
echo ""

# 运行所有集成测试
go test -tags=integration -v ./services/... -timeout 5m

echo ""
echo "✅ 预发环境集成测试完成！"
