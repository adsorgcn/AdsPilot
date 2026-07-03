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
echo "DATABASE_URL前缀: $(echo "$DATABASE_URL" | cut -d':' -f1)"
echo ""

# 执行索引创建
echo "正在创建索引..."

# 注意：使用单引号包裹DATABASE_URL，避免shell展开特殊字符
# psql会正确处理URL编码的密码
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
-- Offer表索引
CREATE INDEX IF NOT EXISTS idx_offer_user_status ON \"Offer\"(\"userId\", \"status\");
CREATE INDEX IF NOT EXISTS idx_offer_user_created ON \"Offer\"(\"userId\", \"createdAt\" DESC);
CREATE INDEX IF NOT EXISTS idx_offer_status_created ON \"Offer\"(\"status\", \"createdAt\" DESC);

-- TokenTransaction表索引
CREATE INDEX IF NOT EXISTS idx_token_tx_user_type ON \"TokenTransaction\"(\"userId\", \"type\");
CREATE INDEX IF NOT EXISTS idx_token_tx_type_created ON \"TokenTransaction\"(\"type\", \"createdAt\" DESC);
CREATE INDEX IF NOT EXISTS idx_token_tx_source ON \"TokenTransaction\"(\"source\");
CREATE INDEX IF NOT EXISTS idx_token_tx_status ON \"TokenTransaction\"(\"status\") WHERE \"status\" = 'pending';

-- Subscription表索引
CREATE INDEX IF NOT EXISTS idx_subscription_status ON \"Subscription\"(\"status\");
CREATE INDEX IF NOT EXISTS idx_subscription_period_end ON \"Subscription\"(\"currentPeriodEnd\") WHERE \"status\" = 'active';

-- UserAdsConnection表索引
CREATE INDEX IF NOT EXISTS idx_userads_login_customer ON \"UserAdsConnection\"(\"loginCustomerId\");

-- BulkAudit表索引
CREATE INDEX IF NOT EXISTS idx_bulk_audit_user_created ON \"BulkAudit\"(\"userId\", \"createdAt\" DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_audit_status ON \"BulkAudit\"(\"status\");

-- Event表索引
CREATE INDEX IF NOT EXISTS idx_event_created ON \"Event\"(\"createdAt\" DESC);

-- AuditEvents表索引
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON \"AuditEvents\"(\"entityType\", \"entityId\");
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON \"AuditEvents\"(\"createdAt\" DESC);
"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ 索引创建成功！"
  echo ""

  # 更新统计信息
  echo "更新表统计信息..."
  psql "$DATABASE_URL" -c "
ANALYZE \"Offer\";
ANALYZE \"TokenTransaction\";
ANALYZE \"Subscription\";
ANALYZE \"UserAdsConnection\";
ANALYZE \"BulkAudit\";
ANALYZE \"Event\";
ANALYZE \"AuditEvents\";
"

  echo ""
  echo "✅ 统计信息已更新"
  echo ""

  # 验证索引
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
else
  echo ""
  echo "❌ 索引创建失败"
  exit 1
fi
