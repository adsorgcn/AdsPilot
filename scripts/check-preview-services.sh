#!/bin/bash
# 检查所有预发环境服务的可用性

set -e

echo "🔍 检查预发环境服务状态..."
echo ""

PASSED=0
FAILED=0
FAILED_SERVICES=""

# 函数：检查服务
check_service() {
    local name=$1
    local url=$2
    local endpoint=${3:-/health}

    printf "%-20s " "$name"

    if curl -s -f -m 5 "$url$endpoint" > /dev/null 2>&1; then
        echo "✅ OK"
        ((PASSED++))
        return 0
    else
        echo "❌ FAILED"
        ((FAILED++))
        FAILED_SERVICES="$FAILED_SERVICES\n  - $name: $url"
        return 1
    fi
}

# 检查所有服务（使用实际部署的URL）
check_service "billing" "https://billing-preview-yt54xvsg5q-an.a.run.app"
check_service "offer" "https://offer-preview-yt54xvsg5q-an.a.run.app"
check_service "adscenter" "https://adscenter-preview-yt54xvsg5q-an.a.run.app"
check_service "siterank" "https://siterank-preview-yt54xvsg5q-an.a.run.app"
check_service "browser-exec" "https://browser-exec-preview-yt54xvsg5q-an.a.run.app"
check_service "proxy-pool" "https://proxy-pool-preview-yt54xvsg5q-an.a.run.app"
check_service "recommendations" "https://recommendations-preview-yt54xvsg5q-an.a.run.app"
check_service "frontend" "https://www.urlchecker.dev" "/"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 统计结果:"
echo "  ✅ 通过: $PASSED"
echo "  ❌ 失败: $FAILED"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "失败的服务:"
    echo -e "$FAILED_SERVICES"
    echo ""
    echo "⚠️  需要检查这些服务的部署状态"
    exit 1
else
    echo "🎉 所有预发环境服务运行正常！"
    exit 0
fi
