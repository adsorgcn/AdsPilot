-- ========================================
-- Google-Monetize Supabase 数据库优化脚本
-- 目标：将Supabase精简为纯认证数据库，清理所有业务数据
-- 执行前请确保已备份重要数据
-- ========================================

-- 开始事务
BEGIN;

-- ========================================
-- 第一阶段：分析当前状态
-- ========================================

-- 创建分析结果临时表
CREATE TEMP TABLE IF NOT EXISTS optimization_analysis AS
SELECT
    'current_state' as phase,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = schemaname AND table_name = tablename) as column_count
FROM pg_tables
WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 显示当前状态
SELECT '=== 当前Supabase数据库状态分析 ===' as info;
SELECT * FROM optimization_analysis;

-- ========================================
-- 第二阶段：清理业务数据表
-- 根据优化报告，以下表需要删除（已迁移到Cloud SQL）
-- ========================================

SELECT '=== 开始清理业务数据表 ===' as info;

-- 业务数据表 - 已迁移到Cloud SQL对应schema
DROP TABLE IF EXISTS public.offers CASCADE;
DROP TABLE IF EXISTS public.ads_connections CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.token_reservations CASCADE;
DROP TABLE IF EXISTS public.user_activities CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.url_visit_results CASCADE;
DROP TABLE IF EXISTS public.checkins CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.trials CASCADE;
DROP TABLE IF EXISTS public.offer_evaluations CASCADE;
DROP TABLE IF EXISTS public.offer_preferences_favorite CASCADE;

-- 管理域表 - 已迁移到Cloud SQL console schema
DROP TABLE IF EXISTS public.feature_flags CASCADE;
DROP TABLE IF EXISTS public.feature_flag_history CASCADE;
DROP TABLE IF EXISTS public.admin_recovery_codes CASCADE;
DROP TABLE IF EXISTS public.critical_admin_actions CASCADE;
DROP TABLE IF EXISTS public.database_health_stats CASCADE;
DROP TABLE IF EXISTS public.monitoring_dashboard CASCADE;
DROP TABLE IF EXISTS public.export_history CASCADE;
DROP TABLE IF EXISTS public.notification_templates CASCADE;
DROP TABLE IF EXISTS public.notification_broadcasts CASCADE;
DROP TABLE IF EXISTS public.nps_feedback CASCADE;
DROP TABLE IF EXISTS public.system_metadata CASCADE;

-- 视图和函数
DROP VIEW IF EXISTS public.user_complete_info CASCADE;
DROP VIEW IF EXISTS public.user_stats CASCADE;
DROP FUNCTION IF EXISTS public.get_user_stats(TEXT) CASCADE;

-- ========================================
-- 第三阶段：保留认证相关表和最小配置
-- ========================================

SELECT '=== 保留和优化认证相关表 ===' as info;

-- 保留auth.users（Supabase自动管理，无需操作）
-- 保留auth.identities（Supabase自动管理，无需操作）

-- 创建最小化的用户资料视图
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
    id::text as user_id,
    raw_user_meta_data->>'email' as email,
    raw_user_meta_data->>'name' as display_name,
    raw_user_meta_data->>'picture' as photo_url,
    raw_user_meta_data->>'locale' as locale,
    created_at,
    updated_at,
    last_sign_in_at,
    email_confirmed_at,
    phone_confirmed_at
FROM auth.users
WHERE email_confirmed_at IS NOT NULL;

-- 为用户资料视图创建RLS策略
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的资料
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid()::text = user_id);

-- ========================================
-- 第四阶段：创建系统配置表（最小化）
-- ========================================

SELECT '=== 创建最小化系统配置 ===' as info;

-- 系统配置表（仅Supabase层面设置）
CREATE TABLE IF NOT EXISTS public.supabase_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 为系统配置表创建RLS策略
ALTER TABLE public.supabase_config ENABLE ROW LEVEL SECURITY;

-- 只有超级管理员可以操作
CREATE POLICY "Admins can manage config" ON public.supabase_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.uid()::text = raw_user_meta_data->>'email'
            AND raw_user_meta_data->>'role' = 'super_admin'
        )
    );

-- ========================================
-- 第五阶段：清理索引和优化
-- ========================================

SELECT '=== 清理无用索引和优化 ===' as info;

-- 删除业务表的索引（如果还有残留）
DROP INDEX IF EXISTS idx_offers_user_id;
DROP INDEX IF EXISTS idx_offers_created_at;
DROP INDEX IF EXISTS idx_subscriptions_user_id;
DROP INDEX IF EXISTS idx_user_activities_user_id;
DROP INDEX IF EXISTS idx_user_activities_created_at;
DROP INDEX IF EXISTS idx_ads_connections_user_id;

-- ========================================
-- 第六阶段：验证优化结果
-- ========================================

SELECT '=== 验证优化结果 ===' as info;

-- 创建优化结果对比表
CREATE TEMP TABLE IF NOT EXISTS optimization_results AS
SELECT
    'post_optimization' as phase,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 显示优化后的状态
SELECT * FROM optimization_results;

-- 提交事务
COMMIT;

-- ========================================
-- 最终验证报告
-- ========================================

SELECT '=== Supabase优化完成报告 ===' as info;

SELECT
    'Supabase已优化为纯认证数据库' as status,
    '所有业务数据已迁移到Cloud SQL' as migration_status,
    '仅保留认证相关表和最小配置' as optimization_result,
    'RLS策略已重新配置' as security_status;

-- 显示保留的表
SELECT
    '保留的表:' as info,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY schemaname, tablename;

SELECT '✅ Supabase数据库优化完成！' as success_message;