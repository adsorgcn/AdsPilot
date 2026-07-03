#!/bin/bash

# Enhanced Google OAuth Setup Script with Context7 Integration
# 增强版Google OAuth设置脚本

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装，请先安装Node.js"
        exit 1
    fi
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        log_error "npm未安装，请先安装npm"
        exit 1
    fi
    
    # 检查openssl
    if ! command -v openssl &> /dev/null; then
        log_warning "OpenSSL未安装，将使用Node.js生成密钥"
    fi
    
    log_success "依赖检查完成"
}

# 检查NextAuth.js版本
check_nextauth_version() {
    log_info "检查NextAuth.js版本..."
    
    if [ -f "package.json" ]; then
        NEXTAUTH_VERSION=$(node -p "require('./package.json').dependencies['next-auth'] || 'not found'")
        if [[ $NEXTAUTH_VERSION == *"5."* ]]; then
            log_success "检测到NextAuth.js v5: $NEXTAUTH_VERSION"
        elif [[ $NEXTAUTH_VERSION == *"4."* ]]; then
            log_warning "检测到NextAuth.js v4: $NEXTAUTH_VERSION"
            log_warning "本指南针对v5优化，可能需要调整配置"
        else
            log_error "未检测到NextAuth.js或版本不兼容"
            exit 1
        fi
    else
        log_error "未找到package.json文件"
        exit 1
    fi
}

# 验证现有配置
validate_existing_config() {
    log_info "验证现有配置..."
    
    local has_issues=false
    
    # 检查环境文件
    for env_file in ".env" ".env.local"; do
        if [ -f "$env_file" ]; then
            log_success "找到环境文件: $env_file"
            
            # 检查占位符
            if grep -q "your-.*-client-id\|your-google-client-id" "$env_file"; then
                log_warning "$env_file 包含占位符凭据"
                has_issues=true
            fi
            
            # 检查必需变量
            if ! grep -q "AUTH_SECRET=" "$env_file"; then
                log_warning "$env_file 缺少AUTH_SECRET"
                has_issues=true
            fi
        else
            log_warning "未找到环境文件: $env_file"
        fi
    done
    
    # 检查NextAuth配置文件
    local config_files=("src/lib/auth.ts" "src/lib/auth/v5-config.ts" "src/app/api/auth/[...nextauth]/route.ts")
    local found_config=false
    
    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            log_success "找到NextAuth配置: $config_file"
            found_config=true
            break
        fi
    done
    
    if [ "$found_config" = false ]; then
        log_error "未找到NextAuth配置文件"
        has_issues=true
    fi
    
    if [ "$has_issues" = true ]; then
        log_warning "发现配置问题，建议继续设置流程"
    else
        log_success "现有配置看起来正常"
    fi
}

# 生成AUTH_SECRET
generate_auth_secret() {
    log_info "生成AUTH_SECRET..."
    
    if command -v openssl &> /dev/null; then
        AUTH_SECRET=$(openssl rand -hex 32)
    else
        AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    fi
    
    log_success "AUTH_SECRET已生成"
}

# 显示Google Console设置指南
show_google_console_guide() {
    echo ""
    echo "🔐 Google Cloud Console 设置指南"
    echo "=================================="
    echo ""
    echo "请按照以下步骤在Google Cloud Console中设置OAuth："
    echo ""
    echo "1️⃣  访问 Google Cloud Console："
    echo "   https://console.cloud.google.com/"
    echo ""
    echo "2️⃣  创建或选择项目"
    echo ""
    echo "3️⃣  API设置（已简化）："
    echo "   ✅ 好消息：基础Google OAuth不需要启用特定API！"
    echo "   ✅ 可选：启用 People API（仅在需要详细用户信息时）"
    echo "   ❌ 不要启用Google+ API（已弃用）"
    echo ""
    echo "4️⃣  配置OAuth同意屏幕："
    echo "   - 用户类型: 外部"
    echo "   - 应用名称: Google-Monetize（或您的应用名称）"
    echo "   - 授权域名: localhost"
    echo "   - 作用域: openid, email, profile"
    echo ""
    echo "5️⃣  创建OAuth 2.0凭据："
    echo "   - 应用类型: Web应用"
    echo "   - JavaScript来源: http://localhost:3000"
    echo "   - 重定向URI: http://localhost:3000/api/auth/callback/google"
    echo ""
    echo "📋 重要提示："
    echo "   - 确保重定向URI完全匹配（包括协议和端口）"
    echo "   - 如果有多个环境，添加所有相关的URI"
    echo "   - 生产环境使用HTTPS"
    echo ""
}

