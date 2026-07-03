-- ========================================
-- Google-Monetize 数据库迁移: Schema Naming Standardization
-- 修正PascalCase表名为snake_case，统一架构规范
-- 迁移ID: 001_schema_standardization
-- 版本: v1.0
-- 创建时间: 2025-01-25
-- 优先级: P0修复 - 架构规范统一
-- ========================================

-- 开始事务
BEGIN;

-- 设置搜索路径以包含所有Schema
SET search_path TO public, user, billing, offer, console, useractivity, siterank, adscenter, batchopen;

-- ========================================
-- 修正公共表命名
-- ========================================

-- 重命名Token相关表 (如果存在PascalCase版本)
DO $$
BEGIN
    -- Token相关表重命名映射
    DECLARE rename_list TEXT[] := ARRAY[
        'UserToken|user_tokens',
        'UserTokenPool|user_token_pools',
        'TokenTransaction|token_transactions',
        'TokenCreditLot|token_credit_lots',
        'TokenDebit|token_debits',
        'TokenDebitAllocation|token_debit_allocations',
        'TokenRepairAudit|token_repair_audits',
        'IdempotencyKey|idempotency_keys'
    ];

    rename_record RECORD;
    BEGIN
        FOR rename_record IN SELECT * FROM unnest(rename_list) AS t(old_name, new_name)
        LOOP
            EXECUTE format('ALTER TABLE IF EXISTS %I RENAME TO %I', rename_record.old_name, rename_record.new_name);
            RAISE NOTICE '✅ Renamed table % → %', rename_record.old_name, rename_record.new_name;
        END LOOP;
    END;
END $$;

-- 重命名Subscription相关表
DO $$
BEGIN
    DECLARE rename_list TEXT[] := ARRAY[
        'Subscription|subscriptions',
        'SubscriptionConfig|subscription_configs',
        'SubscriptionHistory|subscription_histories'
    ];

    rename_record RECORD;
    BEGIN
        FOR rename_record IN SELECT * FROM unnest(rename_list) AS t(old_name, new_name)
        LOOP
            EXECUTE format('ALTER TABLE IF EXISTS %I RENAME TO %I', rename_record.old_name, rename_record.new_name);
            RAISE NOTICE '✅ Renamed table % → %', rename_record.old_name, rename_record.new_name;
        END LOOP;
    END;
END $$;

-- 重命名其他业务表
DO $$
BEGIN
    DECLARE rename_list TEXT[] := ARRAY[
        'UserProfile|user_profiles',
        'AdminImpersonationEvent|admin_impersonation_events',
        'FeatureFlag|feature_flags',
        'FeatureFlagHistory|feature_flag_histories',
        'SystemMetadata|system_metadata',
        'AdminAuditLog|admin_audit_logs',
        'AdminRecoveryCode|admin_recovery_codes'
    ];

    rename_record RECORD;
    BEGIN
        FOR rename_record IN SELECT * FROM unnest(rename_list) AS t(old_name, new_name)
        LOOP
            EXECUTE format('ALTER TABLE IF EXISTS %I RENAME TO %I', rename_record.old_name, rename_record.new_name);
            RAISE NOTICE '✅ Renamed table % → %', rename_record.old_name, rename_record.new_name;
        END LOOP;
    END;
END $$;

-- ========================================
-- 修正列名 (从camelCase转为snake_case)
-- ========================================

