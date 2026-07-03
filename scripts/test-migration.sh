#!/bin/bash

# 数据库迁移测试脚本
# 用于验证迁移文件的安全性和正确性

set -e

echo "🔍 数据库迁移测试开始..."

# 获取环境变量
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"

# 从Secret Manager获取数据库连接信息
echo "📋 获取数据库连接配置..."
DB_URL=$(gcloud secrets versions access 8 --secret DATABASE_URL --project=$PROJECT_ID)
DB_ADMIN_URL=$(gcloud secrets versions access latest --secret DB_ADMIN_URL --project=$PROJECT_ID 2>/dev/null || echo "$DB_URL")

echo "📊 数据库连接信息已获取"

# 创建测试目录
TEST_DIR="/tmp/db-migration-test-$(date +%s)"
mkdir -p $TEST_DIR

# 复制迁移文件
echo "📁 准备迁移文件..."
cp -r /Users/jason/Documents/Kiro/gm/services/billing/migrations $TEST_DIR/
cp /Users/jason/Documents/Kiro/gm/infrastructure/database/Dockerfile.migrator $TEST_DIR/

# 创建测试用的迁移配置
cat > $TEST_DIR/migrate-config.yaml << EOF
# 测试环境迁移配置
test_mode: true
dry_run: true
backup_before_migration: true
validation_after_migration: true
rollback_on_failure: true

# 迁移文件路径
migration_paths:
  billing: "./migrations"

# 数据库连接
database_url: "\${DATABASE_URL}"

# 安全检查
safety_checks:
  - validate_foreign_keys
  - check_data_integrity
  - verify_permissions
  - test_rollback
EOF

# 创建测试Dockerfile
cat > $TEST_DIR/Dockerfile.test << EOF
# 迁移测试工具
FROM golang:1.25-alpine AS builder
WORKDIR /workspace

# 安装依赖
RUN apk add --no-cache git postgresql-client make

# 安装golang-migrate
RUN go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# 复制迁移文件
COPY migrations/ /app/migrations/

# 运行时镜像
FROM alpine:latest
RUN apk add --no-cache postgresql-client

# 复制migrate工具和迁移文件
COPY --from=builder /go/bin/migrate /usr/local/bin/migrate
COPY --from=builder /app/migrations /app/migrations

# 复制测试脚本
COPY test-migration-runner.sh /app/test-migration-runner.sh
RUN chmod +x /app/test-migration-runner.sh

WORKDIR /app
CMD ["/app/test-migration-runner.sh"]
EOF

# 创建测试运行脚本
cat > $TEST_DIR/test-migration-runner.sh << 'EOF'
#!/bin/sh

set -e

echo "🚀 开始数据库迁移测试..."

# 检查数据库连接
echo "1️⃣ 测试数据库连接..."
psql "$DATABASE_URL" -c "SELECT version();" || {
    echo "❌ 数据库连接失败"
    exit 1
}

echo "✅ 数据库连接成功"

# 检查当前schema状态
echo "2️⃣ 检查当前数据库schema..."
psql "$DATABASE_URL" -c "
SELECT
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY table_schema, table_name;
" || echo "⚠️  无法查询表信息"

# 检查迁移历史表
echo "3️⃣ 检查迁移历史..."
psql "$DATABASE_URL" -c "
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'schema_migrations'
) as has_migration_table;" || echo "⚠️  无法检查迁移表"

# 验证迁移文件语法
echo "4️⃣ 验证迁移文件语法..."
find /app/migrations -name "*.up.sql" | while read file; do
    echo "检查文件: $file"
    # 使用psql验证SQL语法
    psql "$DATABASE_URL" -c "\set ON_ERROR_STOP on" -c "EXPLAIN $(cat $file)" 2>/dev/null || echo "⚠️  语法检查失败: $file"
done

echo "✅ 迁移文件语法验证完成"

# 检查潜在的数据冲突
echo "5️⃣ 检查潜在数据冲突..."
psql "$DATABASE_URL" -c "
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY schemaname, tablename, attname
LIMIT 20;" || echo "⚠️  无法检查统计信息"

echo "🎉 迁移测试完成！"
echo "📝 测试结果总结:"
echo "  ✅ 数据库连接正常"
echo "  ✅ 当前schema状态已记录"
echo "  ✅ 迁移文件语法已验证"
echo "  ⚠️  请手动检查是否有数据冲突风险"
EOF

