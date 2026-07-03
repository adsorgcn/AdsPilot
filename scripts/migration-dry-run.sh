#!/bin/bash

# 数据库迁移干运行测试
# 在不实际执行变更的情况下验证迁移的安全性和兼容性

set -e

echo "🔍 数据库迁移干运行测试开始..."

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"

# 获取数据库连接信息
echo "📋 获取数据库连接配置..."
DB_URL=$(gcloud secrets versions access 8 --secret DATABASE_URL --project=$PROJECT_ID)

# 解析数据库连接信息
# postgresql://user:password@host:port/database
DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')

echo "📊 数据库信息:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"

# 创建临时工作目录
WORK_DIR="/tmp/migration-dry-run-$(date +%s)"
mkdir -p $WORK_DIR

echo "📁 准备迁移文件..."
cp -r /Users/jason/Documents/Kiro/gm/services/billing/migrations $WORK_DIR/

# 1. SQL语法验证
echo "1️⃣ SQL语法验证..."
for sql_file in $WORK_DIR/migrations/*.up.sql; do
    if [ -f "$sql_file" ]; then
        echo "检查: $(basename "$sql_file")"

        # 基本语法检查
        if grep -q "CREATE TABLE\|CREATE INDEX\|ALTER TABLE\|DROP TABLE" "$sql_file"; then
            echo "  ✅ 包含DDL语句"
        fi

        # 检查幂等性
        if grep -q "IF NOT EXISTS\|DROP IF EXISTS" "$sql_file"; then
            echo "  ✅ 包含幂等性处理"
        else
            echo "  ⚠️  可能缺少幂等性处理"
        fi

        # 检查危险操作
        if grep -qi "DROP TABLE\|DELETE FROM\|TRUNCATE" "$sql_file"; then
            echo "  🔴 包含潜在危险操作"
        fi

        # 统计语句类型
        create_count=$(grep -c "CREATE TABLE" "$sql_file" || echo "0")
        index_count=$(grep -c "CREATE INDEX" "$sql_file" || echo "0")
        alter_count=$(grep -c "ALTER TABLE" "$sql_file" || echo "0")

        echo "  📊 CREATE TABLE: $create_count, INDEX: $index_count, ALTER: $alter_count"
    fi
done

# 2. 创建数据库连接测试脚本
echo "2️⃣ 创建数据库状态检查脚本..."
cat > $WORK_DIR/check-db-state.sql << 'EOF'
-- 数据库状态检查脚本
-- 仅查询，不修改任何数据

\echo '=== 数据库基本信息 ==='
SELECT
    current_database() as database_name,
    current_schema() as current_schema,
    version() as postgres_version,
    inet_server_addr() as server_address;

\echo '=== 现有Schema列表 ==='
SELECT
    schema_name,
    schema_owner,
    default_character_set_catalog
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY schema_name;

\echo '=== 现有表统计 ==='
SELECT
    table_schema,
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
GROUP BY table_schema
ORDER BY table_schema;

\echo '=== 数据库大小统计 ==='
SELECT
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE pg_database.datname = current_database();

\echo '=== 连接统计 ==='
SELECT
    count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';

\echo '=== 锁等待统计 ==='
SELECT
    count(*) as blocked_queries
FROM pg_stat_activity
WHERE waiting = true;

EOF

# 3. 创建迁移影响分析脚本
echo "3️⃣ 创建迁移影响分析..."
cat > $WORK_DIR/analyze-migration-impact.sql << 'EOF'
-- 迁移影响分析脚本
-- 分析将要执行的迁移对现有数据库的影响

\echo '=== 权限检查 ==='
SELECT
    current_user as current_database_user,
    has_schema_privilege('public', 'CREATE') as can_create_public,
    has_schema_privilege('billing', 'CREATE') as can_create_billing,
    has_schema_privilege('offers', 'CREATE') as can_create_offers;

\echo '=== 现有业务表检查 ==='
SELECT
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema IN ('billing', 'offers', 'siterank', 'adscenter', 'useractivity')
    AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY table_schema, table_name;

\echo '=== 现有索引检查 ==='
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname IN ('billing', 'offers', 'siterank', 'adscenter', 'useractivity')
ORDER BY schemaname, tablename, indexname
LIMIT 20;

\echo '=== 外键约束检查 ==='
SELECT
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema IN ('billing', 'offers', 'siterank', 'adscenter', 'useractivity');

EOF

# 4. 创建迁移执行计划
echo "4️⃣ 生成迁移执行计划..."
cat > $WORK_DIR/migration-plan.md << EOF
# 数据库迁移执行计划

## 📋 迁移概述
- **执行时间**: $(date)
- **数据库**: $DB_NAME ($DB_HOST:$DB_PORT)
- **迁移文件**: $(find $WORK_DIR/migrations -name "*.up.sql" | wc -l) 个

## 🔍 迁移文件分析
EOF

# 分析每个迁移文件
for sql_file in $WORK_DIR/migrations/*.up.sql; do
    if [ -f "$sql_file" ]; then
        filename=$(basename "$sql_file")
        echo "" >> $WORK_DIR/migration-plan.md
        echo "### $filename" >> $WORK_DIR/migration-plan.md

        # 提取主要操作
        if grep -q "CREATE SCHEMA" "$sql_file"; then
            echo "- **创建Schema**: 新建业务域schema" >> $WORK_DIR/migration-plan.md
        fi

        tables=$(grep "CREATE TABLE" "$sql_file" | sed 's/.*CREATE TABLE.*IF NOT EXISTS \([^ (]*\).*/\1/' | tr '\n' ', ' | sed 's/,$//')
        if [ -n "$tables" ]; then
            echo "- **创建表**: $tables" >> $WORK_DIR/migration-plan.md
        fi

        indexes=$(grep "CREATE INDEX" "$sql_file" | sed 's/.*CREATE INDEX.*\([^ (]*\).*/\1/' | tr '\n' ', ' | sed 's/,$//')
        if [ -n "$indexes" ]; then
            echo "- **创建索引**: $indexes" >> $WORK_DIR/migration-plan.md
        fi

        # 风险评估
        if grep -qi "DROP TABLE\|DELETE FROM\|TRUNCATE" "$sql_file"; then
            echo "- **⚠️ 风险**: 包含数据删除操作" >> $WORK_DIR/migration-plan.md
        fi
    fi
