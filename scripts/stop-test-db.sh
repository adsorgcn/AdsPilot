#!/bin/bash

# 停止测试数据库脚本

set -e

echo "🛑 Stopping test database..."

# 停止 Docker Compose
docker-compose -f docker-compose.test.yml down

echo "✅ Test database stopped"
echo ""
echo "💡 To remove all data, run:"
echo "   docker-compose -f docker-compose.test.yml down -v"
