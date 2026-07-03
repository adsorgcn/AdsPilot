#!/bin/bash

echo "🚀 部署后 CSRF 验证脚本"
echo "======================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查函数
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        return 0
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

warn_message() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

info_message() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 环境检测
detect_environment() {
    echo ""
    echo "🌍 环境检测"
    echo "==========="
    
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
        echo "✅ 已加载 .env 文件"
    else
        warn_message "未找到 .env 文件，使用系统环境变量"
    fi
    
    # 确定当前环境
    if [ "$NEXT_PUBLIC_DEPLOYMENT_ENV" = "production" ]; then
        ENVIRONMENT="production"
        BASE_URL="https://www.${APP_DOMAIN}"
        ENV_NAME="生产环境"
    elif [ "$NEXT_PUBLIC_DEPLOYMENT_ENV" = "preview" ]; then
        ENVIRONMENT="preview"
        BASE_URL="https://www.urlchecker.dev"
        ENV_NAME="预发环境"
    else
        ENVIRONMENT="development"
        BASE_URL="http://localhost:3000"
        ENV_NAME="开发环境"
    fi
    
    echo "📍 检测到环境: $ENV_NAME"
    echo "🔗 基础URL: $BASE_URL"
    
    # 验证环境变量
    echo ""
    echo "📋 环境变量检查:"
    check_status $([[ -n "$AUTH_SECRET" ]] && echo 0 || echo 1) "AUTH_SECRET 已设置"
    check_status $([[ -n "$AUTH_GOOGLE_ID" ]] && echo 0 || echo 1) "AUTH_GOOGLE_ID 已设置"
    check_status $([[ -n "$AUTH_GOOGLE_SECRET" ]] && echo 0 || echo 1) "AUTH_GOOGLE_SECRET 已设置"
}

# 网络连通性测试
test_connectivity() {
    echo ""
    echo "🌐 网络连通性测试"
    echo "================="
    
    # 测试基础连通性
    if curl -s --max-time 10 "$BASE_URL" > /dev/null; then
        check_status 0 "基础网络连通性"
    else
        check_status 1 "基础网络连通性"
        return 1
    fi
    
    # 检查SSL证书（仅HTTPS）
    if [[ "$BASE_URL" == https* ]]; then
        if curl -s --max-time 10 -I "$BASE_URL" | grep -q "200\|301\|302"; then
            check_status 0 "SSL证书有效"
        else
            check_status 1 "SSL证书验证"
        fi
    fi
}

