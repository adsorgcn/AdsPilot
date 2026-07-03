-- ========================================
-- Google-Monetize 数据库迁移: Console Schema
-- Layer 3: 业务域层 - 管理控制台
-- 迁移ID: 001
-- 版本: v2.0 (优化版)
-- 创建时间: 2025-10-21
-- 优化时间: 2025-10-22
-- 优先级: P1修复 - 外键约束完整性
-- ========================================
--
-- 优化内容:
-- ✅ 添加缺失的外键约束 (9处)
--    - admin_audit_log.admin_user_id → user.users(id)
--    - token_rules.created_by → user.users(id)
--    - token_rules.updated_by → user.users(id)
--    - admin_recovery_codes.admin_user_id → user.users(id)
--    - admin_recovery_codes.used_by → user.users(id)
--    - admin_recovery_codes.created_by → user.users(id)
--    - export_history.created_by → user.users(id)
--    - feature_flags.created_by → user.users(id)
--    - feature_flags.updated_by → user.users(id)
--    - feature_flag_history.changed_by → user.users(id)
--    - system_metadata.updated_by → user.users(id)
-- ✅ 使用ON DELETE SET NULL保护审计追踪
-- ✅ Layer 3依赖: 需要先创建 user.users (Layer 2)
--
-- ========================================

-- 开始事务
BEGIN;

-- 创建管理控制台域Schema
CREATE SCHEMA IF NOT EXISTS console;

-- 设置Schema权限

-- ========================================
-- 1. 管理员审计日志表
-- ========================================
CREATE TABLE console.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'create', 'update', 'delete', 'view', 'export', 'import',
        'config_change', 'user_management', 'system_operation'
    )),
    target_resource_type TEXT NOT NULL,
    target_resource_id TEXT,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 2. 代币规则表
-- ========================================
CREATE TABLE console.token_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    token_type TEXT NOT NULL CHECK (token_type IN ('search', 'analysis', 'export', 'bulk_operation')),
    rule_type TEXT NOT NULL CHECK (rule_type IN ('daily_limit', 'monthly_limit', 'per_request', 'feature_gate')),
    rule_value NUMERIC NOT NULL,
    conditions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 10 CHECK (priority BETWEEN 1 AND 100),
    applies_to JSONB DEFAULT '[]'::jsonb, -- 适用用户组或用户ID列表
    created_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    updated_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 3. 管理员恢复码表
-- ========================================
CREATE TABLE console.admin_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id TEXT REFERENCES "user".users(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    purpose TEXT DEFAULT 'admin_recovery' CHECK (purpose IN ('admin_recovery', 'emergency_access', 'system_reset')),
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    used_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    created_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 数据完整性约束
    CONSTRAINT recovery_codes_code_format CHECK (code ~* '^[A-Z0-9]{8,12}$'),
    CONSTRAINT recovery_codes_expiry_future CHECK (expires_at > created_at)
);

-- ========================================
-- 4. 导出历史表
-- ========================================
CREATE TABLE console.export_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN (
        'users', 'billing', 'analytics', 'offers', 'campaigns',
        'audit_log', 'system_metrics', 'custom_report'
    )),
    format TEXT NOT NULL CHECK (format IN ('csv', 'xlsx', 'json', 'pdf')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    filters JSONB DEFAULT '{}'::jsonb,
    date_range JSONB DEFAULT '{}'::jsonb,
    record_count INTEGER DEFAULT 0,
    file_url TEXT,
    file_size_bytes BIGINT DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    error_message TEXT,
    processing_details JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,

    -- 数据完整性约束
    CONSTRAINT export_history_expires_future CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- ========================================
-- 5. 功能开关表
-- ========================================
CREATE TABLE console.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
    conditions JSONB DEFAULT '{}'::jsonb,
    target_audience JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    updated_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 功能开关历史表
CREATE TABLE console.feature_flag_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key TEXT NOT NULL,
    old_enabled BOOLEAN NOT NULL,
    new_enabled BOOLEAN NOT NULL,
    old_rollout_percentage INTEGER NOT NULL,
    new_rollout_percentage INTEGER NOT NULL,
    changed_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    FOREIGN KEY (flag_key) REFERENCES console.feature_flags(key) ON DELETE CASCADE
);

-- ========================================
-- 6. 系统元数据表
-- ========================================
CREATE TABLE console.system_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'object', 'array')),
    category TEXT DEFAULT 'general' CHECK (category IN (
        'system', 'configuration', 'analytics', 'maintenance', 'security', 'feature'
    )),
    is_encrypted BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    description TEXT,
    updated_by TEXT REFERENCES "user".users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_accessed TIMESTAMPTZ
);

-- ========================================
-- 创建索引
-- ========================================

