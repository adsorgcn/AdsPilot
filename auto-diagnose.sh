#!/bin/bash

# Google登录问题自动诊断脚本
# 检查所有关键配置和状态

set -e

echo "🔍 Google登录问题自动诊断"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "📦 1. 检查部署状态"
echo "--------------------------------"

# 获取最新的revision
LATEST_REVISION=$(gcloud run revisions list \
  --service=frontend-preview \
  --region=asia-northeast1 \
  --limit=1 \
  --format='value(metadata.name)')

LATEST_TIME=$(gcloud run revisions list \
  --service=frontend-preview \
  --region=asia-northeast1 \
  --limit=1 \
  --format='value(metadata.creationTimestamp)')

echo "最新Revision: $LATEST_REVISION"
echo "部署时间: $LATEST_TIME"

# 检查是否是最近部署的（1小时内）
DEPLOY_TIMESTAMP=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${LATEST_TIME:0:19}" "+%s" 2>/dev/null || echo "0")
CURRENT_TIMESTAMP=$(date "+%s")
TIME_DIFF=$((CURRENT_TIMESTAMP - DEPLOY_TIMESTAMP))

if [ $TIME_DIFF -lt 3600 ]; then
    check_pass "部署时间在1小时内，是最新的"
else
    check_warn "部署时间超过1小时，可能不是最新代码"
fi

echo ""

echo "🔧 2. 检查环境变量"
echo "--------------------------------"

# 检查.env.local文件
if [ -f "apps/frontend/.env.local" ]; then
    check_pass ".env.local 文件存在"
    
    # 检查关键环境变量
    if grep -q "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${GCP_PROJECT_ID}.firebaseapp.com" apps/frontend/.env.local; then
        check_pass "Firebase Auth Domain 配置正确"
    else
        check_fail "Firebase Auth Domain 配置错误"
        echo "   当前值: $(grep NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN apps/frontend/.env.local)"
        echo "   应该是: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${GCP_PROJECT_ID}.firebaseapp.com"
    fi
else
    check_fail ".env.local 文件不存在"
fi

echo ""

echo "📝 3. 检查代码修复"
echo "--------------------------------"

# 检查OAuthRedirectHandler是否使用onAuthStateChanged
if grep -q "onAuthStateChanged" apps/frontend/src/components/auth/OAuthRedirectHandler.tsx; then
    check_pass "OAuthRedirectHandler 使用 onAuthStateChanged"
else
    check_fail "OAuthRedirectHandler 未使用 onAuthStateChanged"
fi

# 检查是否移除了authStateReady
if grep -q "authStateReady" apps/frontend/src/components/auth/OAuthRedirectHandler.tsx; then
    check_fail "OAuthRedirectHandler 仍然使用 authStateReady (应该移除)"
else
    check_pass "OAuthRedirectHandler 已移除 authStateReady"
fi

# 检查use-sign-in-with-provider是否移除了browserPopupRedirectResolver
if grep -q "browserPopupRedirectResolver" apps/frontend/src/core/firebase/hooks/use-sign-in-with-provider.ts; then
    check_fail "use-sign-in-with-provider 仍然使用 browserPopupRedirectResolver (应该移除)"
else
    check_pass "use-sign-in-with-provider 已移除 browserPopupRedirectResolver"
fi

echo ""

echo "🔥 4. 检查Firebase配置"
echo "--------------------------------"

# 检查Firebase项目ID
if [ -f "apps/frontend/.env.local" ]; then
    PROJECT_ID=$(grep NEXT_PUBLIC_FIREBASE_PROJECT_ID apps/frontend/.env.local | cut -d'=' -f2)
    if [ "$PROJECT_ID" = "${GCP_PROJECT_ID}" ]; then
        check_pass "Firebase项目ID正确: $PROJECT_ID"
    else
        check_fail "Firebase项目ID错误: $PROJECT_ID"
    fi
fi

echo ""

echo "🌐 5. 检查Cloud Run服务"
echo "--------------------------------"

# 获取Cloud Run URL
CLOUD_RUN_URL=$(gcloud run services describe frontend-preview \
  --region=asia-northeast1 \
  --format='value(status.url)')

echo "Cloud Run URL: $CLOUD_RUN_URL"

# 测试Cloud Run是否可访问
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUD_RUN_URL/auth/sign-in")

if [ "$HTTP_CODE" = "200" ]; then
    check_pass "Cloud Run服务可访问 (HTTP $HTTP_CODE)"
else
    check_warn "Cloud Run服务返回 HTTP $HTTP_CODE"
fi

echo ""

echo "🔐 6. 检查Firebase授权域名"
echo "--------------------------------"

echo "需要手动检查Firebase Console:"
echo "https://console.firebase.google.com/project/${GCP_PROJECT_ID}/authentication/settings"
echo ""
echo "必须包含的域名:"
echo "  - localhost"
echo "  - www.urlchecker.dev"
echo "  - urlchecker.dev"
echo "  - frontend-preview-yt54xvsg5q-an.a.run.app"
echo "  - frontend-prod-yt54xvsg5q-an.a.run.app"
echo "  - ${GCP_PROJECT_ID}.firebaseapp.com"
echo "  - ${GCP_PROJECT_ID}.web.app"

echo ""

echo "📊 7. 诊断总结"
echo "================================"
echo ""
echo "✅ 自动检查完成！"
echo ""
echo "下一步操作:"
echo "1. 如果所有检查都通过，进行实际登录测试"
echo "2. 打开隐身窗口访问: $CLOUD_RUN_URL/auth/sign-in"
echo "3. 打开开发者工具Console"
echo "4. 点击Google登录并观察日志"
echo ""
echo "详细测试指南: 查看 diagnose-google-login.md"
echo ""
