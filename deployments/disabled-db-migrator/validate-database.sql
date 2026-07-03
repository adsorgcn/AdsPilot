-- 数据库验证脚本 - 策略B
-- 验证迁移后的数据库状态

-- ============================================================================
-- 第一步：验证所有Schema存在
-- ============================================================================

DO $$
DECLARE
    required_schemas TEXT[] := ARRAY['billing', 'offers', 'adscenter', 'siterank', 'useractivity', 'console'];
    schema_name TEXT;
    missing_count INTEGER := 0;
BEGIN
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '验证Schema';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    FOREACH schema_name IN ARRAY required_schemas
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.schemata 
            WHERE schema_name = schema_name
        ) THEN
            RAISE NOTICE '✅ Schema存在: %', schema_name;
        ELSE
            RAISE WARNING '❌ Schema缺失: %', schema_name;
            missing_count := missing_count + 1;
        END IF;
    END LOOP;
    
    IF missing_count = 0 THEN
        RAISE NOTICE '✅ 所有必需Schema验证通过';
    ELSE
        RAISE WARNING '❌ % 个Schema缺失', missing_count;
    END IF;
END $$;

-- ============================================================================
-- 第二步：统计每个Schema的表数量
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '表统计';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

SELECT 
    schemaname as "Schema",
    COUNT(*) as "表数量"
FROM pg_catalog.pg_tables 
WHERE schemaname IN ('billing', 'offers', 'adscenter', 'siterank', 'useractivity', 'console')
GROUP BY schemaname
ORDER BY schemaname;

-- ============================================================================
-- 第三步：验证关键表存在
-- ============================================================================

DO $$
DECLARE
    key_tables TEXT[][] := ARRAY[
        ARRAY['billing', 'users'],
        ARRAY['billing', 'subscriptions'],
        ARRAY['billing', 'subscription_plans'],
        ARRAY['offers', 'offers'],
        ARRAY['offers', 'offer_evaluations'],
        ARRAY['adscenter', 'ad_accounts'],
        ARRAY['adscenter', 'campaigns'],
        ARRAY['siterank', 'sites'],
        ARRAY['useractivity', 'user_activities']
    ];
    table_info TEXT[];
    missing_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '验证关键表';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    FOREACH table_info SLICE 1 IN ARRAY key_tables
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = table_info[1] 
            AND table_name = table_info[2]
        ) THEN
            RAISE NOTICE '✅ 表存在: %.%', table_info[1], table_info[2];
        ELSE
            RAISE WARNING '❌ 表缺失: %.%', table_info[1], table_info[2];
            missing_count := missing_count + 1;
        END IF;
    END LOOP;
    
    IF missing_count = 0 THEN
        RAISE NOTICE '✅ 所有关键表验证通过';
    ELSE
        RAISE WARNING '❌ % 个关键表缺失', missing_count;
    END IF;
END $$;

-- ============================================================================
-- 第四步：验证索引
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '索引统计';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

SELECT 
    schemaname as "Schema",
    COUNT(*) as "索引数量"
FROM pg_indexes
WHERE schemaname IN ('billing', 'offers', 'adscenter', 'siterank', 'useractivity', 'console')
GROUP BY schemaname
ORDER BY schemaname;

-- ============================================================================
-- 第五步：验证外键约束
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '外键约束统计';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

SELECT 
    tc.table_schema as "Schema",
    COUNT(*) as "外键数量"
FROM information_schema.table_constraints AS tc 
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema IN ('billing', 'offers', 'adscenter', 'siterank', 'useractivity', 'console')
GROUP BY tc.table_schema
ORDER BY tc.table_schema;

-- ============================================================================
-- 第六步：验证迁移版本
-- ============================================================================

DO $$
DECLARE
    migration_count INTEGER;
    dirty_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '迁移版本状态';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    SELECT COUNT(*), SUM(CASE WHEN dirty THEN 1 ELSE 0 END)
    INTO migration_count, dirty_count
    FROM schema_migrations;
    
    RAISE NOTICE '总迁移数: %', migration_count;
    RAISE NOTICE '脏迁移数: %', COALESCE(dirty_count, 0);
    
    IF COALESCE(dirty_count, 0) = 0 THEN
        RAISE NOTICE '✅ 没有脏迁移';
    ELSE
        RAISE WARNING '❌ 存在 % 个脏迁移', dirty_count;
    END IF;
END $$;

-- 显示迁移版本详情
SELECT 
    version as "版本号",
    CASE WHEN dirty THEN '❌ 脏' ELSE '✅ 正常' END as "状态"
FROM schema_migrations 
ORDER BY version;

-- ============================================================================
-- 第七步：测试基本CRUD操作
-- ============================================================================

DO $$
DECLARE
    test_user_id UUID;
    test_passed BOOLEAN := true;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '测试基本CRUD操作';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
    -- 测试插入
    BEGIN
        INSERT INTO billing.users (
            id, email, username, password_hash, 
            email_verified, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), 
            'test_validation@example.com',
            'test_validation_user',
            'test_hash',
            false,
            NOW(),
            NOW()
        ) RETURNING id INTO test_user_id;
        
        RAISE NOTICE '✅ INSERT测试通过';
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ INSERT测试失败: %', SQLERRM;
        test_passed := false;
    END;
    
    -- 测试查询
    IF test_passed THEN
        BEGIN
            PERFORM * FROM billing.users WHERE id = test_user_id;
            RAISE NOTICE '✅ SELECT测试通过';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ SELECT测试失败: %', SQLERRM;
            test_passed := false;
        END;
    END IF;
    
    -- 测试更新
    IF test_passed THEN
        BEGIN
            UPDATE billing.users 
            SET email_verified = true 
            WHERE id = test_user_id;
            RAISE NOTICE '✅ UPDATE测试通过';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ UPDATE测试失败: %', SQLERRM;
            test_passed := false;
        END;
    END IF;
    
    -- 测试删除
    IF test_passed THEN
        BEGIN
            DELETE FROM billing.users WHERE id = test_user_id;
            RAISE NOTICE '✅ DELETE测试通过';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '❌ DELETE测试失败: %', SQLERRM;
            test_passed := false;
        END;
    END IF;
    
    IF test_passed THEN
        RAISE NOTICE '✅ 所有CRUD操作测试通过';
    ELSE
        RAISE WARNING '❌ 部分CRUD操作测试失败';
    END IF;
END $$;

-- ============================================================================
-- 第八步：数据库健康检查
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '数据库健康检查';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- 数据库大小
SELECT 
    '数据库大小' as "指标",
    pg_size_pretty(pg_database_size('gm_db')) as "值";

-- 连接数
SELECT 
    '活动连接数' as "指标",
    COUNT(*)::TEXT as "值"
FROM pg_stat_activity 
WHERE datname = 'gm_db';

-- 表总数
SELECT 
    '表总数' as "指标",
    COUNT(*)::TEXT as "值"
FROM information_schema.tables 
WHERE table_schema NOT IN ('pg_catalog', 'information_schema');

-- 索引总数
SELECT 
    '索引总数' as "指标",
    COUNT(*)::TEXT as "值"
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');

-- ============================================================================
-- 最终总结
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '验证完成';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '请检查上述输出，确保所有验证项都通过';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