# 交互式输入凭据
input_credentials() {
    echo "🔑 请输入您的Google OAuth凭据："
    echo ""
    
    # 输入客户端ID
    while true; do
        read -p "请输入客户端ID (Client ID): " CLIENT_ID
        if [ -n "$CLIENT_ID" ] && [[ $CLIENT_ID == *".apps.googleusercontent.com" ]]; then
            break
        else
            log_error "客户端ID格式不正确，应该以.apps.googleusercontent.com结尾"
        fi
    done
    
    # 输入客户端密钥
    while true; do
        echo ""
        read -s -p "请输入客户端密钥 (Client Secret): " CLIENT_SECRET
        echo ""
        if [ -n "$CLIENT_SECRET" ] && [[ $CLIENT_SECRET == GOCSPX-* ]]; then
            break
        else
            log_error "客户端密钥格式不正确，应该以GOCSPX-开头"
        fi
    done
    
    log_success "凭据输入完成"
}

# 更新环境文件
update_env_files() {
    log_info "更新环境文件..."
    
    # 备份现有文件
    for env_file in ".env" ".env.local"; do
        if [ -f "$env_file" ]; then
            cp "$env_file" "${env_file}.backup.$(date +%Y%m%d_%H%M%S)"
            log_success "$env_file 已备份"
        fi
    done
    
    # 更新.env文件
    if [ -f ".env" ]; then
        update_env_file ".env"
    else
        create_env_file ".env"
    fi
    
    # 更新.env.local文件
    if [ -f ".env.local" ]; then
        update_env_file ".env.local"
    else
        create_env_file ".env.local"
    fi
    
    log_success "环境文件更新完成"
}

# 更新单个环境文件
update_env_file() {
    local file=$1
    
    # 更新或添加变量
    update_or_add_env_var "$file" "AUTH_GOOGLE_ID" "$CLIENT_ID"
    update_or_add_env_var "$file" "AUTH_GOOGLE_SECRET" "$CLIENT_SECRET"
    update_or_add_env_var "$file" "AUTH_SECRET" "$AUTH_SECRET"
    
    # 确保其他必需变量存在
    if ! grep -q "AUTH_URL=" "$file"; then
        echo "AUTH_URL=\"http://localhost:3000\"" >> "$file"
    fi
    
    if ! grep -q "AUTH_TRUST_HOST=" "$file"; then
        echo "AUTH_TRUST_HOST=\"true\"" >> "$file"
    fi
}

# 创建新的环境文件
create_env_file() {
    local file=$1
    
    cat > "$file" << EOF
# NextAuth.js v5 Configuration
AUTH_GOOGLE_ID="$CLIENT_ID"
AUTH_GOOGLE_SECRET="$CLIENT_SECRET"
AUTH_SECRET="$AUTH_SECRET"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"

# Generated by enhanced-oauth-setup.sh on $(date)
EOF
    
    log_success "创建了新的环境文件: $file"
}

# 更新或添加环境变量
update_or_add_env_var() {
    local file=$1
    local var_name=$2
    local var_value=$3
    
    if grep -q "^${var_name}=" "$file"; then
        # 更新现有变量
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^${var_name}=.*|${var_name}=\"${var_value}\"|" "$file"
        else
            # Linux
            sed -i "s|^${var_name}=.*|${var_name}=\"${var_value}\"|" "$file"
        fi
    else
        # 添加新变量
        echo "${var_name}=\"${var_value}\"" >> "$file"
    fi
}

