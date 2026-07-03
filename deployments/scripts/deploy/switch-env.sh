#!/bin/bash

# 环境切换脚本
set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
    echo "❌ 请指定环境"
    echo "用法: ./switch-env.sh <environment>"
    echo "支持的环境: development, preview, production"
    exit 1
fi

echo "🔄 切换到 $ENVIRONMENT 环境"
echo "=========================="

# 停止当前环境
echo "⏹️  停止当前服务..."
docker-compose down

# 启动新环境
COMPOSE_FILE="docker/docker-compose.$ENVIRONMENT.yml"
echo "🚀 启动 $ENVIRONMENT 环境..."
docker-compose -f $COMPOSE_FILE up -d

echo "✅ 环境切换完成!"