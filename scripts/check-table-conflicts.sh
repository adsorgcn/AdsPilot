#!/bin/bash
# 检查数据库中是否存在表名冲突
# Usage: ./scripts/check-table-conflicts.sh

set -e

DATABASE_URL=$(gcloud secrets versions access latest --secret=DATABASE_URL 2>/dev/null)

if [ -z "$DATABASE_URL" ]; then
    echo "Error: Unable to fetch DATABASE_URL from Secret Manager"
    exit 1
fi

echo "========================================="
echo "数据库表名冲突检查"
echo "========================================="
echo ""

echo "1. 检查重复的表名..."
psql "$DATABASE_URL" <<'EOF'
SELECT table_name, COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
GROUP BY table_name
HAVING COUNT(*) > 1
ORDER BY table_name;
EOF

echo ""
echo "2. 检查所有表及其所属schema..."
psql "$DATABASE_URL" <<'EOF'
SELECT
    table_schema,
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE c.table_schema = columns.table_schema AND c.table_name = columns.table_name) as column_count
FROM information_schema.tables c
WHERE table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;
EOF

echo ""
echo "3. 检查idempotency_keys表..."
psql "$DATABASE_URL" <<'EOF'
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name LIKE '%idempotency%'
ORDER BY table_name, ordinal_position;
EOF

echo ""
echo "4. 检查User表..."
psql "$DATABASE_URL" <<'EOF'
SELECT
    table_schema,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'User'
ORDER BY table_schema, ordinal_position;
EOF

echo ""
echo "5. 服务特定表统计..."
echo "billing相关表："
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%Token%' OR table_name LIKE '%Subscription%') ORDER BY table_name;" -t

echo ""
echo "offer相关表："
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%Offer%') ORDER BY table_name;" -t

echo ""
echo "siterank相关表："
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%domain%' OR table_name LIKE '%Siterank%') ORDER BY table_name;" -t

echo ""
echo "adscenter相关表："
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%UserAds%' OR table_name LIKE '%Bulk%' OR table_name LIKE '%Mcc%') ORDER BY table_name;" -t

echo ""
echo "========================================="
echo "检查完成"
echo "========================================="
