-- ========================================
-- Google-Monetize 数据库迁移: Notification Management
-- 创建通知管理表 (集成console服务功能)
-- 迁移ID: 004
-- 版本: v2.0
-- 创建时间: 2025-10-21
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
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    broadcast_id UUID REFERENCES useractivity.notification_broadcasts(id),
    template_id UUID REFERENCES useractivity.notification_templates(id),
    channel TEXT NOT NULL CHECK (channel IN ('inapp', 'email', 'sms', 'push', 'webhook')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'bounced')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
    max_retries INTEGER DEFAULT 3 CHECK (max_retries >= 0),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- 唯一约束 (同一用户同一广播同一渠道只能有一条记录)
    UNIQUE(user_id, broadcast_id, channel)
);

-- 4. 通知偏好设置表
CREATE TABLE useractivity.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('general', 'billing', 'performance', 'system', 'security', 'feature', 'marketing')),
    channels_enabled JSONB DEFAULT '["inapp"]'::jsonb CHECK (channels_enabled <@ '["inapp", "email", "sms", "push", "webhook"]'::jsonb),
    frequency_limit TEXT DEFAULT 'unlimited' CHECK (frequency_limit IN ('unlimited', 'daily', 'weekly', 'monthly', 'never')),
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- 唯一约束
    UNIQUE(user_id, category)
);

-- 5. NPS反馈表 (从console迁移)
CREATE TABLE useractivity.nps_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
    feedback TEXT,
    feedback_category TEXT CHECK (feedback_category IN ('product', 'feature', 'support', 'pricing', 'ui_ux', 'performance', 'other')),
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    promoter_type TEXT GENERATED ALWAYS AS (
        CASE
            WHEN score >= 9 THEN 'promoter'
            WHEN score >= 7 THEN 'passive'
            ELSE 'detractor'
        END
    ) STORED,
    response_context JSONB DEFAULT '{}'::jsonb, -- 回答时的上下文信息
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_status TEXT CHECK (follow_up_status IN ('pending', 'contacted', 'resolved', 'closed')),
    created_by TEXT REFERENCES "user".users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- 创建索引
-- ========================================

-- 通知模板表索引
CREATE INDEX CONCURRENTLY idx_activity_notification_templates_type ON useractivity.notification_templates(type);
CREATE INDEX CONCURRENTLY idx_activity_notification_templates_category ON useractivity.notification_templates(category);
CREATE INDEX CONCURRENTLY idx_activity_notification_templates_active ON useractivity.notification_templates(is_active);

-- 通知广播表索引
CREATE INDEX CONCURRENTLY idx_activity_notification_broadcasts_status ON useractivity.notification_broadcasts(status, scheduled_at);
CREATE INDEX CONCURRENTLY idx_activity_notification_broadcasts_audience ON useractivity.notification_broadcasts(target_audience, status);
CREATE INDEX CONCURRENTLY idx_activity_notification_broadcasts_created_by ON useractivity.notification_broadcasts(created_by, created_at DESC);
CREATE INDEX CONCURRENTLY idx_activity_notification_broadcasts_priority ON useractivity.notification_broadcasts(priority, status);