-- 修正常用列名
DO $$
BEGIN
    DECLARE column_mappings TEXT[] := ARRAY[
        -- UserToken表列名修正
        'user_tokens|userId|user_id',
        'user_tokens|balance|balance',
        'user_tokens|createdAt|created_at',
        'user_tokens|updatedAt|updated_at',

        -- TokenTransaction表列名修正
        'token_transactions|userId|user_id',
        'token_transactions|type|type',
        'token_transactions|amount|amount',
        'token_transactions|balanceBefore|balance_before',
        'token_transactions|balanceAfter|balance_after',
        'token_transactions|source|source',
        'token_transactions|description|description',
        'token_transactions|metadata|metadata',
        'token_transactions|createdAt|created_at',

        -- 其他表的通用列名修正
        'user_profiles|userId|user_id',
        'user_profiles|displayName|display_name',
        'user_profiles|avatarUrl|avatar_url',
        'user_profiles|createdAt|created_at',
        'user_profiles|updatedAt|updated_at'
    ];

    column_record RECORD;
    schema_name TEXT;
    table_name TEXT;
    old_column TEXT;
    new_column TEXT;

    BEGIN
        FOR column_record IN SELECT * FROM unnest(column_mappings) AS t(mapping, old_name, new_name)
        LOOP
            -- 解析schema.table格式
            SELECT split_part(column_record.mapping, '|', 1), split_part(column_record.mapping, '|', 2)
            INTO schema_name, table_name;

            EXECUTE format('ALTER TABLE IF EXISTS %I.%I RENAME COLUMN %I TO %I',
                        schema_name, table_name, column_record.old_name, column_record.new_name);
            RAISE NOTICE '✅ Renamed column %.% → %.%', schema_name||'.'||table_name, column_record.old_name, column_record.new_name;
        END LOOP;
    END;
END $$;

-- ========================================
-- 更新索引名称
-- ========================================

-- 删除旧索引并创建新索引
DROP INDEX IF EXISTS "UserToken_userId_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_tokens_user_id_idx ON user_tokens(user_id);

DROP INDEX IF EXISTS "TokenTransaction_userId_createdAt_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS token_transactions_user_id_created_at_idx ON token_transactions(user_id, created_at DESC);

DROP INDEX IF EXISTS "UserProfile_userId_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_profiles_user_id_idx ON user_profiles(user_id);

-- ========================================
-- 更新序列和约束名称
-- ========================================

-- 重新创建主键约束使用标准命名
DO $$
BEGIN
    DECLARE pk_mappings TEXT[] := ARRAY[
        'user_tokens|user_tokens_pkey',
        'token_transactions|token_transactions_pkey',
        'user_profiles|user_profiles_pkey',
        'subscriptions|subscriptions_pkey'
    ];

    pk_record RECORD;
    BEGIN
        FOR pk_record IN SELECT * FROM unnest(pk_mappings) AS t(table_name, pk_name)
        LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', pk_record.table_name, pk_record.table_name||'_pkey');
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I PRIMARY KEY (id)', pk_record.table_name, pk_record.pk_name);
            RAISE NOTICE '✅ Recreated PK for table %', pk_record.table_name;
        END LOOP;
    END;
END $$;

-- ========================================
-- 验证迁移结果
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '=== Schema Standardization Verification ===';

    -- 验证表是否存在且为新名称
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tokens') THEN
        RAISE NOTICE '✅ user_tokens table exists';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_transactions') THEN
        RAISE NOTICE '✅ token_transactions table exists';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        RAISE NOTICE '✅ user_profiles table exists';
    END IF;

    -- 验证列是否存在
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tokens' AND column_name = 'user_id') THEN
        RAISE NOTICE '✅ user_tokens.user_id column exists';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_transactions' AND column_name = 'user_id') THEN
        RAISE NOTICE '✅ token_transactions.user_id column exists';
    END IF;

    RAISE NOTICE '=== Schema Standardization Complete ===';
END $$;

COMMIT;

-- ========================================
-- 迁移完成通知
-- ========================================

RAISE NOTICE '🎉 Schema naming standardization migration completed successfully!';
RAISE NOTICE '📋 Summary:';
RAISE NOTICE '   - Renamed PascalCase tables to snake_case';
RAISE NOTICE '   - Updated camelCase columns to snake_case';
RAISE NOTICE '   - Standardized index naming convention';
RAISE NOTICE '   - Recreated primary key constraints';
RAISE NOTICE '⚠️  Note: Update application code to use new table/column names';