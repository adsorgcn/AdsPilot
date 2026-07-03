-- Migration: Create console schema metadata tables
-- Date: 2025-10-21
-- Description: Console管理域 - 系统元数据、域映射和配置管理

-- ============================================================================
-- Console Schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS console;

-- 系统元数据表
CREATE TABLE IF NOT EXISTS console.system_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 数据域映射表
CREATE TABLE IF NOT EXISTS console.domain_mappings (
    domain_name TEXT PRIMARY KEY,
    schema_name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,

    -- 域关系
    parent_domain TEXT REFERENCES console.domain_mappings(domain_name),

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 索引
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_domain_mappings_schema ON console.domain_mappings(schema_name);
CREATE INDEX IF NOT EXISTS idx_domain_mappings_active ON console.domain_mappings(is_active);
CREATE INDEX IF NOT EXISTS idx_system_metadata_key ON console.system_metadata(key);
CREATE INDEX IF NOT EXISTS idx_system_metadata_created_at ON console.system_metadata(created_at);

-- ============================================================================
-- 触发器
-- ============================================================================

-- 更新updated_at字段的触发器函数
CREATE OR REPLACE FUNCTION console.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_domain_mappings_updated_at
    BEFORE UPDATE ON console.domain_mappings
    FOR EACH ROW EXECUTE FUNCTION console.update_updated_at_column();

CREATE TRIGGER update_system_metadata_updated_at
    BEFORE UPDATE ON console.system_metadata
    FOR EACH ROW EXECUTE FUNCTION console.update_updated_at_column();

-- ============================================================================
-- 初始化数据
-- ============================================================================

-- 插入系统元数据记录
INSERT INTO console.system_metadata (key, value, description) VALUES
('database_version', 'v2.1', 'Database architecture version with 1:1 service-schema mapping'),
('business_domains', 'billing,offers,siterank,adscenter,useractivity,console', 'Active business domains'),
('data_isolation', 'enabled', 'Data isolation by business domain'),
('schema_created_at', NOW()::TEXT, 'Schema creation timestamp')
ON CONFLICT (key) DO NOTHING;

-- 插入业务域映射
INSERT INTO console.domain_mappings (domain_name, schema_name, description) VALUES
('billing', 'billing', '用户计费、订阅和代币管理域'),
('offers', 'offers', 'Offer管理和广告投放域'),
('siterank', 'siterank', '网站评估和分析域'),
('adscenter', 'adscenter', 'Google Ads集成和账户管理域'),
('useractivity', 'useractivity', '用户活动、签到和推荐域'),
('console', 'console', 'Console管理后台、系统配置和审计日志域')
ON CONFLICT (domain_name) DO NOTHING;

-- ============================================================================
-- 表注释
-- ============================================================================

COMMENT ON SCHEMA console IS 'Console管理域：管理元数据、域映射、系统配置和审计日志';
COMMENT ON TABLE console.system_metadata IS '系统元数据表 - 存储系统级配置和信息';
COMMENT ON TABLE console.domain_mappings IS '数据域映射表 - 用于跨域查询优化';
