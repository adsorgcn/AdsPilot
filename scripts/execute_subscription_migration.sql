-- 执行订阅配置相关表迁移
-- 创建subscription_permissions表
CREATE TABLE IF NOT EXISTS subscription_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature VARCHAR(255) NOT NULL UNIQUE,
    feature_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    starter_value JSONB NOT NULL,
    professional_value JSONB NOT NULL,
    elite_value JSONB NOT NULL,
    display_only BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES "User"(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_permissions_category ON subscription_permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_feature ON subscription_permissions(feature);

-- 创建subscription_token_costs表
CREATE TABLE IF NOT EXISTS subscription_token_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(255) NOT NULL UNIQUE,
    action_name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    starter_cost JSONB NOT NULL,
    professional_cost JSONB NOT NULL,
    elite_cost JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES "User"(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_token_costs_category ON subscription_token_costs(category);
CREATE INDEX IF NOT EXISTS idx_token_costs_action ON subscription_token_costs(action);

-- 创建subscription_pricing表
CREATE TABLE IF NOT EXISTS subscription_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    badge VARCHAR(100),
    recommended BOOLEAN DEFAULT FALSE,
    token_quota INTEGER NOT NULL,
    monthly_amount INTEGER NOT NULL,
    monthly_stripe_price_id VARCHAR(255) NOT NULL,
    yearly_amount INTEGER NOT NULL,
    yearly_stripe_price_id VARCHAR(255) NOT NULL,
    yearly_discount INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES "User"(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_pricing_plan ON subscription_pricing(plan);
CREATE INDEX IF NOT EXISTS idx_pricing_recommended ON subscription_pricing(recommended);

-- 创建subscription_config_history表
CREATE TABLE IF NOT EXISTS subscription_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_type VARCHAR(50) NOT NULL,
    config_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_value JSONB,
    new_value JSONB NOT NULL,
    changed_by UUID REFERENCES "User"(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_config_history_type ON subscription_config_history(config_type, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_history_config_id ON subscription_config_history(config_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_history_changed_by ON subscription_config_history(changed_by, changed_at DESC);

-- 插入初始数据（忽略冲突）
INSERT INTO subscription_permissions (feature, feature_name, category, starter_value, professional_value, elite_value) VALUES
('dashboard.overview', 'permissions.features.dashboard.overview', 'dashboard', true, true, true),
('dashboard.analytics', 'permissions.features.dashboard.analytics', 'dashboard', false, true, true),
('dashboard.export', 'permissions.features.dashboard.export', 'dashboard', false, true, true),
('offer.create', 'permissions.features.offer.create', 'offer', true, true, true),
('offer.evaluate', 'permissions.features.offer.evaluate', 'offer', 5, 50, 500),
('offer.evaluate.ai', 'permissions.features.offer.evaluate.ai', 'offer', 0, 50, 500),
('offer.batch.evaluate', 'permissions.features.offer.batch.evaluate', 'offer', 0, 10, 100),
('batchopen.create', 'permissions.features.batchopen.create', 'batchopen', 0, 10, 100),
('batchopen.schedule', 'permissions.features.batchopen.schedule', 'batchopen', false, true, true),
('adscenter.connect', 'permissions.features.adscenter.connect', 'adscenter', 1, 5, 50),
('adscenter.manage', 'permissions.features.adscenter.manage', 'adscenter', false, true, true),
('adscenter.bulk_operations', 'permissions.features.adscenter.bulk_operations', 'adscenter', false, false, true)
ON CONFLICT (feature) DO NOTHING;

INSERT INTO subscription_token_costs (action, action_name, category, starter_cost, professional_cost, elite_cost) VALUES
('offer.evaluate', 'token_costs.actions.offer.evaluate', 'offer', 1, 1, 1),
('offer.evaluate.ai', 'token_costs.actions.offer.evaluate.ai', 'offer', 'unsupported', 3, 3),
('offer.batch.evaluate', 'token_costs.actions.offer.batch.evaluate', 'offer', 'unsupported', 1, 1),
('batchopen.create', 'token_costs.actions.batchopen.create', 'batchopen', 'unsupported', 5, 5),
('batchopen.execute', 'token_costs.actions.batchopen.execute', 'batchopen', 'unsupported', 1, 1),
('adscenter.sync', 'token_costs.actions.adscenter.sync', 'adscenter', 1, 1, 1),
('adscenter.bulk_sync', 'token_costs.actions.adscenter.bulk_sync', 'adscenter', 'unsupported', 5, 5)
ON CONFLICT (action) DO NOTHING;

INSERT INTO subscription_pricing (plan, display_name, description, badge, recommended, token_quota, monthly_amount, monthly_stripe_price_id, yearly_amount, yearly_stripe_price_id, yearly_discount) VALUES
('starter', 'pricing.plans.starter.name', 'pricing.plans.starter.description', 'pricing.plans.starter.badge', false, 100, 0, 'price_starter_monthly', 0, 'price_starter_yearly', 0),
('professional', 'pricing.plans.professional.name', 'pricing.plans.professional.description', 'pricing.plans.professional.badge', true, 1000, 2980, 'price_professional_monthly', 29800, 'price_professional_yearly', 17),
('elite', 'pricing.plans.elite.name', 'pricing.plans.elite.description', 'pricing.plans.elite.badge', false, 10000, 29980, 'price_elite_monthly', 299800, 'price_elite_yearly', 17)
ON CONFLICT (plan) DO NOTHING;