# 认证端点测试
test_auth_endpoints() {
    echo ""
    echo "🔐 认证端点测试"
    echo "==============="
    
    # 测试CSRF端点
    echo "1. 测试 CSRF 端点..."
    CSRF_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BASE_URL/api/auth/csrf" 2>/dev/null)
    CSRF_STATUS=$(echo $CSRF_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    CSRF_BODY=$(echo $CSRF_RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')
    
    if [ "$CSRF_STATUS" = "200" ]; then
        if echo "$CSRF_BODY" | grep -q "csrfToken"; then
            check_status 0 "CSRF 端点返回有效 token"
            CSRF_TOKEN=$(echo "$CSRF_BODY" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
            info_message "CSRF Token 长度: ${#CSRF_TOKEN} 字符"
        else
            check_status 1 "CSRF 端点响应格式异常"
        fi
    else
        check_status 1 "CSRF 端点状态码: $CSRF_STATUS"
    fi
    
    # 测试Providers端点
    echo ""
    echo "2. 测试 Providers 端点..."
    PROVIDERS_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BASE_URL/api/auth/providers" 2>/dev/null)
    PROVIDERS_STATUS=$(echo $PROVIDERS_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    PROVIDERS_BODY=$(echo $PROVIDERS_RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')
    
    if [ "$PROVIDERS_STATUS" = "200" ]; then
        if echo "$PROVIDERS_BODY" | grep -q "google"; then
            check_status 0 "Providers 端点包含 Google 配置"
        else
            check_status 1 "Providers 端点缺少 Google 配置"
        fi
    else
        check_status 1 "Providers 端点状态码: $PROVIDERS_STATUS"
    fi
    
    # 测试Google登录端点
    echo ""
    echo "3. 测试 Google 登录端点..."
    GOOGLE_RESPONSE=$(curl -s -I "$BASE_URL/api/auth/signin/google" 2>/dev/null)
    GOOGLE_STATUS=$(echo "$GOOGLE_RESPONSE" | head -n1 | cut -d' ' -f2)
    GOOGLE_LOCATION=$(echo "$GOOGLE_RESPONSE" | grep -i "location:" | cut -d' ' -f2- | tr -d '\r')
    
    if [ "$GOOGLE_STATUS" = "302" ] || [ "$GOOGLE_STATUS" = "307" ]; then
        if echo "$GOOGLE_LOCATION" | grep -q "accounts.google.com"; then
            check_status 0 "Google 登录正确重定向到 OAuth"
        elif echo "$GOOGLE_LOCATION" | grep -q "error"; then
            check_status 1 "Google 登录重定向到错误页面"
            warn_message "可能的 Google OAuth 配置问题"
        else
            check_status 1 "Google 登录重定向目标异常"
        fi
    else
        check_status 1 "Google 登录端点状态码: $GOOGLE_STATUS"
    fi
}

# Cookie和域名测试
test_cookies_and_domains() {
    echo ""
    echo "🍪 Cookie 和域名测试"
    echo "==================="
    
    # 测试Cookie设置
    COOKIE_RESPONSE=$(curl -s -I "$BASE_URL/api/auth/csrf" 2>/dev/null)
    if echo "$COOKIE_RESPONSE" | grep -q "Set-Cookie"; then
        check_status 0 "服务器正确设置 Cookies"
        
        # 检查Cookie属性
        if echo "$COOKIE_RESPONSE" | grep -i "set-cookie" | grep -q "SameSite"; then
            check_status 0 "Cookie 包含 SameSite 属性"
        else
            warn_message "Cookie 缺少 SameSite 属性"
        fi
        
        if [[ "$BASE_URL" == https* ]] && echo "$COOKIE_RESPONSE" | grep -i "set-cookie" | grep -q "Secure"; then
            check_status 0 "HTTPS 环境 Cookie 包含 Secure 属性"
        elif [[ "$BASE_URL" == http* ]]; then
            info_message "HTTP 环境跳过 Secure 属性检查"
        else
            warn_message "HTTPS 环境 Cookie 缺少 Secure 属性"
        fi
    else
        check_status 1 "服务器未设置 Cookies"
    fi
    
    # 测试域名配置
    EXPECTED_DOMAIN=$(echo "$BASE_URL" | sed 's|https\?://||')
    info_message "期望域名: $EXPECTED_DOMAIN"
    
    # 检查是否有重定向
    REDIRECT_CHECK=$(curl -s -I "$BASE_URL" | head -n1 | cut -d' ' -f2)
    if [ "$REDIRECT_CHECK" = "301" ] || [ "$REDIRECT_CHECK" = "302" ]; then
        warn_message "检测到域名重定向，请确认最终域名配置正确"
    fi
}

# Google OAuth配置验证
verify_google_oauth() {
    echo ""
    echo "🔍 Google OAuth 配置验证"
    echo "========================"
    
    EXPECTED_REDIRECT_URI="$BASE_URL/api/auth/callback/google"
    echo "期望的重定向 URI: $EXPECTED_REDIRECT_URI"
    
    echo ""
    echo "请手动验证 Google Cloud Console 配置:"
    echo "1. 访问: https://console.cloud.google.com/"
    echo "2. 进入: APIs & Services > Credentials"
    echo "3. 检查 OAuth 2.0 客户端 ID 配置"
    echo "4. 确认授权重定向 URI 包含:"
    echo "   ✓ $EXPECTED_REDIRECT_URI"
    
    if [ "$ENVIRONMENT" != "production" ]; then
        echo "   ✓ http://localhost:3000/api/auth/callback/google (开发环境)"
    fi
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "   ✓ https://www.urlchecker.dev/api/auth/callback/google (预发环境)"
    fi
}

# 生成测试报告
generate_report() {
    echo ""
    echo "📊 测试报告"
    echo "==========="
    
    echo "环境信息:"
    echo "  - 环境: $ENV_NAME"
    echo "  - URL: $BASE_URL"
    echo "  - 时间: $(date)"
    
    echo ""
    echo "测试结果摘要:"
    echo "  - 网络连通性: $([ $CONNECTIVITY_OK -eq 0 ] && echo "✅ 正常" || echo "❌ 异常")"
    echo "  - CSRF 端点: $([ $CSRF_OK -eq 0 ] && echo "✅ 正常" || echo "❌ 异常")"
    echo "  - Providers 端点: $([ $PROVIDERS_OK -eq 0 ] && echo "✅ 正常" || echo "❌ 异常")"
    echo "  - Google 登录: $([ $GOOGLE_OK -eq 0 ] && echo "✅ 正常" || echo "❌ 异常")"
    echo "  - Cookie 设置: $([ $COOKIES_OK -eq 0 ] && echo "✅ 正常" || echo "❌ 异常")"
    
    # 计算总体状态
    TOTAL_ISSUES=$((CONNECTIVITY_OK + CSRF_OK + PROVIDERS_OK + GOOGLE_OK + COOKIES_OK))
    
    echo ""
    if [ $TOTAL_ISSUES -eq 0 ]; then
        echo -e "${GREEN}🎉 所有测试通过！CSRF 修复部署成功！${NC}"
        echo ""
        echo "✅ 下一步操作:"
        echo "1. 进行手动浏览器测试"
        echo "2. 验证用户登录流程"
        echo "3. 监控登录成功率"
    else
        echo -e "${RED}⚠️  发现 $TOTAL_ISSUES 个问题，需要进一步修复${NC}"
        echo ""
        echo "🔧 建议的修复步骤:"
        [ $CONNECTIVITY_OK -ne 0 ] && echo "1. 检查网络连接和服务器状态"
        [ $CSRF_OK -ne 0 ] && echo "2. 验证 AUTH_SECRET 配置"
        [ $PROVIDERS_OK -ne 0 ] && echo "3. 检查 Google OAuth 环境变量"
        [ $GOOGLE_OK -ne 0 ] && echo "4. 更新 Google Console 重定向 URI"
        [ $COOKIES_OK -ne 0 ] && echo "5. 检查 Cookie 和域名配置"
    fi
}

# 主执行流程
main() {
    echo "开始部署后 CSRF 验证..."
    
    # 初始化状态变量
    CONNECTIVITY_OK=1
    CSRF_OK=1
    PROVIDERS_OK=1
    GOOGLE_OK=1
    COOKIES_OK=1
    
    # 执行测试
    detect_environment
    
    test_connectivity
    CONNECTIVITY_OK=$?
    
    if [ $CONNECTIVITY_OK -eq 0 ]; then
        test_auth_endpoints
        # 根据测试结果设置状态
        [ "$CSRF_STATUS" = "200" ] && CSRF_OK=0 || CSRF_OK=1
        [ "$PROVIDERS_STATUS" = "200" ] && PROVIDERS_OK=0 || PROVIDERS_OK=1
        [ "$GOOGLE_STATUS" = "302" ] || [ "$GOOGLE_STATUS" = "307" ] && GOOGLE_OK=0 || GOOGLE_OK=1
        
        test_cookies_and_domains
        COOKIES_OK=$?
        
        verify_google_oauth
    fi
    
    generate_report
    
    # 返回适当的退出码
    [ $TOTAL_ISSUES -eq 0 ] && exit 0 || exit 1
}

# 执行主函数
main "$@"