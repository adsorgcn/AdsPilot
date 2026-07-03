-- ============================================
-- 多用户 SaaS 性能优化索引
-- 创建日期: 2025-10-09
-- 用户隔离: 所有查询都基于 user_id
-- ============================================

-- offers 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_offers_user_status
  ON offers(user_id, status);

CREATE INDEX IF NOT EXISTS idx_offers_user_created
  ON offers(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_offers_status_created
  ON offers(status, created_at DESC);

-- offer_evaluations 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_offer_eval_user_status
  ON offer_evaluations(user_id, status);

CREATE INDEX IF NOT EXISTS idx_offer_eval_created
  ON offer_evaluations(created_at DESC);

-- url_visit_results 表索引（用户级隔离）
CREATE INDEX IF NOT EXISTS idx_url_visit_user_result
  ON url_visit_results(user_id, result_type);

CREATE INDEX IF NOT EXISTS idx_url_visit_domain_created
  ON url_visit_results(domain, created_at DESC);

-- 更新统计信息
ANALYZE offers;
ANALYZE offer_evaluations;
ANALYZE url_visit_results;
