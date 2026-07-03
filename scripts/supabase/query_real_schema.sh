#!/bin/bash
# 查询Supabase真实数据库结构
# Query real Supabase database schema

set -e

# Supabase connection details
DB_HOST="aws-0-ap-northeast-1.pooler.supabase.com"
DB_PORT="6543"
DB_NAME="postgres"
DB_USER="postgres.YOUR_SUPABASE_PROJECT"
DB_PASSWORD='*HF#9dFnzV5DBA.'

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

echo "🔌 正在连接Supabase数据库..."
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Test connection
echo "==================== 测试连接 ===================="
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT version();" || {
    echo "❌ 连接失败，尝试使用直接连接..."
    DB_HOST="db.YOUR_SUPABASE_PROJECT.supabase.co"
    DB_PORT="5432"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "postgres" -d "$DB_NAME" \
      -c "SELECT version();"
  }

echo ""
echo "==================== 所有Schema ===================="
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
ORDER BY schema_name;
"

echo ""
echo "==================== 按Schema统计表 ===================="
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
    table_schema,
    COUNT(*) as table_count,
    string_agg(table_name, ', ' ORDER BY table_name) as tables
FROM information_schema.tables
WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
  AND table_type = 'BASE TABLE'
GROUP BY table_schema
ORDER BY table_schema;
"

echo ""
echo "==================== Public Schema所有表 ===================="
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
"

echo ""
echo "==================== Auth Schema表 ===================="
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'auth'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
"

echo ""
echo "==================== 数据库大小 ===================="
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
"

echo ""
echo "==================== Schema大小 ===================="
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
    schemaname,
    pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))::bigint) as size,
    COUNT(*) as table_count
FROM pg_tables
WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
GROUP BY schemaname
ORDER BY SUM(pg_total_relation_size(schemaname||'.'||tablename)) DESC;
"

echo ""
echo "✅ 查询完成！"
