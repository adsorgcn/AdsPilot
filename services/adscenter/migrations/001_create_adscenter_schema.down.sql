-- ========================================
-- Google-Monetize 数据库回滚: Adscenter Schema
-- 回滚广告中心域 Schema
-- 迁移ID: 002
-- 版本: v2.0
-- ========================================

-- 开始事务
BEGIN;

-- 删除视图
DROP VIEW IF EXISTS adscenter.account_details;

-- 删除触发器
DROP TRIGGER IF EXISTS update_performance_sync_status_trigger ON adscenter.performance_data;
DROP TRIGGER IF EXISTS update_bulk_operation_progress_trigger ON adscenter.bulk_operations;
DROP TRIGGER IF EXISTS update_bidding_strategies_updated_at ON adscenter.bidding_strategies;
DROP TRIGGER IF EXISTS update_audiences_updated_at ON adscenter.audiences;
DROP TRIGGER IF EXISTS update_ad_creatives_updated_at ON adscenter.ad_creatives;
DROP TRIGGER IF EXISTS update_ad_groups_updated_at ON adscenter.ad_groups;
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON adscenter.campaigns;
DROP TRIGGER IF EXISTS update_account_connections_updated_at ON adscenter.account_connections;

-- 删除函数
DROP FUNCTION IF EXISTS adscenter.update_sync_status_on_performance();
DROP FUNCTION IF EXISTS adscenter.update_bulk_operation_progress();
DROP FUNCTION IF EXISTS adscenter.update_updated_at_column();

-- 删除表（按依赖关系逆序）
DROP TABLE IF EXISTS adscenter.bidding_strategies;
DROP TABLE IF EXISTS adscenter.audiences;
DROP TABLE IF EXISTS adscenter.keyword_performance;
DROP TABLE IF EXISTS adscenter.performance_data;
DROP TABLE IF EXISTS adscenter.bulk_operations;
DROP TABLE IF EXISTS adscenter.ad_creatives;
DROP TABLE IF EXISTS adscenter.ad_groups;
DROP TABLE IF EXISTS adscenter.campaigns;
DROP TABLE IF EXISTS adscenter.account_connections;

-- 删除Schema
DROP SCHEMA IF EXISTS adscenter;

-- 提交事务
COMMIT;

-- 验证回滚结果
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'adscenter') THEN
        RAISE NOTICE '✅ adscenter schema dropped successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to drop adscenter schema';
    END IF;
END $$;

