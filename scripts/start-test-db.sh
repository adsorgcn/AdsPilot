#!/bin/bash

# 启动测试数据库脚本

set -e

echo "🚀 Starting test database..."

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    exit 1
fi

# 启动 Docker Compose
docker-compose -f docker-compose.test.yml up -d

# 等待数据库就绪
echo "⏳ Waiting for database to be ready..."
sleep 5

# 检查数据库健康状态
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose -f docker-compose.test.yml exec -T postgres pg_isready -U test -d gm_test > /dev/null 2>&1; then
        echo "✅ Test database is ready!"
        echo ""
        echo "📊 Database connection info:"
        echo "   URL: postgresql://test:test@localhost:5433/gm_test"
        echo "   Host: localhost"
        echo "   Port: 5433"
        echo "   Database: gm_test"
        echo "   User: test"
        echo "   Password: test"
        echo ""
        echo "🧪 Run tests with:"
        echo "   export TEST_DATABASE_URL='postgresql://test:test@localhost:5433/gm_test?sslmode=disable'"
        echo "   go test ./services/offer/internal/handlers/... -v"
        echo ""
        echo "🛑 Stop test database with:"
        echo "   ./scripts/stop-test-db.sh"
        exit 0
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Attempt $RETRY_COUNT/$MAX_RETRIES..."
    sleep 2
done

echo "❌ Error: Database failed to start after $MAX_RETRIES attempts"
docker-compose -f docker-compose.test.yml logs postgres
exit 1
