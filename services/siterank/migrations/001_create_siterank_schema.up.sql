-- ========================================
-- Google-Monetize 数据库迁移: Siterank Schema
-- Layer 3: 业务域层 - 网站评估和分析
-- 迁移ID: 000001
-- 版本: v2.0 (优化版)
-- 创建时间: 2025-10-21
-- 优化时间: 2025-10-22
-- 优先级: P1修复 - 外键约束和UUID类型
-- ========================================
--
-- 优化内容:
-- ✅ 修复offer_id类型不匹配 (TEXT → UUID)
-- ✅ 添加缺失的外键约束
--    - analyses.offer_id → offer.offers(id)
--    - analyses.user_id → user.users(id)
-- ✅ Layer 3依赖: 需要先创建 user.users (Layer 2) 和 offer.offers (Layer 3)
--
-- Execution: Cloud Run Job + Cloud SQL Proxy (Unix Socket)
-- Trigger: GitHub Actions database-migration-cloudrun.yml
-- ========================================

-- ============================================================================
-- 1. Siterank Schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS siterank;

-- 网站评估分析表
CREATE TABLE IF NOT EXISTS siterank.analyses (
    id TEXT PRIMARY KEY,
    offer_id UUID NOT NULL REFERENCES offer.offers(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES "user".users(id) ON DELETE CASCADE,

    -- 分析状态
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,

    -- 评分结果
    score NUMERIC(5,2),
    confidence NUMERIC(3,2),

    -- 分析详情
    analysis_model TEXT,
    analysis_depth TEXT DEFAULT 'standard',
    factors JSONB DEFAULT '{}',

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- 扩展字段
    metadata JSONB DEFAULT '{}'
);

-- 网站基础信息表
CREATE TABLE IF NOT EXISTS siterank.website_info (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,

    -- 基础信息
    title TEXT,
    description TEXT,
    language TEXT DEFAULT 'en',
    country TEXT,

    -- 技术信息
    ssl_status TEXT,
    page_speed NUMERIC(5,2),
    mobile_friendly BOOLEAN DEFAULT false,

    -- 内容分析
    content_categories TEXT[],
    estimated_traffic TEXT,
    authority_score NUMERIC(5,2),

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_analyzed_at TIMESTAMPTZ
);

-- 网站评估汇总表
CREATE TABLE IF NOT EXISTS siterank.evaluation_aggregations (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,

    -- 汇总统计
    total_analyses INTEGER DEFAULT 0,
    successful_analyses INTEGER DEFAULT 0,
    avg_score NUMERIC(5,2),
    avg_confidence NUMERIC(3,2),

    -- 最新结果
    latest_analysis_id TEXT,
    latest_score NUMERIC(5,2),
    latest_confidence NUMERIC(3,2),

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_analyzed_at TIMESTAMPTZ
);

-- 网站信息缓存表
CREATE TABLE IF NOT EXISTS siterank.website_info_cache (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,

    -- 缓存数据
    cache_data JSONB NOT NULL,
    cache_source TEXT NOT NULL,
    cache_version INTEGER DEFAULT 1,

    -- 缓存管理
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ,

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 域名缓存表（向后兼容，建议使用website_info_cache）
CREATE TABLE IF NOT EXISTS siterank.domain_cache (
    domain TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================================================
-- 2. 索引优化
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_analyses_offer_id ON siterank.analyses(offer_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON siterank.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON siterank.analyses(status);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON siterank.analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_info_domain ON siterank.website_info(domain);
CREATE INDEX IF NOT EXISTS idx_evaluation_aggregations_domain ON siterank.evaluation_aggregations(domain);
CREATE INDEX IF NOT EXISTS idx_evaluation_aggregations_score ON siterank.evaluation_aggregations(avg_score DESC);
CREATE INDEX IF NOT EXISTS idx_website_info_cache_domain ON siterank.website_info_cache(domain);
CREATE INDEX IF NOT EXISTS idx_website_info_cache_expires_at ON siterank.website_info_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_domain_cache_expires_at ON siterank.domain_cache(expires_at);

-- ============================================================================
-- 3. 触发器和函数
-- ============================================================================

-- 更新updated_at字段的触发器函数
CREATE OR REPLACE FUNCTION siterank.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有主要表添加updated_at触发器
CREATE TRIGGER update_analyses_updated_at
    BEFORE UPDATE ON siterank.analyses
    FOR EACH ROW EXECUTE FUNCTION siterank.update_updated_at_column();

CREATE TRIGGER update_website_info_updated_at
    BEFORE UPDATE ON siterank.website_info
    FOR EACH ROW EXECUTE FUNCTION siterank.update_updated_at_column();

CREATE TRIGGER update_evaluation_aggregations_updated_at
    BEFORE UPDATE ON siterank.evaluation_aggregations
    FOR EACH ROW EXECUTE FUNCTION siterank.update_updated_at_column();

CREATE TRIGGER update_website_info_cache_updated_at
    BEFORE UPDATE ON siterank.website_info_cache
    FOR EACH ROW EXECUTE FUNCTION siterank.update_updated_at_column();

-- ============================================================================
-- 4. 表注释
-- ============================================================================

COMMENT ON SCHEMA siterank IS '网站评估域：管理网站分析和评估';

COMMENT ON TABLE siterank.analyses IS '网站评估分析表';
COMMENT ON TABLE siterank.website_info IS '网站基础信息表';
COMMENT ON TABLE siterank.evaluation_aggregations IS '网站评估汇总统计';
COMMENT ON TABLE siterank.website_info_cache IS '网站信息缓存';
COMMENT ON TABLE siterank.domain_cache IS '域名缓存表（向后兼容，建议使用website_info_cache）';
