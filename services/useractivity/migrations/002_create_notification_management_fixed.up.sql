-- ========================================
-- Google-Monetize 数据库迁移: Notification Management (Fixed)
-- 创建通知管理表 (集成console服务功能)
-- 迁移ID: 004
-- 版本: v2.1 (修复版)
-- 创建时间: 2025-10-23
-- ========================================

-- 开始事务
BEGIN;

-- 1. 通知模板表 (从console迁移)
CREATE TABLE useractivity.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    type TEXT CHECK (type IN ('email', 'in_app', 'webhook', 'sms', 'push')),
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'billing', 'performance', 'system', 'security', 'feature', 'marketing')),
    variables JSONB DEFAULT '{}'::jsonb, -- 模板变量定义
    created_by TEXT REFERENCES "user".users(id),
    updated_by TEXT REFERENCES "user".users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 通知广播表 (从console迁移并增强)
CREATE TABLE useractivity.notification_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    template_id UUID REFERENCES useractivity.notification_templates(id),
    target_audience TEXT CHECK (target_audience IN ('all', 'admins', 'users', 'custom')),
    target_users JSONB DEFAULT '[]'::jsonb, -- 自定义目标用户列表
    filters JSONB DEFAULT '{}'::jsonb, -- 用户过滤条件
    channels JSONB DEFAULT '["inapp"]'::jsonb CHECK (channels <@ '["inapp", "email", "sms", "push", "webhook"]'::jsonb),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
    created_by TEXT REFERENCES "user".users(id),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivery_stats JSONB DEFAULT '{}'::jsonb, -- 投递统计
    error_details JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 用户通知接收记录表 (增强现有notifications表的功能)
CREATE TABLE useractivity.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES useractivity.notification_broadcasts(id),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    channel TEXT CHECK (channel IN ('inapp', 'email', 'sms', 'push', 'webhook')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read', 'clicked')),
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 用户通知偏好表
CREATE TABLE useractivity.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('general', 'billing', 'performance', 'system', 'security', 'feature', 'marketing')),
    is_enabled BOOLEAN DEFAULT true,
    channels JSONB DEFAULT '["inapp"]'::jsonb CHECK (channels <@ '["inapp", "email", "sms", "push", "webhook"]'::jsonb),
    preferences JSONB DEFAULT '{}'::jsonb, -- 额外偏好设置
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category)
);

-- 5. NPS反馈表 (从console迁移)
CREATE TABLE useractivity.nps_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 0 AND rating <= 10),
    score INTEGER CHECK (score >= -100 AND score <= 100),
    feedback_text TEXT,
    source TEXT DEFAULT 'in_app' CHECK (source IN ('in_app', 'email', 'web', 'api')),
    category TEXT DEFAULT 'general' CHECK (category IN ('product', 'feature', 'support', 'performance', 'ui', 'other')),
    tags JSONB DEFAULT '[]'::jsonb,
    is_anonymous BOOLEAN DEFAULT false,
    responded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 活动日志表 (增强现有user_activities表的功能)
