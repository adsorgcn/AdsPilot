-- Three Layer User Data Architecture Validation Schema
-- 迁移脚本: 添加三层用户数据架构验证所需的数据结构和索引

-- 创建三层验证中间件需要的审计表
CREATE TABLE IF NOT EXISTS three_layer_validation_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user.users(id) ON DELETE CASCADE,
    request_path VARCHAR(500) NOT NULL,
    validation_status VARCHAR(50) NOT NULL, -- 'passed', 'failed', 'critical', 'warning'
    layer1_status BOOLEAN NOT NULL DEFAULT false,
    layer2_status BOOLEAN NOT NULL DEFAULT false,
    layer3_status BOOLEAN NOT NULL DEFAULT false,
    email_consistency BOOLEAN NOT NULL DEFAULT false,
    validation_details JSONB,
    execution_time_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_three_layer_audit_user_id (user_id),
    INDEX idx_three_layer_audit_status (validation_status),
    INDEX idx_three_layer_audit_created_at (created_at)
);

-- 创建用户数据修复日志表
CREATE TABLE IF NOT EXISTS user_data_repair_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user.users(id) ON DELETE CASCADE,
    repair_type VARCHAR(50) NOT NULL, -- 'business_missing', 'billing_missing', 'email_inconsistent'
    repair_status VARCHAR(50) NOT NULL, -- 'attempted', 'success', 'failed'
    repair_details JSONB,
    auto_repair BOOLEAN NOT NULL DEFAULT false, -- 是否为自动修复
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255), -- 操作人员或系统标识
    INDEX idx_repair_log_user_id (user_id),
    INDEX idx_repair_log_type (repair_type),
    INDEX idx_repair_log_created_at (created_at)
);

-- 创建用户状态汇总表（用于性能优化）
CREATE TABLE IF NOT EXISTS user_status_summary (
    user_id UUID PRIMARY KEY REFERENCES user.users(id) ON DELETE CASCADE,
    layer1_status BOOLEAN NOT NULL DEFAULT false, -- Supabase auth.users
    layer2_status BOOLEAN NOT NULL DEFAULT false, -- user.users
    layer3_status BOOLEAN NOT NULL DEFAULT false, -- billing.accounts
    email_consistency BOOLEAN NOT NULL DEFAULT false,
    overall_status VARCHAR(50) NOT NULL, -- 'complete', 'partial', 'missing', 'inconsistent'
    last_validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_user_status_summary_status (overall_status),
    INDEX idx_user_status_summary_updated (updated_at)
);

-- 为现有用户表添加性能优化索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_users_email_status
ON user.users (email, status) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_status_created
ON user.users (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_user_status
ON billing.accounts (user_id, status);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_status
ON billing.subscriptions (user_id, status);

-- 为三层验证创建必要的视图
CREATE OR REPLACE VIEW three_layer_user_status AS
SELECT
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    CASE WHEN ua.user_id IS NOT NULL THEN true ELSE false END as layer1_exists,
    CASE WHEN ba.user_id IS NOT NULL THEN true ELSE false END as layer2_exists,
    CASE WHEN u.email IS NOT NULL AND ua.user_id IS NOT NULL AND u.email = ua.email THEN true ELSE false END as email_consistent,
    CASE
        WHEN ua.user_id IS NOT NULL AND ba.user_id IS NOT NULL THEN true
        WHEN ua.user_id IS NOT NULL AND ba.user_id IS NULL THEN false
        WHEN ua.user_id IS NULL THEN false
        ELSE false
    END as data_complete
FROM user.users u
LEFT JOIN billing.accounts ba ON u.id = ba.user_id
-- 注: 这里使用ua代替auth.users，因为我们假设Supabase认证用户在user.users中有对应记录;

-- 插入触发器函数（用于自动维护user_status_summary）
CREATE OR REPLACE FUNCTION update_user_status_summary() RETURNS TRIGGER AS $$
BEGIN
    -- 这个函数可以由应用定期调用，更新用户状态汇总表
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建配置表用于三层验证阈值
CREATE TABLE IF NOT EXISTS three_layer_validation_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认配置
INSERT INTO three_layer_validation_config (key, value, description) VALUES
('validation_thresholds', '{
    "max_validation_time_ms": 5000,
    "max_concurrent_validations": 100,
    "auto_repair_enabled": true,
    "cache_ttl_seconds": 300,
    "critical_paths": [
        "/api/v1/billing/subscriptions",
        "/api/v1/billing/tokens/consume",
        "/api/v1/billing/tokens/credit/purchased"
    ]
}', '三层验证配置参数'),
('alert_thresholds', '{
    "validation_failure_rate_threshold": 0.05,
    "critical_validation_failure_rate_threshold": 0.01,
    "time_window_minutes": 60,
    "notification_enabled": true
}', '告警阈值配置')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW(),
    description = EXCLUDED.description;

COMMENT ON TABLE three_layer_validation_audit IS '三层用户数据架构验证审计表';
COMMENT ON TABLE user_data_repair_log IS '用户数据修复操作日志表';
COMMENT ON TABLE user_status_summary IS '用户状态汇总表（缓存优化查询）';
COMMENT ON VIEW three_layer_user_status IS '用户三层架构状态视图';
COMMENT ON TABLE three_layer_validation_config IS '三层验证配置表';