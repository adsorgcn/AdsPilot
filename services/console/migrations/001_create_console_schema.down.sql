-- ========================================
-- Google-Monetize 数据库回滚: Console Schema Initialization
-- 回滚管理控制台域 Schema
-- 迁移ID: 001
-- 版本: v2.0
-- ========================================

-- 开始事务
BEGIN;

-- 删除视图
DROP VIEW IF EXISTS console.system_config_overview;
DROP VIEW IF EXISTS console.export_activity_stats;
DROP VIEW IF EXISTS console.feature_flag_summary;
DROP VIEW IF EXISTS console.admin_activity_overview;

-- 删除触发器
DROP TRIGGER IF EXISTS update_metadata_access_time_trigger ON console.system_metadata;
DROP TRIGGER IF EXISTS log_feature_flag_change_trigger ON console.feature_flags;
DROP TRIGGER IF EXISTS update_system_metadata_updated_at ON console.system_metadata;
DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON console.feature_flags;
DROP TRIGGER IF EXISTS update_token_rules_updated_at ON console.token_rules;

-- 删除函数
DROP FUNCTION IF EXISTS console.update_metadata_access_time();
DROP FUNCTION IF EXISTS console.log_feature_flag_change();
DROP FUNCTION IF EXISTS console.update_updated_at_column();

-- 删除表（按依赖关系逆序）
DROP TABLE IF EXISTS console.system_metadata;
DROP TABLE IF EXISTS console.feature_flag_history;
DROP TABLE IF EXISTS console.feature_flags;
DROP TABLE IF EXISTS console.export_history;
DROP TABLE IF EXISTS console.admin_recovery_codes;
DROP TABLE IF EXISTS console.token_rules;
DROP TABLE IF EXISTS console.admin_audit_log;

-- 删除Schema
DROP SCHEMA IF EXISTS console;

-- 提交事务
COMMIT;

-- 验证回滚结果
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'console') THEN
        RAISE NOTICE '✅ console schema dropped successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to drop console schema';
    END IF;
END $$;

