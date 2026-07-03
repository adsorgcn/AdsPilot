#!/bin/bash

# 部署环境变量配置脚本
# 用于在部署时设置正确的环境变量

echo "🔧 Setting up deployment environment variables..."

# 检测部署环境
if [ "$1" = "preview" ]; then
    echo "📋 Configuring for preview environment"
    export NEXT_PUBLIC_DEPLOYMENT_ENV="preview"
    export NEXT_PUBLIC_DOMAIN="urlchecker.dev"
    export AUTH_URL="https://www.urlchecker.dev"
    export NEXT_PUBLIC_URL="https://www.urlchecker.dev"
elif [ "$1" = "production" ]; then
    echo "📋 Configuring for production environment"
    export NEXT_PUBLIC_DEPLOYMENT_ENV="production"
    export NEXT_PUBLIC_DOMAIN="${APP_DOMAIN}"
    export AUTH_URL="https://www.${APP_DOMAIN}"
    export NEXT_PUBLIC_URL="https://www.${APP_DOMAIN}"
else
    echo "📋 Using default/development configuration"
    export NEXT_PUBLIC_DEPLOYMENT_ENV="development"
    export NEXT_PUBLIC_DOMAIN="localhost:3000"
    export AUTH_URL="http://localhost:3000"
    export NEXT_PUBLIC_URL="http://localhost:3000"
fi

# 显示当前配置
echo "✅ Environment Configuration:"
echo "   Deployment Environment: $NEXT_PUBLIC_DEPLOYMENT_ENV"
echo "   Domain: $NEXT_PUBLIC_DOMAIN"
echo "   Auth URL: $AUTH_URL"
echo "   Public URL: $NEXT_PUBLIC_URL"

# 保存到 .env.local 用于构建
cat > .env.local << EOF
# Deployment Environment Configuration
NEXT_PUBLIC_DEPLOYMENT_ENV=$NEXT_PUBLIC_DEPLOYMENT_ENV
NEXT_PUBLIC_DOMAIN=$NEXT_PUBLIC_DOMAIN
AUTH_URL=$AUTH_URL
NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL

# Container Configuration
NEXT_PUBLIC_CONTAINERIZED=true
AUTH_COOKIE_DOMAIN=
AUTH_SKIP_DOMAIN_CHECK=true
EOF

echo "📝 Environment variables saved to .env.local"