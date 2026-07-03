#!/bin/bash

# Google-Monetize SaaS 部署脚本 - 单镜像部署
# 使用方法: ./scripts/deploy-gm-saas.sh [preview|production]

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-preview}

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
Google-Monetize SaaS 部署脚本 - 单镜像部署

使用方法:
    $0 [preview|production] [options]

环境:
    preview     部署到预发环境 (urlchecker.dev)
    production  部署到生产环境 (${APP_DOMAIN})

选项:
    --build-only        仅构建镜像，不部署
    --skip-tests        跳过测试
    --force             强制部署（跳过确认）
    --help              显示此帮助信息

示例:
    $0 preview                    # 部署到预发环境
    $0 production --force         # 强制部署到生产环境
    $0 preview --build-only       # 仅构建预发环境镜像

EOF
}

# 解析命令行参数
BUILD_ONLY=false
SKIP_TESTS=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        preview|production)
            ENVIRONMENT="$1"
            shift
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查环境
check_environment() {
    log_info "检查部署环境: $ENVIRONMENT"
    
    if [[ "$ENVIRONMENT" != "preview" && "$ENVIRONMENT" != "production" ]]; then
        log_error "无效的环境: $ENVIRONMENT. 请使用 'preview' 或 'production'"
        exit 1
    fi
    
    # 检查必要的工具
    command -v docker >/dev/null 2>&1 || { log_error "Docker 未安装"; exit 1; }
    command -v git >/dev/null 2>&1 || { log_error "Git 未安装"; exit 1; }
    
    # 检查是否在正确的分支
    current_branch=$(git branch --show-current)
    if [[ "$ENVIRONMENT" == "production" && "$current_branch" != "production" ]]; then
        log_warn "当前分支: $current_branch，生产环境建议使用 production 分支"
        if [[ "$FORCE" != "true" ]]; then
            read -p "是否继续？(y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
}

# 加载环境变量
load_env() {
    local env_file="$PROJECT_DIR/.env.$ENVIRONMENT"
    
    if [[ -f "$env_file" ]]; then
        log_info "加载环境变量: $env_file"
        set -a
        source "$env_file"
        set +a
    else
        log_warn "环境变量文件不存在: $env_file"
        log_info "将使用系统环境变量"
    fi
}

# 运行测试
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_info "跳过测试"
        return 0
    fi
    
    log_info "运行测试..."
    
    # Go 测试
    log_debug "运行 Go 测试..."
    cd "$PROJECT_DIR/gofly_admin_v3"
    go test -v -race ./... || { log_error "Go 测试失败"; return 1; }
    
    # 前端测试
    log_debug "运行前端测试..."
    cd "$PROJECT_DIR"
    npm test -- --run --silent || { log_error "前端测试失败"; return 1; }
    
    log_info "✅ 所有测试通过"
}

# 构建镜像
build_image() {
    log_info "构建Docker镜像..."
    
    cd "$PROJECT_DIR"
    
    # 设置构建参数
    local build_args=""
    local image_tag=""
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        build_args="--build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=production --build-arg NEXT_PUBLIC_DOMAIN=${APP_DOMAIN}"
        image_tag="gm-saas:production"
    else
        build_args="--build-arg NEXT_PUBLIC_DEPLOYMENT_ENV=preview --build-arg NEXT_PUBLIC_DOMAIN=urlchecker.dev"
        image_tag="gm-saas:preview"
    fi
    
    # 构建镜像
    log_debug "构建命令: docker build -f Dockerfile.gm-saas $build_args -t $image_tag ."
    docker build -f Dockerfile.gm-saas $build_args -t "$image_tag" . || {
        log_error "镜像构建失败"
        return 1
    }
    
    log_info "✅ 镜像构建完成: $image_tag"
}

# 推送镜像到注册表
push_image() {
    log_info "推送镜像到GitHub Container Registry..."
    
    local local_tag=""
    local remote_tag=""
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        local_tag="gm-saas:production"
        remote_tag="ghcr.io/ScientificInternet/Google-Monetize:prod-latest"
    else
        local_tag="gm-saas:preview"
        remote_tag="ghcr.io/ScientificInternet/Google-Monetize:preview-latest"
    fi
    
    # 标记镜像
    docker tag "$local_tag" "$remote_tag" || {
        log_error "镜像标记失败"
        return 1
    }
    
    # 推送镜像
    docker push "$remote_tag" || {
        log_error "镜像推送失败"
        return 1
    }
    
    log_info "✅ 镜像推送完成: $remote_tag"
}

