-- ========================================
-- Google-Monetize 数据库迁移: UserActivity Schema Initialization
-- 创建用户活动域 (UserActivity Domain) Schema
-- 项目初始化状态 - 直接创建最终架构
-- 迁移ID: 001
-- 版本: v2.0
-- 创建时间: 2025-10-21
-- ========================================

-- 开始事务
BEGIN;

-- 创建用户活动域Schema
CREATE SCHEMA IF NOT EXISTS useractivity;

-- 设置Schema权限

-- ========================================
-- 1. 用户活动表
-- ========================================
CREATE TABLE useractivity.user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,

    -- 活动基本信息
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'page_view', 'feature_used', 'form_submit', 'file_download', 'search_query',
        'api_call', 'login', 'logout', 'account_update', 'settings_change',
        'offer_created', 'offer_updated', 'offer_deleted', 'simulation_run',
        'export_requested', 'notification_sent', 'error_occurred'
    )),
    activity_category TEXT DEFAULT 'user_action' CHECK (activity_category IN (
        'user_action', 'system_action', 'business_action', 'security_action',
        'error_action', 'analytics_action'
    )),

    -- 活动内容
    activity_data JSONB DEFAULT '{}'::jsonb,
    page_url TEXT,
    referrer_url TEXT,
    user_agent TEXT,
    ip_address INET,
    session_id TEXT,

    -- 性能数据
    duration_ms INTEGER CHECK (duration_ms >= 0),
    success BOOLEAN DEFAULT true,
    error_code TEXT,
    error_message TEXT,

    -- 业务上下文
    resource_id TEXT, -- 相关资源ID，如offer_id, export_id等
    resource_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now(),

    -- 数据完整性约束
    CONSTRAINT user_activities_duration_positive CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

-- ========================================
-- 2. 用户参与度统计表
-- ========================================
CREATE TABLE useractivity.user_engagement_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,

    -- 活动统计
    session_count INTEGER DEFAULT 0 CHECK (session_count >= 0),
    total_session_duration_minutes INTEGER DEFAULT 0 CHECK (total_session_duration_minutes >= 0),
    page_views INTEGER DEFAULT 0 CHECK (page_views >= 0),
    unique_pages_visited INTEGER DEFAULT 0 CHECK (unique_pages_visited >= 0),
    features_used JSONB DEFAULT '[]'::jsonb,
    actions_performed INTEGER DEFAULT 0 CHECK (actions_performed >= 0),

    -- 错误和性能统计
    error_count INTEGER DEFAULT 0 CHECK (error_count >= 0),
    performance_issues INTEGER DEFAULT 0 CHECK (performance_issues >= 0),
    slow_page_loads INTEGER DEFAULT 0 CHECK (slow_page_loads >= 0),

    -- 参与度评分
    engagement_score NUMERIC(5,2) CHECK (engagement_score >= 0.00),
    activity_level TEXT DEFAULT 'low' CHECK (activity_level IN ('none', 'low', 'medium', 'high', 'very_high')),

    -- 时间信息
    first_activity_time TIMESTAMPTZ,
    last_activity_time TIMESTAMPTZ,
    device_types JSONB DEFAULT '[]'::jsonb,
    browser_types JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 唯一约束
    UNIQUE(user_id, metric_date)
);

-- ========================================
-- 3. 用户会话表
-- ========================================
CREATE TABLE useractivity.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,

    -- 会话信息
    device_info JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    landing_page TEXT,
    exit_page TEXT,

    -- 会话状态
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    session_type TEXT DEFAULT 'regular' CHECK (session_type IN ('regular', 'mobile_app', 'api', 'admin')),

    -- 时间信息
    created_at TIMESTAMPTZ DEFAULT now(),
    last_accessed TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,

    -- 会话统计
    page_views INTEGER DEFAULT 0,
    actions_count INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    total_activity_duration_seconds INTEGER DEFAULT 0,

    metadata JSONB DEFAULT '{}'::jsonb,

    -- 数据完整性约束
    CONSTRAINT user_sessions_expiry_future CHECK (expires_at > created_at),
    CONSTRAINT user_sessions_duration_positive CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
);

