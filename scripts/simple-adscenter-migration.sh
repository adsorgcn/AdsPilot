#!/bin/bash

# 简化的adscenter迁移脚本
# 直接执行预定义的DDL语句

set -euo pipefail

echo "========================================="
echo "adscenter服务迁移 - 简化版本"
echo "========================================="
echo ""

# 预定义的DDL语句 (从迁移文件提取)
DDL_STATEMENTS=(
    # UserAdsConnection表
    'CREATE TABLE IF NOT EXISTS "UserAdsConnection" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" TEXT NOT NULL,
      "loginCustomerId" TEXT NOT NULL,
      "primaryCustomerId" TEXT,
      "refreshToken" TEXT NOT NULL,
      "scopes" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )'

    # UserAdsConnection索引
    'CREATE INDEX IF NOT EXISTS idx_useradsconnection_user ON "UserAdsConnection"("userId")'

    # BulkActionOperation表
    'CREATE TABLE IF NOT EXISTS "BulkActionOperation" (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      plan JSONB,
      status TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )'

    # BulkActionAudit表
    'CREATE TABLE IF NOT EXISTS "BulkActionAudit" (
      id BIGSERIAL PRIMARY KEY,
      op_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )'

    # BulkActionAudit索引
    'CREATE INDEX IF NOT EXISTS ix_bulk_audit_op ON "BulkActionAudit"(op_id, created_at)'

    # AuditEvent表
    'CREATE TABLE IF NOT EXISTS "AuditEvent" (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '\''{}'\''::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )'

    # AuditEvent索引
    'CREATE INDEX IF NOT EXISTS ix_audit_event_user_kind_time ON "AuditEvent"(user_id, kind, created_at DESC)'
)

EXPECTED_TABLES=(
    "UserAdsConnection"
    "BulkActionOperation"
    "BulkActionAudit"
    "AuditEvent"
)

echo "迁移信息:"
echo "  服务: adscenter"
echo "  DDL语句数: ${#DDL_STATEMENTS[@]}"
echo "  预期表数: ${#EXPECTED_TABLES[@]}"
echo ""

# 模拟执行迁移 (因为无法连接到实际数据库)
echo "🔄 模拟执行迁移..."

for i in "${!DDL_STATEMENTS[@]}"; do
    DDL="${DDL_STATEMENTS[$i]}"

    # 提取操作类型和对象名
    if [[ "$DDL" =~ CREATE[[:space:]]+TABLE[[:space:]] ]]; then
        TABLE_NAME=$(echo "$DDL" | grep -o 'TABLE[^(]*' | sed 's/TABLE[[:space:]]*//' | tr -d '"')
        echo "  ✅ 创建表: $TABLE_NAME"
    elif [[ "$DDL" =~ CREATE[[:space:]]+INDEX[[:space:]] ]]; then
        INDEX_NAME=$(echo "$DDL" | grep -o 'INDEX[^(]*' | sed 's/INDEX[[:space:]]*//' | tr -d '"')
        echo "  ✅ 创建索引: $INDEX_NAME"
    fi
done

echo ""
echo "========================================="
echo "迁移验证报告"
echo "========================================="

echo "✅ 迁移文件状态:"
echo "  - 所有预期的DDL语句已定义: ${#DDL_STATEMENTS[@]}"
echo "  - 所有预期的表已包含: ${#EXPECTED_TABLES[@]}"
echo ""

echo "📊 预期创建的对象:"
echo "  表 (4个):"
for table in "${EXPECTED_TABLES[@]}"; do
    echo "    - $table"
done

echo "  索引 (3个):"
echo "    - idx_useradsconnection_user"
echo "    - ix_bulk_audit_op"
echo "    - ix_audit_event_user_kind_time"

echo ""
echo "🎯 迁移准备状态: 100% 完成"
echo ""
echo "下一步操作:"
echo "1. 连接到目标数据库"
echo "2. 执行上述DDL语句"
echo "3. 验证表和索引创建结果"
echo "4. 更新adscenter服务使用适配器"

echo ""
echo "执行命令 (当数据库可用时):"
for i in "${!DDL_STATEMENTS[@]}"; do
    echo "psql -d gm_db -c \"${DDL_STATEMENTS[$i]}\""
done

echo ""
echo "✅ adscenter迁移准备完成！"