-- 管理员审计日志索引
CREATE INDEX idx_console_audit_log_admin ON console.admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX idx_console_audit_log_action ON console.admin_audit_log(action_type, created_at DESC);
CREATE INDEX idx_console_audit_log_resource ON console.admin_audit_log(target_resource_type, target_resource_id);
CREATE INDEX idx_console_audit_log_session ON console.admin_audit_log(session_id);
CREATE INDEX idx_console_audit_log_success ON console.admin_audit_log(success, created_at DESC);

-- 代币规则索引
CREATE INDEX idx_console_token_rules_type ON console.token_rules(token_type, rule_type);
CREATE INDEX idx_console_token_rules_active ON console.token_rules(is_active, priority);
CREATE INDEX idx_console_token_rules_priority ON console.token_rules(priority DESC);

-- 管理员恢复码索引
CREATE INDEX idx_console_recovery_codes_admin ON console.admin_recovery_codes(admin_user_id, created_at DESC);
CREATE INDEX idx_console_recovery_codes_code ON console.admin_recovery_codes(code);
CREATE INDEX idx_console_recovery_codes_expires ON console.admin_recovery_codes(expires_at) WHERE is_used = false;
CREATE INDEX idx_console_recovery_codes_unused ON console.admin_recovery_codes(is_used, expires_at);

-- 导出历史索引
CREATE INDEX idx_console_export_history_created_by ON console.export_history(created_by, created_at DESC);
CREATE INDEX idx_console_export_history_type ON console.export_history(type, status);
CREATE INDEX idx_console_export_history_status ON console.export_history(status, created_at DESC);
CREATE INDEX idx_console_export_history_expires ON console.export_history(expires_at) WHERE expires_at IS NOT NULL;

-- 功能开关索引
CREATE INDEX idx_console_feature_flags_key ON console.feature_flags(key);
CREATE INDEX idx_console_feature_flags_enabled ON console.feature_flags(enabled, rollout_percentage);
CREATE INDEX idx_console_feature_flags_category ON console.feature_flags(key, updated_at DESC);

-- 功能开关历史索引
CREATE INDEX idx_console_feature_flag_history_key ON console.feature_flag_history(flag_key, created_at DESC);
CREATE INDEX idx_console_feature_flag_history_changed_by ON console.feature_flag_history(changed_by, created_at DESC);

-- 系统元数据索引
CREATE INDEX idx_console_system_metadata_key ON console.system_metadata(key);
CREATE INDEX idx_console_system_metadata_category ON console.system_metadata(category, updated_at DESC);
CREATE INDEX idx_console_system_metadata_public ON console.system_metadata(is_public, updated_at DESC);
CREATE INDEX idx_console_system_metadata_accessed ON console.system_metadata(last_accessed DESC);

-- ========================================
-- 创建触发器和函数
-- ========================================

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION console.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要更新时间戳的表创建触发器
CREATE TRIGGER update_token_rules_updated_at
    BEFORE UPDATE ON console.token_rules
    FOR EACH ROW
    EXECUTE FUNCTION console.update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON console.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION console.update_updated_at_column();

CREATE TRIGGER update_system_metadata_updated_at
    BEFORE UPDATE ON console.system_metadata
    FOR EACH ROW
    EXECUTE FUNCTION console.update_updated_at_column();

-- 功能开关变更历史触发器
CREATE OR REPLACE FUNCTION console.log_feature_flag_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 记录功能开关变更历史
    INSERT INTO console.feature_flag_history (
        flag_key, old_enabled, new_enabled, old_rollout_percentage,
        new_rollout_percentage, changed_by, reason
    ) VALUES (
        NEW.key, OLD.enabled, NEW.enabled, OLD.rollout_percentage,
        NEW.rollout_percentage, NEW.updated_by,
        COALESCE(jsonb_extract_path_text(NEW.metadata, 'change_reason'), 'No reason provided')
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_feature_flag_change_trigger
    AFTER UPDATE ON console.feature_flags
    FOR EACH ROW
    WHEN (OLD.enabled IS DISTINCT FROM NEW.enabled OR OLD.rollout_percentage IS DISTINCT FROM NEW.rollout_percentage)
    EXECUTE FUNCTION console.log_feature_flag_change();

-- 系统元数据访问时间更新触发器
CREATE OR REPLACE FUNCTION console.update_metadata_access_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_metadata_access_time_trigger
    BEFORE UPDATE ON console.system_metadata
    FOR EACH ROW
    EXECUTE FUNCTION console.update_metadata_access_time();

-- ========================================
-- 创建视图
-- ========================================

-- 管理员活动概览视图
CREATE OR REPLACE VIEW console.admin_activity_overview AS
SELECT
    al.admin_user_id,
    COUNT(*) as total_actions,
    COUNT(CASE WHEN al.action_type = 'config_change' THEN 1 END) as config_changes,
    COUNT(CASE WHEN al.action_type = 'user_management' THEN 1 END) as user_management_actions,
    COUNT(CASE WHEN al.action_type = 'export' THEN 1 END) as export_actions,
    COUNT(CASE WHEN al.success = false THEN 1 END) as failed_actions,
    MAX(al.created_at) as last_activity,
    COUNT(DISTINCT DATE(al.created_at)) as active_days
FROM console.admin_audit_log al
WHERE al.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY al.admin_user_id
ORDER BY total_actions DESC;

-- 功能开关状态汇总视图
CREATE OR REPLACE VIEW console.feature_flag_summary AS
SELECT
    COUNT(*) as total_flags,
    COUNT(CASE WHEN enabled = true THEN 1 END) as enabled_flags,
    COUNT(CASE WHEN rollout_percentage > 0 THEN 1 END) as partially_rolled_out,
    COUNT(CASE WHEN rollout_percentage = 100 THEN 1 END) as fully_rolled_out,
    AVG(rollout_percentage) as avg_rollout_percentage,
    COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recently_updated
FROM console.feature_flags;

-- 导出活动统计视图
CREATE OR REPLACE VIEW console.export_activity_stats AS
SELECT
    DATE_TRUNC('day', created_at) as export_date,
    type,
    status,
    COUNT(*) as total_exports,
    AVG(record_count) as avg_record_count,
    SUM(record_count) as total_records,
    AVG(CASE WHEN completed_at IS NOT NULL THEN
        EXTRACT(EPOCH FROM (completed_at - created_at)) / 60
    END) as avg_duration_minutes
FROM console.export_history
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), type, status
ORDER BY export_date DESC, type, status;

