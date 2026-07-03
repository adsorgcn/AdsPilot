-- 数据库重置脚本 - 策略B
-- 警告：此脚本会删除所有数据！
-- 执行前必须确保已创建备份

-- ============================================================================
-- 第一步：删除所有自定义Schema
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '开始删除自定义Schema...';
END $$;

-- 删除 billing schema
DROP SCHEMA IF EXISTS billing CASCADE;

-- 删除 offers schema
DROP SCHEMA IF EXISTS offers CASCADE;

-- 删除 adscenter schema
DROP SCHEMA IF EXISTS adscenter CASCADE;

-- 删除 siterank schema
DROP SCHEMA IF EXISTS siterank CASCADE;

-- 删除 useractivity schema
DROP SCHEMA IF EXISTS useractivity CASCADE;

-- 删除 system schema
DROP SCHEMA IF EXISTS system CASCADE;

-- 删除 console schema
DROP SCHEMA IF EXISTS console CASCADE;

DO $$
BEGIN
    RAISE NOTICE '所有自定义Schema已删除';
END $$;

-- ============================================================================
-- 第二步：清理public schema
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '开始清理public schema...';
END $$;

-- 删除并重建public schema
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- 恢复默认权限
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

DO $$
BEGIN
    RAISE NOTICE 'public schema已重置';
END $$;

-- ============================================================================
-- 第三步：重置迁移跟踪表
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '创建schema_migrations表...';
END $$;

-- 创建迁移跟踪表
CREATE TABLE IF NOT EXISTS schema_migrations (
    version bigint NOT NULL PRIMARY KEY,
    dirty boolean NOT NULL DEFAULT false
);

-- 添加注释
COMMENT ON TABLE schema_migrations IS '数据库迁移版本跟踪表';
COMMENT ON COLUMN schema_migrations.version IS '迁移版本号';
COMMENT ON COLUMN schema_migrations.dirty IS '迁移是否处于脏状态（失败）';

DO $$
BEGIN
    RAISE NOTICE 'schema_migrations表已创建';
END $$;

-- ============================================================================
-- 第四步：验证清理结果
-- ============================================================================

DO $$
DECLARE
    custom_schema_count INTEGER;
    public_table_count INTEGER;
BEGIN
    RAISE NOTICE '验证数据库清理状态...';
    
    -- 检查自定义schema数量
    SELECT COUNT(*) INTO custom_schema_count
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'public');
    
    -- 检查public schema中的表数量（应该只有schema_migrations）
    SELECT COUNT(*) INTO public_table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name != 'schema_migrations';
    
    RAISE NOTICE '自定义Schema数量: %', custom_schema_count;
    RAISE NOTICE 'public schema表数量（不含schema_migrations）: %', public_table_count;
    
    IF custom_schema_count > 0 THEN
        RAISE WARNING '仍存在自定义Schema，清理可能不完整';
    END IF;
    
    IF public_table_count > 0 THEN
        RAISE WARNING 'public schema中仍有其他表，清理可能不完整';
    END IF;
    
    IF custom_schema_count = 0 AND public_table_count = 0 THEN
        RAISE NOTICE '✅ 数据库清理完成，状态正常';
    END IF;
END $$;

-- ============================================================================
-- 第五步：输出最终状态
-- ============================================================================

-- 列出所有schema
SELECT 
    '当前Schema列表' as info,
    schema_name,
    CASE 
        WHEN schema_name IN ('pg_catalog', 'information_schema') THEN '系统Schema'
        WHEN schema_name = 'public' THEN '默认Schema'
        ELSE '自定义Schema'
    END as schema_type
FROM information_schema.schemata
ORDER BY schema_type, schema_name;

-- 列出所有表
SELECT 
    '当前表列表' as info,
    schemaname,
    tablename
FROM pg_catalog.pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;

-- 显示schema_migrations状态
SELECT 
    '迁移版本状态' as info,
    COALESCE(COUNT(*), 0) as migration_count,
    COALESCE(SUM(CASE WHEN dirty THEN 1 ELSE 0 END), 0) as dirty_count
FROM schema_migrations;

-- 完成消息
DO $$
BEGIN
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '数据库重置完成';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
