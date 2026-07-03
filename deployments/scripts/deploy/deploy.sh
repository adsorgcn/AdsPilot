#!/bin/bash

# 部署脚本
set -e

ENVIRONMENT=${1:-preview}
VERSION=${2:-latest}

echo "🚀 部署到 $ENVIRONMENT 环境 (版本: $VERSION)"
echo "=================================="

# 检查环境参数
if [[ ! "$ENVIRONMENT" =~ ^(development|preview|production)$ ]]; then
    echo "❌ 无效的环境: $ENVIRONMENT"
    echo "支持的环境: development, preview, production"
    exit 1
fi

# 设置镜像名称
case $ENVIRONMENT in
    "development")
        IMAGE_NAME="ghcr.io/ScientificInternet/url-batch-checker:dev-$VERSION"
        DOMAIN="http://localhost:3000"
        ;;
    "preview")
        IMAGE_NAME="ghcr.io/ScientificInternet/url-batch-checker:preview-latest"
        DOMAIN="https://urlchecker.dev"
        ;;
    "production")
        if [[ "$VERSION" == "latest" ]]; then
            IMAGE_NAME="ghcr.io/ScientificInternet/url-batch-checker:prod-latest"
        else
            IMAGE_NAME="ghcr.io/ScientificInternet/url-batch-checker:prod-$VERSION"
        fi
        DOMAIN="https://${APP_DOMAIN}"
        ;;
esac

echo "📦 目标镜像: $IMAGE_NAME"
echo "🌐 目标域名: $DOMAIN"
echo ""

# 检查镜像是否存在
echo "🔍 检查Docker镜像..."
if ! docker manifest inspect $IMAGE_NAME > /dev/null 2>&1; then
    echo "❌ Docker镜像不存在: $IMAGE_NAME"
    echo ""
    echo "📋 请确保:"
    echo "1. 代码已推送到正确的分支"
    echo "2. GitHub Actions 构建已完成"
    echo "3. 镜像已成功推送到 ghcr.io"
    exit 1
fi

echo "✅ Docker镜像存在"
echo ""

# 显示部署说明
echo "📋 ClawCloud 部署说明"
echo "===================="
echo ""
echo "请按照以下步骤在 ClawCloud 上完成部署:"
echo ""
echo "1. 登录 ClawCloud 管理面板"
echo "2. 选择 $ENVIRONMENT 环境配置"
echo "3. 更新 Docker 镜像地址为: $IMAGE_NAME"
echo "4. 确认环境变量配置正确:"

case $ENVIRONMENT in
    "preview")
        echo "   - NEXTAUTH_URL=https://urlchecker.dev"
        echo "   - NODE_ENV=production"
        ;;
    "production")
        echo "   - NEXTAUTH_URL=https://${APP_DOMAIN}"
        echo "   - NODE_ENV=production"
        ;;
esac

echo "5. 点击部署按钮"
echo "6. 等待部署完成"
echo "7. 验证部署结果: $DOMAIN/api/health"
echo ""

# 如果是开发环境，可以本地部署
if [[ "$ENVIRONMENT" == "development" ]]; then
    echo "🔧 本地开发环境部署"
    echo "=================="
    
    COMPOSE_FILE="docker/docker-compose.yml"
    
    if [ -f "$COMPOSE_FILE" ]; then
        echo "🚀 启动本地服务..."
        docker-compose -f $COMPOSE_FILE up -d
        
        echo "⏳ 等待服务启动..."
        sleep 15
        
        echo "🏥 执行健康检查..."
        if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
            echo "✅ 本地部署成功!"
            echo "🌐 访问地址: http://localhost:3000"
        else
            echo "❌ 健康检查失败"
            echo "📋 查看日志: docker-compose -f $COMPOSE_FILE logs"
        fi
    else
        echo "❌ Docker Compose文件不存在: $COMPOSE_FILE"
    fi
else
    echo "💡 提示: 这是一个自动化部署脚本说明"
    echo "实际部署需要在 ClawCloud 管理面板中手动操作"
fi

echo ""
echo "🎉 部署流程完成!"