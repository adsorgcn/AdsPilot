-- Migration: Create token_consumption_rules table
-- Date: 2025-10-09
-- Description: Token消耗规则表 - 管理各服务操作的Token消耗标准
-- Ref: ADMIN_SYSTEM_IMPLEMENTATION_PLAN.md - Phase 1

-- Create console schema if not exists
CREATE SCHEMA IF NOT EXISTS console;

CREATE TABLE IF NOT EXISTS console.token_consumption_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    cost_per_unit INTEGER NOT NULL CHECK (cost_per_unit > 0),
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(service_name, action_type)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_token_rules_service ON console.token_consumption_rules(service_name) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_token_rules_enabled ON console.token_consumption_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_token_rules_updated ON console.token_consumption_rules(updated_at DESC);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION console.update_token_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_token_rules_updated_at
BEFORE UPDATE ON console.token_consumption_rules
FOR EACH ROW
EXECUTE FUNCTION console.update_token_rules_updated_at();

-- 初始数据：当前业务规则
INSERT INTO console.token_consumption_rules (service_name, action_type, cost_per_unit, description) VALUES
('siterank', 'basic_evaluation', 1, 'Offer基础评估 - SimilarWeb数据分析'),
('siterank', 'ai_evaluation', 3, 'Offer AI评估 - SimilarWeb + Vertex AI综合分析'),
('adscenter', 'ad_query', 1, '查询单条Google Ads广告数据'),
('adscenter', 'bulk_sync', 10, '批量同步Google Ads广告数据'),
('batchopen', 'batch_open_url', 1, '批量打开单个URL并提取数据'),
('offer', 'offer_query', 2, '查询Offer详情及性能数据')
ON CONFLICT (service_name, action_type) DO NOTHING;

-- 表和字段注释
COMMENT ON TABLE console.token_consumption_rules IS 'Token消耗规则表 - 管理各服务操作的Token消耗标准';
COMMENT ON COLUMN console.token_consumption_rules.service_name IS '服务名称 (siterank, adscenter, batchopen, offer)';
COMMENT ON COLUMN console.token_consumption_rules.action_type IS '操作类型标识符';
COMMENT ON COLUMN console.token_consumption_rules.cost_per_unit IS '每次操作消耗的Token数量';
COMMENT ON COLUMN console.token_consumption_rules.enabled IS '规则是否启用（软删除标记）';