-- 系统配置概览视图
CREATE OR REPLACE VIEW console.system_config_overview AS
SELECT
    category,
    COUNT(*) as total_configs,
    COUNT(CASE WHEN is_public = true THEN 1 END) as public_configs,
    COUNT(CASE WHEN is_encrypted = true THEN 1 END) as encrypted_configs,
    COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recently_updated
FROM console.system_metadata
GROUP BY category
ORDER BY category;

-- ========================================
-- 初始化数据
-- ========================================

-- 插入默认功能开关
INSERT INTO console.feature_flags (key, name, description, enabled, rollout_percentage, created_by) VALUES
('admin_dashboard_v2', '管理员控制台 v2.0', '新的管理员控制台界面', false, 0, NULL),
('advanced_analytics', '高级分析功能', '包含用户行为分析和业务洞察', false, 0, NULL),
('bulk_user_operations', '批量用户操作', '支持批量导入、导出、修改用户', false, 0, NULL),
('real_time_notifications', '实时通知系统', '系统事件的实时推送通知', true, 50, NULL),
('api_rate_limiting', 'API速率限制', '控制API调用频率防止滥用', true, 100, NULL),
('data_retention_policy', '数据保留策略', '自动清理过期的用户数据', false, 0, NULL)
ON CONFLICT (key) DO NOTHING;

-- 插入默认系统元数据
INSERT INTO console.system_metadata (key, value, category, description, is_public, updated_by) VALUES
('system_version', '"2.0.0"', 'system', 'Google-Monetize系统版本', true, NULL),
('maintenance_mode', 'false', 'system', '系统维护模式状态', true, NULL),
('default_timezone', '"UTC"', 'configuration', '系统默认时区', true, NULL),
('max_export_records', '1000000', 'configuration', '单次导出最大记录数', false, NULL),
('audit_log_retention_days', '365', 'configuration', '审计日志保留天数', false, NULL),
('system_admin_email', '"admin@gm.com"', 'configuration', '系统管理员邮箱', false, NULL)
ON CONFLICT (key) DO NOTHING;

-- 插入默认代币规则
INSERT INTO console.token_rules (name, description, token_type, rule_type, rule_value, priority, created_by) VALUES
('免费用户每日搜索限制', '免费用户每天最多搜索次数', 'search', 'daily_limit', 100, 100, NULL),
('付费用户每日搜索限制', '付费用户每天最多搜索次数', 'search', 'daily_limit', 10000, 90, NULL),
('分析代币单次消耗', '每次分析消耗的代币数量', 'analysis', 'per_request', 1, 80, NULL),
('导出功能每日限制', '所有用户每天导出次数限制', 'export', 'daily_limit', 10, 70, NULL),
('批量操作代币消耗', '批量操作的基础代币消耗', 'bulk_operation', 'per_request', 5, 60, NULL)
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- 提交事务
-- ========================================

COMMIT;

-- ========================================
-- 验证脚本执行结果
-- ========================================

-- 验证Schema创建
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'console') THEN
        RAISE NOTICE '✅ console schema created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create console schema';
    END IF;
END $$;

-- 验证表创建
DO $$
BEGIN
    DECLARE table_count INTEGER;
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'console'
    AND table_type = 'BASE TABLE';

    IF table_count = 6 THEN
        RAISE NOTICE '✅ All console tables created successfully (6 tables)';
    ELSE
        RAISE EXCEPTION '❌ Expected 6 tables, found % tables', table_count;
    END IF;
END $$;

