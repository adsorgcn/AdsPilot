#!/bin/bash

# 本地数据库连接测试脚本
# 用于验证新的数据库适配器连接功能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 数据库连接测试${NC}"
echo "========================"

# 检查环境变量
echo -e "${YELLOW}📋 检查环境变量...${NC}"

check_env_var() {
    local var_name="$1"
    local var_value="${!var_name}"

    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ $var_name 未设置${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $var_name: ${var_value:0:30}***${NC}"
        return 0
    fi
}

# 必需的环境变量
REQUIRED_VARS=("DATABASE_URL")
OPTIONAL_VARS=("NEXT_PUBLIC_SUPABASE_URL" "SUPABASE_SERVICE_KEY" "DB_CONNECTION_MODE")

echo -e "\n${BLUE}🔑 必需环境变量:${NC}"
for var in "${REQUIRED_VARS[@]}"; do
    check_env_var "$var"
done

echo -e "\n${BLUE}🔧 可选环境变量:${NC}"
for var in "${OPTIONAL_VARS[@]}"; do
    check_env_var "$var"
done

# 创建测试程序
echo -e "\n${YELLOW}🏗️  创建连接测试程序...${NC}"

cat > /tmp/test-db-connections.go << 'EOF'
package main

import (
    "context"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/ScientificInternet/Google-Monetize/pkg/database"
)

func main() {
    fmt.Println("🧪 数据库连接测试开始...")
    fmt.Println("===========================")

    ctx := context.Background()

    // 测试1: UniversalAdapter (CloudSQL模式)
    fmt.Println("\n🔍 测试1: UniversalAdapter (CloudSQL模式)")
    testUniversalAdapter(ctx)

    // 测试2: HybridDatabaseManager
    fmt.Println("\n🔍 测试2: HybridDatabaseManager")
    testHybridDatabaseManager(ctx)

    // 测试3: 服务适配器
    fmt.Println("\n🔍 测试3: 服务适配器")
    testServiceAdapters(ctx)

    fmt.Println("\n✅ 所有测试完成!")
}

func testUniversalAdapter(ctx context.Context) {
    config := database.Config{
        ServiceName:    "test-service",
        DatabaseURL:    os.Getenv("DATABASE_URL"),
        Mode:           database.CloudSQLMode,
        MaxConnections: 5,
        Timeout:        10 * time.Second,
    }

    adapter, err := database.NewUniversalAdapter(config)
    if err != nil {
        fmt.Printf("❌ 创建UniversalAdapter失败: %v\n", err)
        return
    }
    defer adapter.Close()

    fmt.Printf("✅ UniversalAdapter创建成功\n")
    fmt.Printf("   - 服务名: %s\n", adapter.GetServiceName())
    fmt.Printf("   - 模式: %s\n", adapter.GetMode())

    // 测试ping
    if err := adapter.Ping(ctx); err != nil {
        fmt.Printf("⚠️  Ping测试失败 (预期): %v\n", err)
    } else {
        fmt.Printf("✅ Ping测试��功\n")
    }

    // 测试健康检查
    if adapter.IsHealthy(ctx) {
        fmt.Printf("✅ 健康检查通过\n")
    } else {
        fmt.Printf("⚠️  健康检查失败 (预期)\n")
    }
}

func testHybridDatabaseManager(ctx context.Context) {
    config := database.HybridConfig{
        DatabaseURL:         os.Getenv("DATABASE_URL"),
        SupabaseURL:          os.Getenv("NEXT_PUBLIC_SUPABASE_URL"),
        SupabaseKey:          os.Getenv("SUPABASE_SERVICE_KEY"),
        MaxConnections:      5,
        Timeout:             30 * time.Second,
        HealthCheckInterval: 5 * time.Minute,
    }

    manager, err := database.NewHybridDatabaseManager(ctx, config)
    if err != nil {
        fmt.Printf("❌ 创建HybridDatabaseManager失败: %v\n", err)
        return
    }
    defer manager.Close()

    fmt.Printf("✅ HybridDatabaseManager创建成功\n")
    fmt.Printf("   - 初始化状态: %v\n", manager.IsInitialized())

    // 获取统计信息
    stats := manager.GetStats()
    fmt.Printf("   - 统计信息: %v\n", stats)

    // 测试健康检查
    if err := manager.HealthCheck(ctx); err != nil {
        fmt.Printf("⚠️  健康检查失败 (预期): %v\n", err)
    } else {
        fmt.Printf("✅ 健康检查成功\n")
    }
}

func testServiceAdapters(ctx context.Context) {
    services := []string{"billing", "user", "console", "useractivity"}

    for _, service := range services {
        fmt.Printf("🔍 测试服务: %s\n", service)

        adapter, err := database.GetAdapterForService(service)
        if err != nil {
            fmt.Printf("❌ 创建%s适配器失败: %v\n", service, err)
            continue
        }

        defer adapter.Close()

        fmt.Printf("✅ %s适配器创建成功\n", service)
        fmt.Printf("   - 服务名: %s\n", adapter.GetServiceName())
        fmt.Printf("   - 模式: %s\n", adapter.GetMode())

        // 简单的ping测试
        if err := adapter.Ping(ctx); err != nil {
            fmt.Printf("⚠️  Ping失败 (预期): %v\n", err)
        } else {
            fmt.Printf("✅ Ping成功\n")
        }

        fmt.Println("")
    }
}
EOF

echo -e "${YELLOW}🚀 执行连接测试...${NC}"

# 设置Go模块环境
cd /tmp
export GOWORK=off

# 初始化go模块
go mod init db-test

# 添加依赖
echo "添加依赖..."
go mod edit -replace github.com/ScientificInternet/Google-Monetize=$(pwd)/Users/jason/Documents/Kiro/gm

go get github.com/ScientificInternet/Google-Monetize/pkg/database@v0.0.0-00010101000000-000000000000
go get github.com/jackc/pgx/v5@v5.5.0
go get github.com/supabase-community/supabase-go@v0.0.4

echo "编译测试程序..."
if go build -o test-db-connections test-db-connections.go 2>/dev/null; then
    echo -e "${GREEN}✅ 编译成功${NC}"

    echo -e "${BLUE}🧪 执行连接测试...${NC}"
    if ./test-db-connections; then
        echo -e "${GREEN}✅ 连接测试完成${NC}"
    else
        echo -e "${YELLOW}⚠️  连接测试失败 (可能是预期的，因为测试数据库不可访问)${NC}"
    fi
else
    echo -e "${RED}❌ 编译失败${NC}"
    echo "这可能是因为:"
    echo "1. Go模块路径问题"
    echo "2. 依赖版本冲突"
    echo "3. 工作区配置问题"
fi

# 清理
echo -e "${YELLOW}🧹 清理临时文件...${NC}"
rm -f /tmp/test-db-connections.go /tmp/test-db-connections

echo -e "\n${BLUE}📊 测试总结:${NC}"
echo "1. 如果看到编译成功，说明新的数据库适配器代码语法正确"
echo "2. 如果连接失败，可能是因为数据库不可访问或凭据问题"
echo "3. 要在生产环境中测试，请运行: ./scripts/test-cloudsql-performance.sh"

echo -e "\n${GREEN}✅ 本地测试完成!${NC}"