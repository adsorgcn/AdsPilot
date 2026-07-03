-- ========================================
-- Google-Monetize 数据库回滚: UserActivity Schema Initialization
-- 回滚用户活动域 Schema
-- 迁移ID: 001
-- 版本: v2.0
-- ========================================

-- 开始事务
BEGIN;

-- 删除视图
DROP VIEW IF EXISTS useractivity.retention_analysis;
DROP VIEW IF EXISTS useractivity.daily_activity_trends;
DROP VIEW IF EXISTS useractivity.user_activity_summary;

-- 删除触发器
DROP TRIGGER IF EXISTS update_session_activity_trigger ON useractivity.user_sessions;
DROP TRIGGER IF EXISTS update_engagement_metrics_trigger ON useractivity.user_activities;
DROP TRIGGER IF EXISTS update_user_retention_metrics_updated_at ON useractivity.user_retention_metrics;
DROP TRIGGER IF EXISTS update_user_behavior_patterns_updated_at ON useractivity.user_behavior_patterns;
DROP TRIGGER IF EXISTS update_user_engagement_metrics_updated_at ON useractivity.user_engagement_metrics;

-- 删除函数
DROP FUNCTION IF EXISTS useractivity.update_session_activity();
DROP FUNCTION IF EXISTS useractivity.update_engagement_metrics();
DROP FUNCTION IF EXISTS useractivity.update_updated_at_column();

-- 删除表（按依赖关系逆序）
DROP TABLE IF EXISTS useractivity.user_retention_metrics;
DROP TABLE IF EXISTS useractivity.user_behavior_patterns;
DROP TABLE IF EXISTS useractivity.user_sessions;
DROP TABLE IF EXISTS useractivity.user_engagement_metrics;
DROP TABLE IF EXISTS useractivity.user_activities;

-- 删除Schema
DROP SCHEMA IF EXISTS useractivity;

-- 提交事务
COMMIT;

-- 验证回滚结果
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'useractivity') THEN
        RAISE NOTICE '✅ useractivity schema dropped successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to drop useractivity schema';
    END IF;
END $$;

