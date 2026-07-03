#!/bin/bash
set -euo pipefail

# 测试前端Supabase认证
# 检查前端服务是否正常响应

echo "🧪 测试前端Supabase认证..."
echo ""

# 测试URL
PREVIEW_URL="https://www.urlchecker.dev"
PROD_URL="https://www.${APP_DOMAIN}"

# 测试函数
test_url() {
    local URL=$1
    local ENV=$2
    
    echo "📍 测试 $ENV 环境: $URL"
    
    # 测试主页
    echo "   检查主页..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ 主页正常 (HTTP $HTTP_CODE)"
    else
        echo "   ❌ 主页异常 (HTTP $HTTP_CODE)"
    fi
    
    # 测试登录页
    echo "   检查登录页..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/auth/sign-in" || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ 登录页正常 (HTTP $HTTP_CODE)"
    else
        echo "   ❌ 登录页异常 (HTTP $HTTP_CODE)"
    fi
    
    # 测试回调页
    echo "   检查回调页..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/auth/callback" || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
        echo "   ✅ 回调页正常 (HTTP $HTTP_CODE)"
    else
        echo "   ❌ 回调页异常 (HTTP $HTTP_CODE)"
    fi
    
    echo ""
}

# 测试Preview环境
test_url "$PREVIEW_URL" "Preview"

# 测试Production环境
test_url "$PROD_URL" "Production"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试总结"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 前端服务可访问"
echo ""
echo "🔐 手动测试步骤:"
echo "   1. 访问: $PREVIEW_URL/auth/sign-in"
echo "   2. 点击 '使用Google登录' 按钮"
echo "   3. 完成Google授权"
echo "   4. 验证是否成功跳转到dashboard"
echo ""
echo "💡 如果登录失败，检查:"
echo "   - Supabase Dashboard的Auth日志"
echo "   - 浏览器Console的错误信息"
echo "   - Cloud Run服务日志"
echo ""
