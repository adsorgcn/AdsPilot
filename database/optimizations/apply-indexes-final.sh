#!/bin/sh
set -e

echo "========================================="
echo "  应用性能索引到Cloud SQL"
echo "  日期: $(date)"
echo "========================================="

# 检查DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ 错误: DATABASE_URL环境变量未设置"
  exit 1
fi

echo "✅ DATABASE_URL已设置"
echo ""

# psql可以直接使用DATABASE_URL环境变量，无需解析
# 设置PGCONNSTR_mydb后，可以用service名称连接
export PGCONNECT_TIMEOUT=10

# 直接使用URI连接（psql v14+自动处理URL编码）
echo "正在创建索引..."

# 分步执行每个索引，便于调试
psql "$DATABASE_URL" -v ON_ERROR_STOP=0 <<'EOSQL'
\set VERBOSITY verbose
\timing on

-- Offer表索引
CREATE INDEX IF NOT EXISTS idx_offer_user_status ON "Offer"("userId", "status");
CREATE INDEX IF NOT EXISTS idx_offer_user_created ON "Offer"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_offer_status_created ON "Offer"("status", "createdAt" DESC);

-- TokenTransaction表索引
CREATE INDEX IF NOT EXISTS idx_token_tx_user_type ON "TokenTransaction"("userId", "type");
CREATE INDEX IF NOT EXISTS idx_token_tx_type_created ON "TokenTransaction"("type", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_token_tx_source ON "TokenTransaction"("source");
CREATE INDEX IF NOT EXISTS idx_token_tx_status ON "TokenTransaction"("status") WHERE "status" = 'pending';

-- Subscription表索引
CREATE INDEX IF NOT EXISTS idx_subscription_status ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS idx_subscription_period_end ON "Subscription"("currentPeriodEnd") WHERE "status" = 'active';

-- UserAdsConnection表索引
CREATE INDEX IF NOT EXISTS idx_userads_login_customer ON "UserAdsConnection"("loginCustomerId");

-- BulkAudit表索引
CREATE INDEX IF NOT EXISTS idx_bulk_audit_user_created ON "BulkAudit"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_audit_status ON "BulkAudit"("status");

-- Event表索引
CREATE INDEX IF NOT EXISTS idx_event_created ON "Event"("createdAt" DESC);

-- AuditEvents表索引
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON "AuditEvents"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON "AuditEvents"("createdAt" DESC);

\echo ''
\echo '✅ 索引创建完成'
EOSQL

INDEX_RESULT=$?

if [ $INDEX_RESULT -eq 0 ]; then
  echo ""
  echo "✅ 索引创建成功！"
else
  echo ""
  echo "⚠️  索引创建可能有部分失败，继续执行统计更新..."
fi

# 更新统计信息
echo ""
echo "更新表统计信息..."
psql "$DATABASE_URL" <<'EOSQL'
ANALYZE "Offer";
ANALYZE "TokenTransaction";
ANALYZE "Subscription";
ANALYZE "UserAdsConnection";
ANALYZE "BulkAudit";
ANALYZE "Event";
ANALYZE "AuditEvents";

\echo '✅ 统计信息已更新'
EOSQL

# 验证索引
echo ""
echo "验证已创建的索引:"
psql "$DATABASE_URL" -c "
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
"

echo ""
echo "========================================="
echo "  ✅ 迁移完成！"
echo "========================================="

exit 0