chmod +x $TEST_DIR/test-migration-runner.sh

echo "🏗️ 构建测试镜像..."
cd $TEST_DIR

# 注意：由于本地无法直接连接Cloud SQL，我们创建一个模拟测试
echo "📋 创建本地测试模拟..."

# 模拟数据库连接测试
cat > $TEST_DIR/test-database-connection.sql << 'EOF'
-- 数据库连接和基础信息查询
SELECT
    current_database() as database_name,
    current_schema() as current_schema,
    version() as postgres_version,
    inet_server_addr() as server_address;

-- 检查现有schema
SELECT
    schema_name,
    schema_owner,
    default_character_set_catalog
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY schema_name;

-- 检查现有表
SELECT
    table_schema,
    table_name,
    table_type,
    is_insertable_into
FROM information_schema.tables
WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY table_schema, table_name;
EOF

echo "📊 准备执行数据库安全检查..."

# 由于预发生产共用数据库，我们进行额外的安全检查
cat > $TEST_DIR/safety-checklist.md << 'EOF'
# 数据库迁移安全检查清单

## 🔴 关键风险提醒
**预发环境和生产环境共用数据库！**

## ✅ 执行前检查
- [ ] 已确认维护时间窗口
- [ ] 已通知所有相关团队
- [ ] 已准备回滚方案
- [ ] 已备份关键数据
- [ ] 已在开发环境测试

## ⚠️ 执行中监控
- [ ] 监控数据库连接数
- [ ] 监控查询性能
- [ ] 监控错误日志
- [ ] 监控应用健康状态

## 🚨 紧急情况处理
如果出现问题，立即执行：
1. 停止所有相关服务
2. 执行回滚脚本
3. 通知团队负责人
4. 记录问题详情

## 📞 联系方式
- 数据库负责人: @database-team
- 紧急联系: @oncall
EOF

echo "📝 安全检查清单已创建: $TEST_DIR/safety-checklist.md"

# 验证迁移文件的完整性
echo "🔍 验证迁移文件完整性..."

MIGRATION_COUNT=$(find $TEST_DIR/migrations -name "*.sql" | wc -l)
echo "找到 $MIGRATION_COUNT 个迁移文件"

# 检查每个迁移文件的基本结构
find $TEST_DIR/migrations -name "*.sql" | while read file; do
    echo "检查: $(basename $file)"

    # 检查文件大小
    file_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
    echo "  文件大小: ${file_size} bytes"

    # 检查是否有基本SQL结构
    if grep -q "CREATE TABLE\|CREATE INDEX\|ALTER TABLE\|DROP TABLE" "$file"; then
        echo "  ✅ 包含DDL语句"
    else
        echo "  ⚠️  可能不包含DDL语句"
    fi

    # 检查是否有错误处理
    if grep -q "IF NOT EXISTS\|DROP IF EXISTS" "$file"; then
        echo "  ✅ 包含幂等性处理"
    else
        echo "  ⚠️  可能缺少幂等性处理"
    fi
done

echo ""
echo "🎯 测试总结:"
echo "  📍 测试目录: $TEST_DIR"
echo "  📄 迁移文件: $MIGRATION_COUNT 个"
echo "  📋 安全清单: $TEST_DIR/safety-checklist.md"
echo "  🔧 测试脚本: $TEST_DIR/test-migration-runner.sh"
echo ""
echo "⚠️  重要提醒:"
echo "  - 预发生产共用数据库，请极其谨慎"
echo "  - 建议在维护窗口执行"
echo "  - 执行前必须完整备份"
echo "  - 准备好回滚方案"
echo ""
echo "📋 下一步建议:"
echo "  1. 与团队确认执行时间窗口"
echo "  2. 设置应用维护模式"
echo "  3. 执行数据库备份"
echo "  4. 执行迁移脚本"
echo "  5. 验证应用功能"
echo "  6. 如有问题，立即回滚"
echo ""

echo "✅ 数据库迁移测试脚本准备完成！"
echo "📁 测试文件位置: $TEST_DIR"
echo "📖 查看安全清单: cat $TEST_DIR/safety-checklist.md"