# 验证配置
validate_configuration() {
    log_info "验证配置..."
    
    # 检查环境变量是否正确设置
    source .env 2>/dev/null || true
    source .env.local 2>/dev/null || true
    
    local validation_passed=true
    
    if [ -z "$AUTH_GOOGLE_ID" ]; then
        log_error "AUTH_GOOGLE_ID未设置"
        validation_passed=false
    fi
    
    if [ -z "$AUTH_GOOGLE_SECRET" ]; then
        log_error "AUTH_GOOGLE_SECRET未设置"
        validation_passed=false
    fi
    
    if [ -z "$AUTH_SECRET" ]; then
        log_error "AUTH_SECRET未设置"
        validation_passed=false
    fi
    
    if [ "$validation_passed" = true ]; then
        log_success "配置验证通过"
    else
        log_error "配置验证失败"
        exit 1
    fi
}

# 运行测试
run_tests() {
    log_info "运行配置测试..."
    
    if [ -f "scripts/test-auth-fix.js" ]; then
        if node scripts/test-auth-fix.js; then
            log_success "配置测试通过"
        else
            log_warning "配置测试发现问题，请检查输出"
        fi
    else
        log_warning "测试脚本不存在，跳过自动测试"
    fi
}

# 显示下一步操作
show_next_steps() {
    echo ""
    echo "🎉 Google OAuth配置完成！"
    echo ""
    echo "📋 下一步操作："
    echo "1. 重启开发服务器: npm run dev"
    echo "2. 访问登录页面: http://localhost:3000/auth/signin"
    echo "3. 测试Google登录功能"
    echo ""
    echo "📚 相关文档："
    echo "- 详细设置指南: docs/google-oauth-setup-guide.md"
    echo "- 可视化指南: docs/google-oauth-visual-guide.md"
    echo "- 验证和发布指南: docs/google-oauth-verification-publishing.md"
    echo "- 故障排除: NEXTAUTH_CSRF_FIX_SUMMARY.md"
    echo ""
    echo "🔧 有用的命令："
    echo "- 测试配置: node scripts/test-auth-fix.js"
    echo "- 查看日志: DEBUG=next-auth* npm run dev"
    echo "- 重新运行设置: ./scripts/enhanced-oauth-setup.sh"
    echo ""
    echo "🚀 生产环境准备："
    echo "- 创建隐私政策页面: /privacy"
    echo "- 创建服务条款页面: /terms"
    echo "- 发布OAuth应用（移除'未验证'警告）"
    echo "- 详细步骤请查看: docs/google-oauth-verification-publishing.md"
    echo ""
}

# 询问是否启动开发服务器
ask_start_dev_server() {
    echo ""
    read -p "是否现在启动开发服务器进行测试？(y/N): " START_DEV
    if [[ $START_DEV =~ ^[Yy]$ ]]; then
        log_info "启动开发服务器..."
        echo ""
        echo "🚀 开发服务器启动中..."
        echo "📱 访问 http://localhost:3000/auth/signin 测试登录"
        echo "🛑 按 Ctrl+C 停止服务器"
        echo ""
        npm run dev
    fi
}

# 主函数
main() {
    echo "🔐 Enhanced Google OAuth Setup Script"
    echo "====================================="
    echo "NextAuth.js v5 + Google Identity Services API"
    echo ""
    
    check_dependencies
    check_nextauth_version
    validate_existing_config
    
    echo ""
    read -p "是否继续OAuth设置流程？(Y/n): " CONTINUE
    if [[ $CONTINUE =~ ^[Nn]$ ]]; then
        log_info "设置已取消"
        exit 0
    fi
    
    generate_auth_secret
    show_google_console_guide
    
    echo ""
    read -p "已完成Google Console设置？(Y/n): " CONSOLE_DONE
    if [[ $CONSOLE_DONE =~ ^[Nn]$ ]]; then
        log_info "请先完成Google Console设置，然后重新运行此脚本"
        exit 0
    fi
    
    input_credentials
    update_env_files
    validate_configuration
    run_tests
    show_next_steps
    ask_start_dev_server
}

# 错误处理
trap 'log_error "脚本执行过程中发生错误，请检查上面的错误信息"' ERR

# 运行主函数
main "$@"