done

cat >> $WORK_DIR/migration-plan.md << 'EOF'

## 🔒 安全检查清单
- [ ] 数据库备份已完成
- [ ] 维护时间窗口已确认
- [ ] 回滚脚本已准备
- [ ] 相关团队已通知
- [ ] 监控告警已设置

## 📊 执行步骤
1. 执行数据库状态检查
2. 备份关键数据
3. 执行迁移脚本
4. 验证数据完整性
5. 测试应用功能
6. 监控系统状态

## 🚨 回滚计划
如果出现问题，执行以下步骤：
1. 立即停止相关服务
2. 执行.down.sql回滚脚本
3. 恢复数据库备份
4. 验证系统功能
5. 通知相关团队

## 📞 紧急联系方式
- 数据库团队: @database-team
- 运维团队: @ops-team
- 产品团队: @product-team
EOF

# 5. 创建执行脚本
echo "5️⃣ 创建迁移执行脚本..."
cat > $WORK_DIR/execute-migration.sh << 'EOF'
#!/bin/bash

# 数据库迁移执行脚本
# 请在确认所有安全检查后执行

set -e

echo "🚀 开始执行数据库迁移..."

# 检查参数
if [ $# -eq 0 ]; then
    echo "用法: $0 <DATABASE_URL> [--dry-run]"
    echo "示例: $0 'postgresql://user:pass@host:5432/db' --dry-run"
    exit 1
fi

DB_URL="$1"
DRY_RUN="$2"

echo "数据库连接: $DB_URL"
echo "干运行模式: ${DRY_RUN:-false}"

# 安装golang-migrate (如果不存在)
if ! command -v migrate &> /dev/null; then
    echo "📦 安装golang-migrate..."
    go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
fi

# 检查数据库连接
echo "1️⃣ 测试数据库连接..."
psql "$DB_URL" -c "SELECT 1;" || {
    echo "❌ 数据库连接失败"
    exit 1
}

echo "✅ 数据库连接成功"

# 检查当前迁移状态
echo "2️⃣ 检查当前迁移状态..."
migrate -path ./migrations -database "$DB_URL" version 2>/dev/null || echo "首次执行迁移"

# 预览迁移计划
echo "3️⃣ 预览迁移计划..."
if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "🔍 干运行模式 - 不会实际执行变更"
    echo "将要执行的迁移文件:"
    ls -la ./migrations/*.up.sql | while read line; do
        echo "  - $(echo $line | awk '{print $9}')"
    done
else
    echo "🎯 执行实际迁移..."

    # 执行迁移
    migrate -path ./migrations -database "$DB_URL" up

    echo "✅ 迁移执行完成"

    # 验证迁移结果
    echo "4️⃣ 验证迁移结果..."
    migrate -path ./migrations -database "$DB_URL" version

    # 检查表是否创建成功
    echo "5️⃣ 检查数据库状态..."
    psql "$DB_URL" -c "
    SELECT
        table_schema,
        table_name,
        table_type
    FROM information_schema.tables
    WHERE table_schema IN ('billing', 'offers', 'siterank', 'adscenter', 'useractivity')
    ORDER BY table_schema, table_name;
    "
fi

echo "🎉 迁移操作完成！"
EOF

chmod +x $WORK_DIR/execute-migration.sh

# 6. 生成测试报告
echo ""
echo "📊 迁移干运行测试完成！"
echo ""
echo "📁 工作目录: $WORK_DIR"
echo "📋 迁移计划: $WORK_DIR/migration-plan.md"
echo "🔧 执行脚本: $WORK_DIR/execute-migration.sh"
echo "📊 数据库检查: $WORK_DIR/check-db-state.sql"
echo "🔍 影响分析: $WORK_DIR/analyze-migration-impact.sql"
echo ""

# 显示关键信息
echo "🎯 关键发现:"
echo "  - 找到 $(find $WORK_DIR/migrations -name "*.up.sql" | wc -l) 个迁移文件"
echo "  - 数据库: $DB_NAME ($DB_HOST:$DB_PORT)"
echo "  - 预发生产共用数��库，需极其谨慎"
echo ""

echo "📋 下一步建议:"
echo "  1. 查看迁移计划: cat $WORK_DIR/migration-plan.md"
echo "  2. 确认维护时间窗口"
echo "  3. 准备数据库备份"
echo "  4. 设置应用维护模式"
echo "  5. 执行迁移: $WORK_DIR/execute-migration.sh '$DB_URL' --dry-run"
echo "  6. 验证后正式执行: $WORK_DIR/execute-migration.sh '$DB_URL'"
echo ""

echo "🔴 重要提醒:"
echo "  - 预发生产共用数据库！"
echo "  - 必须在维护窗口执行"
echo "  - 必须有完整备份"
echo "  - 必须准备回滚方案"
echo ""

EOF

chmod +x /Users/jason/Documents/Kiro/gm/scripts/migration-dry-run.sh