-- 通知投递表索引
CREATE INDEX CONCURRENTLY idx_activity_notification_deliveries_user_status ON useractivity.notification_deliveries(user_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_activity_notification_deliveries_broadcast ON useractivity.notification_deliveries(broadcast_id, status);
CREATE INDEX CONCURRENTLY idx_activity_notification_deliveries_channel ON useractivity.notification_deliveries(channel, status);
CREATE INDEX CONCURRENTLY idx_activity_notification_deliveries_retry ON useractivity.notification_deliveries(status, retry_count) WHERE status = 'failed';

-- 通知偏好表索引
CREATE INDEX CONCURRENTLY idx_activity_notification_preferences_user ON useractivity.notification_preferences(user_id);
CREATE INDEX CONCURRENTLY idx_activity_notification_preferences_category ON useractivity.notification_preferences(category);
CREATE INDEX CONCURRENTLY idx_activity_notification_preferences_enabled ON useractivity.notification_preferences(is_enabled);

-- NPS反馈表索引
CREATE INDEX CONCURRENTLY idx_activity_nps_feedback_user ON useractivity.nps_feedback(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_activity_nps_feedback_score ON useractivity.nps_feedback(score, created_at DESC);
CREATE INDEX CONCURRENTLY idx_activity_nps_feedback_promoter ON useractivity.nps_feedback(promoter_type, created_at DESC);
CREATE INDEX CONCURRENTLY idx_activity_nps_feedback_category ON useractivity.nps_feedback(feedback_category, created_at DESC);

-- ========================================
-- 创建触发器和函数
-- ========================================

-- 更新时间戳触发器函数
CREATE OR REPLACE FUNCTION useractivity.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为主要表创建更新时间戳触发器
CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON useractivity.notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_updated_at_column();

CREATE TRIGGER update_notification_broadcasts_updated_at
    BEFORE UPDATE ON useractivity.notification_broadcasts
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_updated_at_column();

CREATE TRIGGER update_notification_deliveries_updated_at
    BEFORE UPDATE ON useractivity.notification_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON useractivity.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_updated_at_column();

CREATE TRIGGER update_nps_feedback_updated_at
    BEFORE UPDATE ON useractivity.nps_feedback
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_updated_at_column();

-- 通知投递状态自动更新触发器
CREATE OR REPLACE FUNCTION useractivity.update_delivery_status()
RETURNS TRIGGER AS $$
BEGIN
    -- 自动更新投递状态和时间戳
    IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
        NEW.sent_at = now();
    ELSIF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        NEW.delivered_at = now();
    ELSIF NEW.status = 'read' AND OLD.status != 'read' THEN
        NEW.read_at = now();
    ELSIF NEW.status = 'failed' AND OLD.status != 'failed' THEN
        NEW.failed_at = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_delivery_status_trigger
    BEFORE UPDATE ON useractivity.notification_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_delivery_status();

-- 通知广播状态自动更新触发器
CREATE OR REPLACE FUNCTION useractivity.update_broadcast_status()
RETURNS TRIGGER AS $$
BEGIN
    -- 自动更新广播状态
    IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
        NEW.sent_at = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_broadcast_status_trigger
    BEFORE UPDATE ON useractivity.notification_broadcasts
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_broadcast_status();

-- ========================================
-- 创建视图
-- ========================================

-- 通知统计汇总视图
CREATE OR REPLACE VIEW useractivity.notification_analytics AS
SELECT
    DATE_TRUNC('day', nb.created_at) as date,
    nb.target_audience,
    nb.priority,
    nb.status,
    COUNT(*) as total_broadcasts,
    COUNT(CASE WHEN nb.template_id IS NOT NULL THEN 1 END) as template_based_broadcasts,
    SUM(jsonb_extract_path_text(nb.delivery_stats, 'total_sent')::INTEGER) as total_deliveries,
    SUM(jsonb_extract_path_text(nb.delivery_stats, 'total_delivered')::INTEGER) as total_successful_deliveries,
    SUM(jsonb_extract_path_text(nb.delivery_stats, 'total_read')::INTEGER) as total_reads,
    CASE WHEN SUM(jsonb_extract_path_text(nb.delivery_stats, 'total_sent')::INTEGER) > 0 THEN
         ROUND(SUM(jsonb_extract_path_text(nb.delivery_stats, 'total_delivered')::INTEGER)::NUMERIC /
               SUM(jsonb_extract_path_text(nb.delivery_stats, 'total_sent')::INTEGER) * 100, 2)
         ELSE 0 END as delivery_rate_pct,
    CASE WHEN SUM(jsonb_extract_path_text(nb.delivery_stats, 'total_delivered')::INTEGER) > 0 THEN
         ROUND(SUM(jsonb_extract_path_text(nb.delivery_stats, 'total_read')::INTEGER)::NUMERIC /
               SUM(jsonb_extract_path_text(nb.delivery_stats, 'total_delivered')::INTEGER) * 100, 2)
         ELSE 0 END as read_rate_pct
FROM useractivity.notification_broadcasts nb
GROUP BY DATE_TRUNC('day', nb.created_at), nb.target_audience, nb.priority, nb.status
ORDER BY date DESC;

-- 用户通知活动视图
CREATE OR REPLACE VIEW useractivity.user_notification_activity AS
SELECT
    u.id as user_id,
    u.email,
    u.name,
    -- 通知统计
    total_notifications,
    unread_notifications,
    read_notifications,
    failed_notifications,
    -- 偏好设置
    notification_preferences,
    -- 最近活动
    last_notification_time,
    last_read_time,
    u.created_at as user_created_at
FROM "user".users u
LEFT JOIN (
    SELECT
        nd.user_id,
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN nd.status IN ('sent', 'delivered') THEN 1 END) as unread_notifications,
        COUNT(CASE WHEN nd.status = 'read' THEN 1 END) as read_notifications,
        COUNT(CASE WHEN nd.status = 'failed' THEN 1 END) as failed_notifications,
        MAX(nd.created_at) as last_notification_time,
        MAX(nd.read_at) as last_read_time
    FROM useractivity.notification_deliveries nd
    GROUP BY nd.user_id
) notifications ON u.id = notifications.user_id
LEFT JOIN (
    SELECT
        np.user_id,
        jsonb_agg(
            jsonb_build_object(
                'category', np.category,
                'channels_enabled', np.channels_enabled,
                'frequency_limit', np.frequency_limit,
                'is_enabled', np.is_enabled
            )
        ) as notification_preferences
    FROM useractivity.notification_preferences np
    WHERE np.is_enabled = true
    GROUP BY np.user_id
) prefs ON u.id = prefs.user_id;

-- NPS分析视图
CREATE OR REPLACE VIEW useractivity.nps_analytics AS
SELECT
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as total_responses,
    AVG(score) as avg_score,
    COUNT(CASE WHEN score >= 9 THEN 1 END) as promoters,
    COUNT(CASE WHEN score >= 7 AND score <= 8 THEN 1 END) as passives,
    COUNT(CASE WHEN score <= 6 THEN 1 END) as detractors,
    CASE WHEN COUNT(*) > 0 THEN
         ROUND((COUNT(CASE WHEN score >= 9 THEN 1 END) - COUNT(CASE WHEN score <= 6 THEN 1 END))::NUMERIC / COUNT(*) * 100, 2)
         ELSE 0 END as nps_score,
    COUNT(CASE WHEN follow_up_required = true THEN 1 END) as follow_ups_required,
    COUNT(CASE WHEN follow_up_status = 'pending' THEN 1 END) as pending_followups
FROM useractivity.nps_feedback
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- ========================================
-- 提交事务
-- ========================================

COMMIT;

-- 验证Schema创建
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'activity') THEN
        RAISE NOTICE '✅ activity notification management schema created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create activity notification management schema';
    END IF;
END $$;