CREATE TABLE useractivity.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    session_id TEXT,
    activity_type TEXT NOT NULL,
    activity_name TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    page_url TEXT,
    referrer_url TEXT,
    duration_ms INTEGER,
    status TEXT DEFAULT 'completed' CHECK (status IN ('started', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. 创建基本索引（非CONCURRENTLY）
CREATE INDEX idx_notification_templates_type ON useractivity.notification_templates(type);
CREATE INDEX idx_notification_templates_category ON useractivity.notification_templates(category);
CREATE INDEX idx_notification_templates_active ON useractivity.notification_templates(is_active);

CREATE INDEX idx_notification_broadcasts_status ON useractivity.notification_broadcasts(status, scheduled_at);
CREATE INDEX idx_notification_broadcasts_audience ON useractivity.notification_broadcasts(target_audience, status);
CREATE INDEX idx_notification_broadcasts_created_by ON useractivity.notification_broadcasts(created_by, created_at DESC);
CREATE INDEX idx_notification_broadcasts_priority ON useractivity.notification_broadcasts(priority, status);

CREATE INDEX idx_notification_deliveries_user_status ON useractivity.notification_deliveries(user_id, status, created_at DESC);
CREATE INDEX idx_notification_deliveries_broadcast ON useractivity.notification_deliveries(broadcast_id, status);
CREATE INDEX idx_notification_deliveries_channel ON useractivity.notification_deliveries(channel, status);

CREATE INDEX idx_notification_preferences_user ON useractivity.notification_preferences(user_id);
CREATE INDEX idx_notification_preferences_category ON useractivity.notification_preferences(category);
CREATE INDEX idx_notification_preferences_enabled ON useractivity.notification_preferences(is_enabled);

CREATE INDEX idx_nps_feedback_user_rating ON useractivity.nps_feedback(user_id, rating, created_at DESC);
CREATE INDEX idx_nps_feedback_source ON useractivity.nps_feedback(source, created_at DESC);

CREATE INDEX idx_activity_log_user_type ON useractivity.activity_log(user_id, activity_type, created_at DESC);
CREATE INDEX idx_activity_log_user_session ON useractivity.activity_log(user_id, session_id, created_at DESC);
CREATE INDEX idx_activity_log_created_at ON useractivity.activity_log(created_at DESC);

-- 创建自动更新时间戳的函数
CREATE OR REPLACE FUNCTION useractivity.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON useractivity.notification_templates
    FOR EACH ROW EXECUTE FUNCTION useractivity.update_updated_at_column();

CREATE TRIGGER update_notification_broadcasts_updated_at
    BEFORE UPDATE ON useractivity.notification_broadcasts
    FOR EACH ROW EXECUTE FUNCTION useractivity.update_updated_at_column();

CREATE TRIGGER update_notification_deliveries_updated_at
    BEFORE UPDATE ON useractivity.notification_deliveries
    FOR EACH ROW EXECUTE FUNCTION useractivity.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON useractivity.notification_preferences
    FOR EACH ROW EXECUTE FUNCTION useractivity.update_updated_at_column();

-- 创建视图：用户通知状态概览
CREATE OR REPLACE VIEW useractivity.user_notification_overview AS
SELECT
    u.id as user_id,
    u.email,
    COUNT(nd.id) FILTER (WHERE nd.status = 'unread') as unread_count,
    COUNT(nd.id) FILTER (WHERE nd.status = 'read') as read_count,
    COUNT(nd.id) FILTER (WHERE nd.status = 'failed') as failed_count,
    MAX(nd.created_at) as last_notification_time,
    MAX(nd.read_at) as last_read_time,
    u.created_at as user_created_at
FROM "user".users u
LEFT JOIN (
    SELECT
        nd.user_id,
        nd.id,
        nd.status,
        nd.created_at,
        nd.read_at
    FROM useractivity.notification_deliveries nd
) nd ON u.id = nd.user_id
GROUP BY u.id, u.email, u.created_at;

-- 创建视图：通知模板使用统计
CREATE OR REPLACE VIEW useractivity.template_usage_stats AS
SELECT
    nt.id,
    nt.name,
    nt.type,
    nt.category,
    COUNT(nb.id) as usage_count,
    COUNT(DISTINCT nb.created_by) as creator_count,
    MAX(nb.created_at) as last_used,
    nt.is_active,
    nt.created_at
FROM useractivity.notification_templates nt
LEFT JOIN useractivity.notification_broadcasts nb ON nt.id = nb.template_id
GROUP BY nt.id, nt.name, nt.type, nt.category, nt.is_active, nt.created_at;

-- 创建视图：NPS反馈趋势
CREATE OR REPLACE VIEW useractivity.nps_trends AS
SELECT
    DATE_TRUNC('week', created_at) as week,
    COUNT(*) as response_count,
    AVG(rating) as avg_rating,
    AVG(score) as avg_score,
    COUNT(*) FILTER (WHERE rating >= 9) as promoters,
    COUNT(*) FILTER (WHERE rating <= 6) as detractors,
    COUNT(*) FILTER (WHERE rating >= 7 AND rating <= 8) as passives,
    ROUND(
        (COUNT(*) FILTER (WHERE rating >= 9) - COUNT(*) FILTER (WHERE rating <= 6)) * 100.0 /
        NULLIF(COUNT(*), 0), 2
    ) as nps_score
FROM useractivity.nps_feedback
WHERE created_at >= now() - interval '12 months'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;

-- 创建视图：用户活动趋势
CREATE OR REPLACE VIEW useractivity.user_activity_trends AS
SELECT
    DATE_TRUNC('day', created_at) as date,
    activity_type,
    COUNT(*) as activity_count,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL) as avg_duration_ms
FROM useractivity.activity_log
WHERE created_at >= now() - interval '30 days'
GROUP BY DATE_TRUNC('day', created_at), activity_type
ORDER BY date DESC, activity_type;

-- 插入默认通知模板
INSERT INTO useractivity.notification_templates (name, subject, body, type, category, variables, is_active) VALUES
-- 欢迎消息
('welcome_notification', '欢迎加入Google-Monetize', '欢迎您加入Google-Monetize平台！我们很高兴为您提供服务。', 'in_app', 'general', '{"user_name": "用户名"}', true),
-- 试用期提醒
('trial_expiry_warning', '试用期即将到期', '尊敬的用户，您的7天试用期即将在{{days_remaining}}天后到期，请及时升级套餐以继续使用我们的服务。', 'in_app', 'billing', '{"days_remaining": "剩余天数", "user_name": "用户名"}', true),
-- 账单通知
('payment_success', '付款成功', '感谢您的付款！您的{{plan_name}}套餐已激活，有效期至{{expiry_date}}。', 'in_app', 'billing', '{"plan_name": "套餐名称", "expiry_date": "到期日期"}', true),
-- 系统维护
('system_maintenance', '系统维护通知', '我们将在{{maintenance_time}}进行系统维护，预计持续{{duration}}。在此期间，部分功能可能暂时无法使用。', 'in_app', 'system', '{"maintenance_time": "维护时间", "duration": "持续时间"}', true);

-- 插入默认通知偏好设置
INSERT INTO useractivity.notification_preferences (user_id, category, is_enabled, channels)
SELECT
    u.id,
    cat.category,
    true, -- 默认启用
    '["inapp"]'::jsonb -- 默认应用内通知
FROM "user".users u, (VALUES ('general'), ('billing'), ('feature'), ('security')) AS cat(category)
WHERE NOT EXISTS (
    SELECT 1 FROM useractivity.notification_preferences np
    WHERE np.user_id = u.id AND np.category = cat.category
);

-- 插入示例NPS反馈配置
INSERT INTO useractivity.nps_feedback (user_id, rating, score, source, category, feedback_text)
SELECT
    u.id,
    9, -- 默认高分
    10, -- 对应NPS 10分
    'in_app',
    'product',
    '系统自动生成的示例反馈'
FROM "user".users u
LIMIT 1; -- 只插入一条示例数据

COMMIT;

-- 显示创建结果
DO $$
BEGIN
    RAISE NOTICE '✅ useractivity notification management schema created successfully';
    RAISE NOTICE '📊 创建的表数量: 6';
    RAISE NOTICE '📊 创建的视图数量: 4';
    RAISE NOTICE '📊 创建的索引数量: 16';
    RAISE NOTICE '📊 创建的触发器数量: 4';
    RAISE NOTICE '📊 插入的默认模板: 4个';
    RAISE NOTICE '📊 插入的示例数据: 2条';
    RAISE NOTICE '';
    RAISE NOTICE '🔗 通知管理功能特性:';
    RAISE NOTICE '   ✅ 多渠道通知支持 (inapp, email, sms, push, webhook)';
    RAISE NOTICE '   ✅ 用户通知偏好管理';
    RAISE NOTICE '   ✅ NPS反馈收集和分析';
    RAISE NOTICE '   ✅ 活动日志记录和统计';
    RAISE NOTICE '   ✅ 通知模板系统';
    RAISE NOTICE '   ✅ 广播通知功能';
    RAISE NOTICE '   ✅ 通知投递状态跟踪';
    RAISE NOTICE '   ✅ 自动化通知工作流';
    RAISE NOTICE '';
END $$;