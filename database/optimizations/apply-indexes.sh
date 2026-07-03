#!/bin/bash
set -euo pipefail

# 应用性能索引的脚本
# 用于在Cloud Run Job中执行

echo "开始应用性能索引..."

# 获取数据库连接信息
DATABASE_URL="${DATABASE_URL:-}"
if [ -z "$DATABASE_URL" ]; then
  echo "错误: DATABASE_URL环境变量未设置"
  exit 1
fi

# 执行SQL文件
psql "$DATABASE_URL" << 'EOF'
-- ============================================
-- 多用户 SaaS 性能优化索引
-- 创建日期: 2025-10-09
-- 用户隔离: 所有查询都基于 userId
-- ============================================

-- Offer 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_offer_user_status
  ON "Offer"("userId", "status");

CREATE INDEX IF NOT EXISTS idx_offer_user_created
  ON "Offer"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_offer_status_created
  ON "Offer"("status", "createdAt" DESC);

-- TokenTransaction 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_token_tx_user_type
  ON "TokenTransaction"("userId", "type");

CREATE INDEX IF NOT EXISTS idx_token_tx_type_created
  ON "TokenTransaction"("type", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_token_tx_source
  ON "TokenTransaction"("source");

CREATE INDEX IF NOT EXISTS idx_token_tx_status
  ON "TokenTransaction"("status")
  WHERE "status" = 'pending';

-- Subscription 表索引（用户级，一对一关系）
CREATE INDEX IF NOT EXISTS idx_subscription_status
  ON "Subscription"("status");

CREATE INDEX IF NOT EXISTS idx_subscription_period_end
  ON "Subscription"("currentPeriodEnd")
  WHERE "status" = 'active';

-- UserAdsConnection 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_userads_login_customer
  ON "UserAdsConnection"("loginCustomerId");

-- BulkAudit 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_bulk_audit_user_created
  ON "BulkAudit"("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_bulk_audit_status
  ON "BulkAudit"("status");

-- Event 表索引（事件溯源）
CREATE INDEX IF NOT EXISTS idx_event_created
  ON "Event"("createdAt" DESC);

-- AuditEvents 索引
CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON "AuditEvents"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS idx_audit_events_created
  ON "AuditEvents"("createdAt" DESC);

-- 更新统计信息
ANALYZE "Offer";
ANALYZE "TokenTransaction";
ANALYZE "Subscription";
ANALYZE "UserAdsConnection";
ANALYZE "BulkAudit";
ANALYZE "Event";
ANALYZE "AuditEvents";
EOF

echo "✅ 性能索引已成功应用"

# 验证索引创建
echo ""
echo "验证已创建的索引:"
psql "$DATABASE_URL" -c "
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
"