-- ========================================
-- 4. 用户行为模式表
-- ========================================
CREATE TABLE useractivity.user_behavior_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,

    -- 模式识别
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'daily_routine', 'weekly_habits', 'feature_preferences', 'usage_frequency',
        'peak_hours', 'device_preferences', 'navigation_patterns', 'content_consumption'
    )),
    pattern_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_score NUMERIC(3,2) CHECK (confidence_score BETWEEN 0 AND 1),

    -- 模式属性
    frequency_score NUMERIC(3,2) CHECK (frequency_score BETWEEN 0 AND 1),
    consistency_score NUMERIC(3,2) CHECK (consistency_score BETWEEN 0 AND 1),
    engagement_score NUMERIC(3,2) CHECK (engagement_score BETWEEN 0 AND 1),

    -- 分析结果
    insights JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,

    -- 统计数据
    observation_period_days INTEGER DEFAULT 30,
    data_points INTEGER DEFAULT 0,
    last_analyzed TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ========================================
-- 5. 用户留存表
-- ========================================
CREATE TABLE useractivity.user_retention_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,

    -- 留存计算
    cohort_date DATE NOT NULL,
    cohort_type TEXT NOT NULL CHECK (cohort_type IN ('daily', 'weekly', 'monthly')),
    day_0_active BOOLEAN DEFAULT true,
    day_1_active BOOLEAN,
    day_3_active BOOLEAN,
    day_7_active BOOLEAN,
    day_14_active BOOLEAN,
    day_30_active BOOLEAN,

    -- 留存率
    day_1_retention_rate NUMERIC(5,4),
    day_7_retention_rate NUMERIC(5,4),
    day_30_retention_rate NUMERIC(5,4),

    -- 活跃度数据
    total_active_days INTEGER DEFAULT 1,
    avg_session_duration_minutes NUMERIC(10,2),
    total_sessions INTEGER DEFAULT 1,
    total_actions INTEGER DEFAULT 0,

    -- 预测数据
    predicted_lifespan_days INTEGER,
    churn_probability NUMERIC(3,2) CHECK (churn_probability BETWEEN 0 AND 1),

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 唯一约束
    UNIQUE(user_id, cohort_date, cohort_type)
);

-- ========================================
-- 创建索引
-- ========================================

-- 用户活动表索引
CREATE INDEX idx_useractivities_user_created ON useractivity.user_activities(user_id, created_at DESC);
CREATE INDEX idx_useractivities_type ON useractivity.user_activities(activity_type, created_at DESC);
CREATE INDEX idx_useractivities_category ON useractivity.user_activities(activity_category, created_at DESC);
CREATE INDEX idx_useractivities_session ON useractivity.user_activities(session_id, created_at DESC);
CREATE INDEX idx_useractivities_success ON useractivity.user_activities(success, created_at DESC) WHERE success = false;
CREATE INDEX idx_useractivities_created_date ON useractivity.user_activities(created_at DESC);
CREATE INDEX idx_useractivities_resource ON useractivity.user_activities(resource_type, resource_id) WHERE resource_id IS NOT NULL;

-- 用户参与度指标表索引
CREATE INDEX idx_user_engagement_user_date ON useractivity.user_engagement_metrics(user_id, metric_date DESC);
CREATE INDEX idx_user_engagement_score ON useractivity.user_engagement_metrics(engagement_score DESC);
CREATE INDEX idx_user_engagement_level ON useractivity.user_engagement_metrics(activity_level, metric_date DESC);
CREATE INDEX idx_user_engagement_date ON useractivity.user_engagement_metrics(metric_date DESC);

-- 用户会话表索引
CREATE INDEX idx_user_sessions_user ON useractivity.user_sessions(user_id, status);
CREATE INDEX idx_user_sessions_token ON useractivity.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON useractivity.user_sessions(expires_at) WHERE status = 'active';
CREATE INDEX idx_user_sessions_type ON useractivity.user_sessions(session_type, created_at DESC);
CREATE INDEX idx_user_sessions_accessed ON useractivity.user_sessions(last_accessed DESC);

-- 用户行为模式表索引
CREATE INDEX idx_user_behavior_patterns_user ON useractivity.user_behavior_patterns(user_id, pattern_type);
CREATE INDEX idx_user_behavior_patterns_type ON useractivity.user_behavior_patterns(pattern_type, confidence_score DESC);
CREATE INDEX idx_user_behavior_patterns_score ON useractivity.user_behavior_patterns(engagement_score DESC);
CREATE INDEX idx_user_behavior_patterns_analyzed ON useractivity.user_behavior_patterns(last_analyzed DESC);

-- 用户留存表索引
CREATE INDEX idx_user_retention_user ON useractivity.user_retention_metrics(user_id, cohort_date DESC);
CREATE INDEX idx_user_retention_cohort ON useractivity.user_retention_metrics(cohort_type, cohort_date);
CREATE INDEX idx_user_retention_day7 ON useractivity.user_retention_metrics(day_7_active, day_30_active);
CREATE INDEX idx_user_retention_churn ON useractivity.user_retention_metrics(churn_probability DESC) WHERE churn_probability > 0.5;

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
CREATE TRIGGER update_user_engagement_metrics_updated_at
    BEFORE UPDATE ON useractivity.user_engagement_metrics
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_updated_at_column();

CREATE TRIGGER update_user_behavior_patterns_updated_at
    BEFORE UPDATE ON useractivity.user_behavior_patterns
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_updated_at_column();

CREATE TRIGGER update_user_retention_metrics_updated_at
    BEFORE UPDATE ON useractivity.user_retention_metrics
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_updated_at_column();

-- 用户活动自动更新参与度指标触发器
CREATE OR REPLACE FUNCTION useractivity.update_engagement_metrics()
RETURNS TRIGGER AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
    day_sessions INTEGER;
    day_duration INTEGER;
    day_actions INTEGER;
    day_errors INTEGER;
    engagement_score NUMERIC;
    activity_level TEXT;
BEGIN
    -- 统计当日活动数据
    SELECT
        COUNT(DISTINCT session_id),
        SUM(duration_ms) / 1000,
        COUNT(*),
        COUNT(CASE WHEN success = false THEN 1 END)
    INTO day_sessions, day_duration, day_actions, day_errors
    FROM useractivity.user_activities
    WHERE user_id = NEW.user_id
    AND DATE(created_at) = current_date;

    -- 如果当天有活动，更新或创建参与度指标
    IF day_sessions > 0 THEN
        -- 计算参与度分数 (0-100分)
        engagement_score := LEAST(
            (day_sessions::NUMERIC * 5) +
            (LEAST(day_duration / 60, 30)::NUMERIC * 2) +
            (day_actions::NUMERIC * 3) -
            (day_errors::NUMERIC * 5),
            100
        );

        -- 确定活跃度等级
        activity_level := CASE
            WHEN engagement_score >= 80 THEN 'very_high'
            WHEN engagement_score >= 60 THEN 'high'
            WHEN engagement_score >= 40 THEN 'medium'
            WHEN engagement_score >= 20 THEN 'low'
            ELSE 'none'
        END;

        -- 更新或插入记录
        INSERT INTO useractivity.user_engagement_metrics (
            user_id, metric_date, session_count, total_session_duration_minutes,
            actions_performed, error_count, engagement_score, activity_level,
            created_at, updated_at
        ) VALUES (
            NEW.user_id, current_date, day_sessions, day_duration,
            day_actions, day_errors, engagement_score, activity_level,
            now(), now()
        )
        ON CONFLICT (user_id, metric_date) DO UPDATE SET
            session_count = EXCLUDED.session_count,
            total_session_duration_minutes = EXCLUDED.total_session_duration_minutes,
            actions_performed = EXCLUDED.actions_performed,
            error_count = EXCLUDED.error_count,
            engagement_score = EXCLUDED.engagement_score,
            activity_level = EXCLUDED.activity_level,
            updated_at = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_engagement_metrics_trigger
    AFTER INSERT ON useractivity.user_activities
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_engagement_metrics();

-- 会话活跃时间更新触发器
CREATE OR REPLACE FUNCTION useractivity.update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新会话最后访问时间和统计数据
    NEW.last_accessed = now();

    -- 计算会话持续时间
    IF NEW.created_at IS NOT NULL THEN
        NEW.duration_minutes = EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 60;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_activity_trigger
    BEFORE UPDATE ON useractivity.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION useractivity.update_session_activity();

-- ========================================
-- 创建视图
-- ========================================

-- 用户活动总览视图
CREATE OR REPLACE VIEW useractivity.user_activity_summary AS
SELECT
    u.id as user_id,
    u.email,
    u.name,
    -- 活动统计
    today_sessions,
    today_actions,
    today_engagement_score,
    -- 本周活动
    week_sessions,
    week_engagement_score,
    week_activity_level,
    -- 总体统计
    total_activities,
    avg_session_duration,
    last_login,
    last_activity,
    u.created_at as user_created_at
FROM "user".users u
LEFT JOIN (
    SELECT
        user_id,
        COUNT(*) as today_sessions,
        SUM(actions_performed) as today_actions,
        AVG(engagement_score) as today_engagement_score
    FROM useractivity.user_engagement_metrics
    WHERE metric_date = CURRENT_DATE
    GROUP BY user_id
) today ON u.id = today.user_id
LEFT JOIN (
    SELECT
        user_id,
        COUNT(*) as week_sessions,
        AVG(engagement_score) as week_engagement_score,
        mode() WITHIN GROUP (ORDER BY activity_level) as week_activity_level
    FROM useractivity.user_engagement_metrics
    WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY user_id
) week ON u.id = week.user_id
LEFT JOIN (
    SELECT
        user_id,
        COUNT(*) as total_activities,
        AVG(total_session_duration_minutes) as avg_session_duration
    FROM useractivity.user_engagement_metrics
    GROUP BY user_id
) overall ON u.id = overall.user_id
LEFT JOIN (
    SELECT DISTINCT ON (user_id)
        user_id,
        created_at as last_login
    FROM useractivity.user_activities
    WHERE activity_type = 'login'
    ORDER BY user_id, created_at DESC
) login ON u.id = login.user_id
LEFT JOIN (
    SELECT DISTINCT ON (user_id)
        user_id,
        created_at as last_activity
    FROM useractivity.user_activities
    ORDER BY user_id, created_at DESC
) activity ON u.id = activity.user_id;

-- 每日活动趋势视图
CREATE OR REPLACE VIEW useractivity.daily_activity_trends AS
SELECT
    DATE(created_at) as activity_date,
    activity_type,
    COUNT(*) as total_activities,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions,
    AVG(duration_ms) as avg_duration_ms,
    COUNT(CASE WHEN success = false THEN 1 END) as failed_activities,
    AVG(CASE WHEN success = true THEN 1 ELSE 0 END)::NUMERIC * 100 as success_rate_pct
FROM useractivity.user_activities
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), activity_type
ORDER BY activity_date DESC, total_activities DESC;

-- 用户留存分析视图
CREATE OR REPLACE VIEW useractivity.retention_analysis AS
SELECT
    cohort_date,
    cohort_type,
    COUNT(*) as cohort_size,
    COUNT(CASE WHEN day_1_active THEN 1 END) as day_1_active,
    COUNT(CASE WHEN day_7_active THEN 1 END) as day_7_active,
    COUNT(CASE WHEN day_30_active THEN 1 END) as day_30_active,
    ROUND(AVG(day_1_retention_rate) * 100, 2) as avg_day1_retention_pct,
    ROUND(AVG(day_7_retention_rate) * 100, 2) as avg_day7_retention_pct,
    ROUND(AVG(day_30_retention_rate) * 100, 2) as avg_day30_retention_pct,
    ROUND(AVG(churn_probability) * 100, 2) as avg_churn_rate_pct
FROM useractivity.user_retention_metrics
GROUP BY cohort_date, cohort_type
ORDER BY cohort_date DESC;

-- ========================================
-- 初始化数据
-- ========================================

-- 这里不需要初始化数据，因为所有数据都是基于用户行为动态生成的

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
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'useractivity') THEN
        RAISE NOTICE '✅ useractivity schema created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create useractivity schema';
    END IF;
END $$;

-- 验证表创建
DO $$
BEGIN
    DECLARE table_count INTEGER;
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'useractivity'
    AND table_type = 'BASE TABLE';

    IF table_count = 5 THEN
        RAISE NOTICE '✅ All useractivity tables created successfully (5 tables)';
    ELSE
        RAISE EXCEPTION '❌ Expected 5 tables, found % tables', table_count;
    END IF;
END $$;

