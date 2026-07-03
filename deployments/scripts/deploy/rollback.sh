#!/bin/bash

# 回滚脚本
set -e

ENVIRONMENT=${1:-preview}
VERSION=${2}

if [ -z "$VERSION" ]; then
    echo "❌ 请指定回滚版本"
    echo "用法: ./rollback.sh <environment> <version>"
    exit 1
fi

echo "🔄 回滚到版本 $VERSION (环境: $ENVIRONMENT)"
echo "=================================="

PROJECT_NAME="admin-system"
IMAGE_NAME="$PROJECT_NAME:$VERSION"
COMPOSE_FILE="docker/docker-compose.$ENVIRONMENT.yml"

# 检查镜像是否存在
if ! docker image inspect $IMAGE_NAME > /dev/null 2>&1; then
    echo "❌ 镜像不存在: $IMAGE_NAME"
    exit 1
fi

# 更新服务
echo "🔄 更新服务..."
docker-compose -f $COMPOSE_FILE up -d

# 健康检查
echo "🏥 执行健康检查..."
sleep 10

if docker-compose -f $COMPOSE_FILE exec app curl -f http://localhost:3000/api/health; then
    echo "✅ 回滚成功!"
else
    echo "❌ 回滚失败"
    docker-compose -f $COMPOSE_FILE logs app
    exit 1
fi