# 部署应用
deploy_app() {
    log_info "部署应用到 $ENVIRONMENT 环境..."
    
    local domain=""
    local image_tag=""
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        domain="${APP_DOMAIN}"
        image_tag="ghcr.io/ScientificInternet/Google-Monetize:prod-latest"
    else
        domain="urlchecker.dev"
        image_tag="ghcr.io/ScientificInternet/Google-Monetize:preview-latest"
    fi
    
    cat << EOF

🚀 部署信息
===========
环境: $ENVIRONMENT
域名: $domain
镜像: $image_tag

📋 ClawCloud 手动部署步骤:
1. 登录 ClawCloud 控制台
2. 导航到 gm-$ENVIRONMENT 服务
3. 更新镜像为: $image_tag
4. 配置环境变量（参考 .env.$ENVIRONMENT.template）
5. 设置容器规格: 2C4G
6. 配置端口映射: 8888
7. 重启服务
8. 验证健康检查: https://www.$domain/health

📝 关键环境变量:
- NODE_ENV=production
- NEXT_PUBLIC_DOMAIN=$domain
- NEXT_PUBLIC_DEPLOYMENT_ENV=$ENVIRONMENT
- DATABASE_URL=mysql://...
- REDIS_URL=redis://...
- AUTH_SECRET=...
- GOOGLE_CLIENT_ID=...
- GOOGLE_CLIENT_SECRET=...

EOF
    
    if [[ "$FORCE" != "true" ]]; then
        read -p "请确认已完成手动部署步骤 (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "部署已取消"
            return 1
        fi
    fi
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local domain=""
    if [[ "$ENVIRONMENT" == "production" ]]; then
        domain="www.${APP_DOMAIN}"
    else
        domain="www.urlchecker.dev"
    fi
    
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log_debug "健康检查尝试 $attempt/$max_attempts"
        
        if curl -f -s "https://$domain/health" >/dev/null 2>&1; then
            log_info "✅ 健康检查通过"
            
            # 显示详细健康信息
            log_debug "获取详细健康信息..."
            curl -s "https://$domain/health" | jq '.' 2>/dev/null || echo "健康检查响应正常"
            
            return 0
        fi
        
        log_warn "健康检查失败，等待 10 秒后重试..."
        sleep 10
        ((attempt++))
    done
    
    log_error "健康检查失败，部署可能有问题"
    return 1
}

# 部署后验证
post_deploy_verification() {
    log_info "执行部署后验证..."
    
    local domain=""
    if [[ "$ENVIRONMENT" == "production" ]]; then
        domain="www.${APP_DOMAIN}"
    else
        domain="www.urlchecker.dev"
    fi
    
    # API 可用性检查
    log_debug "检查 API 可用性..."
    curl -f -s "https://$domain/api/health" >/dev/null || {
        log_error "API 健康检查失败"
        return 1
    }
    
    # 前端可用性检查
    log_debug "检查前端可用性..."
    curl -f -s "https://$domain/" >/dev/null || {
        log_error "前端可用性检查失败"
        return 1
    }
    
    log_info "✅ 部署后验证通过"
}

# 发送通知
send_notification() {
    local status=$1
    local message="Google-Monetize SaaS 部署到 $ENVIRONMENT 环境"
    
    if [[ $status -eq 0 ]]; then
        message="$message 成功 ✅"
    else
        message="$message 失败 ❌"
    fi
    
    # 发送 Slack 通知（如果配置了 webhook）
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    log_info "通知: $message"
}

# 清理函数
cleanup() {
    log_info "清理临时文件和旧镜像..."
    
    # 删除未使用的镜像
    docker image prune -f >/dev/null 2>&1 || true
    
    log_info "✅ 清理完成"
}

# 主函数
main() {
    log_info "开始 Google-Monetize SaaS 部署流程..."
    log_info "环境: $ENVIRONMENT"
    
    # 检查环境
    check_environment
    
    # 加载环境变量
    load_env
    
    # 运行测试
    if ! run_tests; then
        log_error "测试失败，部署终止"
        exit 1
    fi
    
    # 构建镜像
    if ! build_image; then
        log_error "镜像构建失败，部署终止"
        exit 1
    fi
    
    # 如果只是构建，则退出
    if [[ "$BUILD_ONLY" == "true" ]]; then
        log_info "✅ 镜像构建完成（仅构建模式）"
        cleanup
        exit 0
    fi
    
    # 推送镜像
    if ! push_image; then
        log_error "镜像推送失败，部署终止"
        exit 1
    fi
    
    # 部署应用
    if ! deploy_app; then
        log_error "应用部署失败"
        send_notification 1
        exit 1
    fi
    
    # 健康检查
    if ! health_check; then
        log_error "健康检查失败"
        send_notification 1
        exit 1
    fi
    
    # 部署后验证
    if ! post_deploy_verification; then
        log_error "部署后验证失败"
        send_notification 1
        exit 1
    fi
    
    # 清理
    cleanup
    
    # 发送成功通知
    send_notification 0
    
    log_info "🎉 Google-Monetize SaaS 部署成功完成！"
    
    # 显示部署摘要
    cat << EOF

📊 部署摘要
===========
环境: $ENVIRONMENT
时间: $(date)
镜像: ghcr.io/ScientificInternet/Google-Monetize:${ENVIRONMENT}-latest
状态: ✅ 成功

🔗 访问链接:
EOF
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo "- 主站: https://www.${APP_DOMAIN}"
        echo "- 健康检查: https://www.${APP_DOMAIN}/health"
        echo "- API: https://www.${APP_DOMAIN}/api"
    else
        echo "- 主站: https://www.urlchecker.dev"
        echo "- 健康检查: https://www.urlchecker.dev/health"
        echo "- API: https://www.urlchecker.dev/api"
    fi
}

# 处理中断信号
trap 'log_error "部署被中断"; cleanup; exit 1' INT TERM

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi