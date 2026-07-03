-- ========================================
-- Google-Monetize 数据库迁移: Adscenter Schema
-- Layer 3: 业务域层 - 广告中心管理
-- 迁移ID: 002
-- 版本: v2.0 (优化版)
-- 创建时间: 2025-10-21
-- 优化时间: 2025-10-22
-- 优先级: P0修复 - UUID类型一致性
-- ========================================
--
-- 优化内容:
-- ✅ 修复12处UUID类型不匹配 (所有外键: TEXT → UUID)
--    - campaigns.account_connection_id
--    - ad_groups.campaign_id
--    - ad_creatives.ad_group_id
--    - ad_creatives.campaign_id
--    - performance_data.campaign_id
--    - performance_data.ad_group_id
--    - performance_data.creative_id
--    - performance_data.account_connection_id
--    - keyword_performance.ad_group_id
--    - audiences.account_connection_id
--    - bidding_strategies.account_connection_id
--    - bidding_strategies.campaign_id
-- ✅ 确保所有内部引用外键类型与主键一致
-- ✅ Layer 3依赖: 需要先创建 user.users (Layer 2)
--
-- ========================================

-- 开始事务
BEGIN;

-- 创建广告中心域Schema
CREATE SCHEMA IF NOT EXISTS adscenter;

-- 设置Schema权限

-- 1. 广告账户连接表
CREATE TABLE adscenter.account_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'facebook_ads', 'linkedin_ads', 'tiktok_ads', 'twitter_ads')),
    platform_account_id TEXT NOT NULL,
    platform_account_name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'disconnected', 'error', 'suspended')),
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    permissions JSONB DEFAULT '[]'::jsonb,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
    last_sync TIMESTAMPTZ,
    sync_error TEXT,
    rate_limit_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 数据完整性约束
    CONSTRAINT account_connections_platform_user_unique UNIQUE(platform, platform_account_id, user_id),
    CONSTRAINT account_connections_expiry_future CHECK (token_expires_at IS NULL OR token_expires_at > created_at)
);

-- 2. 广告活动管理表
CREATE TABLE adscenter.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_connection_id UUID NOT NULL REFERENCES adscenter.account_connections(id) ON DELETE CASCADE,
    platform_campaign_id TEXT NOT NULL,
    campaign_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('enabled', 'paused', 'removed', 'draft')),
    campaign_type TEXT,
    budget_amount_cents INTEGER,
    budget_type TEXT CHECK (budget_type IN ('daily', 'lifetime')),
    start_date DATE,
    end_date DATE,
    targeting JSONB DEFAULT '{}'::jsonb,
    creatives JSONB DEFAULT '[]'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    optimization_status TEXT DEFAULT 'not_optimized' CHECK (optimization_status IN ('not_optimized', 'optimizing', 'optimized', 'failed')),
    auto_optimization_enabled BOOLEAN DEFAULT false,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
    last_sync TIMESTAMPTZ,
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 数据完整性约束
    CONSTRAINT campaigns_budget_positive CHECK (budget_amount_cents IS NULL OR budget_amount_cents >= 0),
    CONSTRAINT campaigns_date_logic CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    CONSTRAINT campaigns_account_platform_unique UNIQUE(account_connection_id, platform_campaign_id)
);

-- 3. 广告组表
CREATE TABLE adscenter.ad_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES adscenter.campaigns(id) ON DELETE CASCADE,
    platform_ad_group_id TEXT NOT NULL,
    ad_group_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('enabled', 'paused', 'removed')),
    targeting JSONB DEFAULT '{}'::jsonb,
    keywords JSONB DEFAULT '[]'::jsonb,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
    last_sync TIMESTAMPTZ,
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 唯一约束
    CONSTRAINT ad_groups_campaign_platform_unique UNIQUE(campaign_id, platform_ad_group_id)
);

-- 4. 广告创意表
CREATE TABLE adscenter.ad_creatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_group_id UUID REFERENCES adscenter.ad_groups(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES adscenter.campaigns(id) ON DELETE CASCADE,
    platform_creative_id TEXT NOT NULL,
    creative_name TEXT,
    creative_type TEXT CHECK (creative_type IN ('text_ad', 'image_ad', 'video_ad', 'responsive_ad', 'app_ad')),
    headline TEXT,
    description TEXT,
    image_urls JSONB DEFAULT '[]'::jsonb,
    video_url TEXT,
    landing_page_url TEXT,
    call_to_action TEXT,
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'under_review')),
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
    last_sync TIMESTAMPTZ,
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 唯一约束
    CONSTRAINT ad_creatives_campaign_platform_unique UNIQUE(campaign_id, platform_creative_id)
);

-- 5. 批量操作记录表
CREATE TABLE adscenter.bulk_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('campaign_create', 'campaign_update', 'campaign_pause', 'ad_group_create', 'ad_group_update', 'creative_create', 'creative_update', 'keyword_add', 'keyword_remove')),
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled', 'partial_success')),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    operation_data JSONB NOT NULL,
    results JSONB DEFAULT '{}'::jsonb,
    error_details JSONB DEFAULT '[]'::jsonb,
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
    max_retries INTEGER DEFAULT 3 CHECK (max_retries >= 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ,
    created_by TEXT REFERENCES "user".users(id),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 数据完整性约束
    CONSTRAINT bulk_operations_processed_logic CHECK (processed_items >= 0 AND processed_items <= total_items),
    CONSTRAINT bulk_operations_failed_logic CHECK (failed_items >= 0 AND failed_items <= total_items),
    CONSTRAINT bulk_operations_duration_positive CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes >= 0)
);

-- 6. 广告性能数据表
CREATE TABLE adscenter.performance_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES adscenter.campaigns(id) ON DELETE CASCADE,
    ad_group_id UUID REFERENCES adscenter.ad_groups(id) ON DELETE CASCADE,
    creative_id UUID REFERENCES adscenter.ad_creatives(id) ON DELETE CASCADE,
    account_connection_id UUID NOT NULL REFERENCES adscenter.account_connections(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    impressions BIGINT DEFAULT 0 CHECK (impressions >= 0),
    clicks BIGINT DEFAULT 0 CHECK (clicks >= 0),
    conversions BIGINT DEFAULT 0 CHECK (conversions >= 0),
    cost_cents BIGINT DEFAULT 0 CHECK (cost_cents >= 0),
    ctr NUMERIC(5,4) CHECK (ctr >= 0.0000 AND ctr <= 1.0000), -- Click-through rate
    cpc_cents NUMERIC(10,2) CHECK (cpc_cents >= 0), -- Cost-per-click
    conversion_rate NUMERIC(5,4) CHECK (conversion_rate >= 0.0000 AND conversion_rate <= 1.0000),
    cpa_cents NUMERIC(10,2) CHECK (cpa_cents >= 0), -- Cost-per-acquisition
    average_position NUMERIC(5,2) CHECK (average_position >= 0),
    quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 10),
    data_source TEXT DEFAULT 'platform_api' CHECK (data_source IN ('platform_api', 'imported', 'manual')),
    sync_status TEXT DEFAULT 'raw' CHECK (sync_status IN ('raw', 'processed', 'verified', 'anomaly_detected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 唯一约束 (account + date + 至少一个level)
    CONSTRAINT performance_data_unique UNIQUE(account_connection_id, date, campaign_id, ad_group_id, creative_id),
    CONSTRAINT performance_data_date_not_future CHECK (date <= CURRENT_DATE)
);

-- 7. 关键词表现表
CREATE TABLE adscenter.keyword_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_group_id UUID NOT NULL REFERENCES adscenter.ad_groups(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    match_type TEXT NOT NULL CHECK (match_type IN ('broad', 'phrase', 'exact')),
    date DATE NOT NULL,
    impressions BIGINT DEFAULT 0 CHECK (impressions >= 0),
    clicks BIGINT DEFAULT 0 CHECK (clicks >= 0),
    conversions BIGINT DEFAULT 0 CHECK (conversions >= 0),
    cost_cents BIGINT DEFAULT 0 CHECK (cost_cents >= 0),
    cpc_cents NUMERIC(10,2) CHECK (cpc_cents >= 0),
    conversion_rate NUMERIC(5,4) CHECK (conversion_rate >= 0.0000 AND conversion_rate <= 1.0000),
    quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 10),
    first_page_cpc NUMERIC(10,2),
    top_of_page_cpc NUMERIC(10,2),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 唯一约束
    CONSTRAINT keyword_performance_unique UNIQUE(ad_group_id, keyword, match_type, date)
);

-- 8. 受众群体表
CREATE TABLE adscenter.audiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_connection_id UUID NOT NULL REFERENCES adscenter.account_connections(id) ON DELETE CASCADE,
    platform_audience_id TEXT NOT NULL,
    audience_name TEXT NOT NULL,
    audience_type TEXT CHECK (audience_type IN ('custom', 'in_market', 'affinity', 'remarketing', 'lookalike', 'demographic')),
    description TEXT,
    size_range TEXT,
    criteria JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    performance_summary JSONB DEFAULT '{}'::jsonb,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
    last_sync TIMESTAMPTZ,
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 唯一约束
    CONSTRAINT audiences_account_platform_unique UNIQUE(account_connection_id, platform_audience_id)
);

-- 9. 竞价策略表
CREATE TABLE adscenter.bidding_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_connection_id UUID NOT NULL REFERENCES adscenter.account_connections(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES adscenter.campaigns(id) ON DELETE CASCADE,
    strategy_name TEXT NOT NULL,
    strategy_type TEXT NOT NULL CHECK (strategy_type IN ('manual_cpc', 'target_cpa', 'target_roas', 'maximize_conversions', 'maximize_clicks', 'target_impression_share')),
    target_cpa_cents INTEGER,
    target_roas NUMERIC(5,2),
    max_cpc_cents INTEGER,
    target_spend_cents INTEGER,
    target_impression_share NUMERIC(3,2),
    location TEXT CHECK (location IN ('absolute_top_search', 'first_page', 'first_position_on_page')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    performance_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ========================================
-- 创建索引
-- ========================================

-- 账户连接表索引
CREATE INDEX idx_adscenter_connections_user_platform ON adscenter.account_connections(user_id, platform);
CREATE INDEX idx_adscenter_connections_status ON adscenter.account_connections(status) WHERE status IN ('active', 'pending');
CREATE INDEX idx_adscenter_connections_sync_status ON adscenter.account_connections(sync_status, last_sync);
CREATE INDEX idx_adscenter_connections_token_expiry ON adscenter.account_connections(token_expires_at) WHERE token_expires_at IS NOT NULL;

-- 活动表索引
CREATE INDEX idx_adscenter_campaigns_connection ON adscenter.campaigns(account_connection_id, status);
CREATE INDEX idx_adscenter_campaigns_status ON adscenter.campaigns(status, updated_at DESC);
CREATE INDEX idx_adscenter_campaigns_dates ON adscenter.campaigns(start_date, end_date) WHERE start_date IS NOT NULL;
CREATE INDEX idx_adscenter_campaigns_optimization ON adscenter.campaigns(optimization_status, auto_optimization_enabled);

-- 广告组表索引
CREATE INDEX idx_adscenter_ad_groups_campaign ON adscenter.ad_groups(campaign_id, status);
CREATE INDEX idx_adscenter_ad_groups_sync_status ON adscenter.ad_groups(sync_status, last_sync);

-- 创意表索引
CREATE INDEX idx_adscenter_creatives_campaign ON adscenter.ad_creatives(campaign_id, approval_status);
CREATE INDEX idx_adscenter_creatives_approval ON adscenter.ad_creatives(approval_status, sync_status);
CREATE INDEX idx_adscenter_creatives_type ON adscenter.ad_creatives(creative_type);

-- 批量操作表索引
CREATE INDEX idx_adscenter_bulk_operations_user_status ON adscenter.bulk_operations(user_id, status, created_at DESC);
CREATE INDEX idx_adscenter_bulk_operations_type_priority ON adscenter.bulk_operations(operation_type, priority, status);
CREATE INDEX idx_adscenter_bulk_operations_scheduled ON adscenter.bulk_operations(scheduled_for, status) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_adscenter_bulk_operations_processing ON adscenter.bulk_operations(status, started_at) WHERE status IN ('processing', 'queued');

-- 性能数据表索引
CREATE INDEX idx_adscenter_performance_date ON adscenter.performance_data(date DESC);
CREATE INDEX idx_adscenter_performance_campaign_date ON adscenter.performance_data(campaign_id, date DESC);
CREATE INDEX idx_adscenter_performance_account_date ON adscenter.performance_data(account_connection_id, date DESC);
CREATE INDEX idx_adscenter_performance_sync_status ON adscenter.performance_data(sync_status);

-- 关键词表现表索引
CREATE INDEX idx_adscenter_keyword_perf_date ON adscenter.keyword_performance(date DESC);
CREATE INDEX idx_adscenter_keyword_perf_group_date ON adscenter.keyword_performance(ad_group_id, date DESC);
CREATE INDEX idx_adscenter_keyword_perf_keyword ON adscenter.keyword_performance(keyword, match_type, date DESC);
CREATE INDEX idx_adscenter_keyword_perf_status ON adscenter.keyword_performance(status, date DESC);

-- 受众群体表索引
CREATE INDEX idx_adscenter_audiences_account ON adscenter.audiences(account_connection_id, status);
CREATE INDEX idx_adscenter_audiences_type ON adscenter.audiences(audience_type, status);

-- 竞价策略表索引
CREATE INDEX idx_adscenter_bidding_account ON adscenter.bidding_strategies(account_connection_id, status);
CREATE INDEX idx_adscenter_bidding_campaign ON adscenter.bidding_strategies(campaign_id, status);
CREATE INDEX idx_adscenter_bidding_type ON adscenter.bidding_strategies(strategy_type, status);

-- ========================================
-- 创建触发器和函数
-- ========================================

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION adscenter.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有主要表创建更新时间戳触发器
CREATE TRIGGER update_account_connections_updated_at
    BEFORE UPDATE ON adscenter.account_connections
    FOR EACH ROW
    EXECUTE FUNCTION adscenter.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON adscenter.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION adscenter.update_updated_at_column();

CREATE TRIGGER update_ad_groups_updated_at
    BEFORE UPDATE ON adscenter.ad_groups
    FOR EACH ROW
    EXECUTE FUNCTION adscenter.update_updated_at_column();

CREATE TRIGGER update_ad_creatives_updated_at
    BEFORE UPDATE ON adscenter.ad_creatives
    FOR EACH ROW
    EXECUTE FUNCTION adscenter.update_updated_at_column();

CREATE TRIGGER update_audiences_updated_at
    BEFORE UPDATE ON adscenter.audiences
    FOR EACH ROW
    EXECUTE FUNCTION adscenter.update_updated_at_column();

CREATE TRIGGER update_bidding_strategies_updated_at
    BEFORE UPDATE ON adscenter.bidding_strategies
    FOR EACH ROW
    EXECUTE FUNCTION adscenter.update_updated_at_column();

-- 批量操作状态更新触发器
CREATE OR REPLACE FUNCTION adscenter.update_bulk_operation_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- 自动更新处理进度
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = now();
        NEW.processed_items = NEW.total_items;
        NEW.failed_items = LEAST(NEW.failed_items, NEW.total_items - NEW.processed_items);
    ELSIF NEW.status = 'processing' AND OLD.status != 'processing' THEN
        NEW.started_at = COALESCE(NEW.started_at, now());
    END IF;

    -- 计算实际持续时间
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.actual_duration_minutes = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) / 60;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bulk_operation_progress_trigger
    BEFORE UPDATE ON adscenter.bulk_operations
    FOR EACH ROW
    EXECUTE FUNCTION adscenter.update_bulk_operation_progress();

-- 同步状态自动更新函数
CREATE OR REPLACE FUNCTION adscenter.update_sync_status_on_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- 当性能数据更新时，自动标记同步状态为已处理
    IF NEW.sync_status = 'raw' THEN
        NEW.sync_status = 'processed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_performance_sync_status_trigger
    BEFORE UPDATE ON adscenter.performance_data
    FOR EACH ROW
    EXECUTE FUNCTION adscenter.update_sync_status_on_performance();

-- ========================================
-- 创建视图
-- ========================================

-- 广告账户详细信息视图
CREATE OR REPLACE VIEW adscenter.account_details AS
SELECT
    ac.id,
    ac.user_id,
    ac.platform,
    ac.platform_account_id,
    ac.platform_account_name,
    ac.status,
    ac.sync_status,
    ac.last_sync,
    ac.permissions,
    u.email as user_email,
    u.name as user_name,
    -- 活动统计
    c.total_campaigns,
    c.active_campaigns,
    c.paused_campaigns,
    c.total_spend_cents,
    c.last_campaign_activity,
    -- 性能汇总
    p.total_impressions,
    p.total_clicks,
    p.total_conversions,
    p.total_cost_cents,
    p.avg_ctr,
    p.avg_cpc_cents,
    p.avg_conversion_rate,
    ac.created_at,
    ac.updated_at
FROM adscenter.account_connections ac
LEFT JOIN "user".users u ON ac.user_id = u.id
LEFT JOIN (
    SELECT
        account_connection_id,
        COUNT(*) as total_campaigns,
        COUNT(CASE WHEN status = 'enabled' THEN 1 END) as active_campaigns,
        COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_campaigns,
        COALESCE(SUM(CAST(budget_amount_cents AS BIGINT)), 0) as total_spend_cents,
        MAX(updated_at) as last_campaign_activity
    FROM adscenter.campaigns
    GROUP BY account_connection_id
) c ON ac.id = c.account_connection_id
LEFT JOIN (
    SELECT
        account_connection_id,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(cost_cents) as total_cost_cents,
        CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(clicks)::NUMERIC / SUM(impressions), 4) ELSE 0 END as avg_ctr,
        CASE WHEN SUM(clicks) > 0 THEN ROUND(SUM(cost_cents)::NUMERIC / SUM(clicks), 2) ELSE 0 END as avg_cpc_cents,
        CASE WHEN SUM(clicks) > 0 THEN ROUND(SUM(conversions)::NUMERIC / SUM(clicks), 4) ELSE 0 END as avg_conversion_rate
    FROM adscenter.performance_data
    GROUP BY account_connection_id
) p ON ac.id = p.account_connection_id;

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
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'adscenter') THEN
        RAISE NOTICE '✅ adscenter schema created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create adscenter schema';
    END IF;
END $$;

