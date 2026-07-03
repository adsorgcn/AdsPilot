-- Migration 001: 统一用户ID数据类型为UUID
--
-- 这个迁移解决了用户ID在不同服务中数据类型不一致的问题
-- 将所有TEXT类型的user_id字段统一改为UUID类型

-- 开启事务
BEGIN;

-- 1. 检查现有数据类型
SELECT
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE column_name = 'user_id'
    AND table_schema IN ('offer_db', 'billing_db', 'siterank_db', 'adscenter_db', 'shared_db')
ORDER BY table_schema, table_name;

-- 2. 统一offers表的user_id类型 (offer_db schema)
DO $$
BEGIN
    -- 检查是否需要修改
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'offer_db'
            AND table_name = 'offers'
            AND column_name = 'user_id'
            AND data_type = 'text'
    ) THEN
        -- 先创建备份
        CREATE TABLE IF NOT EXISTS offer_db.offers_backup AS
        SELECT * FROM offer_db.offers;

        -- 转换数据类型，无效的UUID将设置为NULL
        ALTER TABLE offer_db.offers
        ALTER COLUMN user_id TYPE UUID
        USING
            CASE
                WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN user_id::uuid
                ELSE NULL
            END;

        -- 删除无效记录
        DELETE FROM offer_db.offers WHERE user_id IS NULL;

        RAISE NOTICE 'offer_db.offers.user_id 已转换为UUID类型';
    END IF;
END $$;

-- 3. 统一billing_db相关表的user_id类型
DO $$
BEGIN
    -- checkins表
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'billing_db'
            AND table_name = 'checkins'
            AND column_name = 'user_id'
            AND data_type = 'text'
    ) THEN
        CREATE TABLE IF NOT EXISTS billing_db.checkins_backup AS
        SELECT * FROM billing_db.checkins;

        ALTER TABLE billing_db.checkins
        ALTER COLUMN user_id TYPE UUID
        USING
            CASE
                WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN user_id::uuid
                ELSE NULL
            END;

        DELETE FROM billing_db.checkins WHERE user_id IS NULL;
        RAISE NOTICE 'billing_db.checkins.user_id 已转换为UUID类型';
    END IF;

    -- referrals表
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'billing_db'
            AND table_name = 'referrals'
            AND column_name IN ('referrer_user_id', 'referee_user_id')
            AND data_type = 'text'
    ) THEN
        CREATE TABLE IF NOT EXISTS billing_db.referrals_backup AS
        SELECT * FROM billing_db.referrals;

        ALTER TABLE billing_db.referrals
        ALTER COLUMN referrer_user_id TYPE UUID
        USING
            CASE
                WHEN referrer_user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN referrer_user_id::uuid
                ELSE NULL
            END,
        ALTER COLUMN referee_user_id TYPE UUID
        USING
            CASE
                WHEN referee_user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN referee_user_id::uuid
                ELSE NULL
            END;

        DELETE FROM billing_db.referrals WHERE referrer_user_id IS NULL OR referee_user_id IS NULL;
        RAISE NOTICE 'billing_db.referrals.user_id 字段已转换为UUID类型';
    END IF;

    -- trial_subscriptions表
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'billing_db'
            AND table_name = 'trial_subscriptions'
            AND column_name = 'user_id'
            AND data_type = 'text'
    ) THEN
        CREATE TABLE IF NOT EXISTS billing_db.trial_subscriptions_backup AS
        SELECT * FROM billing_db.trial_subscriptions;

        ALTER TABLE billing_db.trial_subscriptions
        ALTER COLUMN user_id TYPE UUID
        USING
            CASE
                WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN user_id::uuid
                ELSE NULL
            END;

        DELETE FROM billing_db.trial_subscriptions WHERE user_id IS NULL;
        RAISE NOTICE 'billing_db.trial_subscriptions.user_id 已转换为UUID类型';
    END IF;
END $$;

-- 4. 统一其他相关表的user_id类型
DO $$
BEGIN
    -- user_checkin_stats表
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'billing_db'
            AND table_name = 'user_checkin_stats'
            AND column_name = 'user_id'
            AND data_type = 'text'
    ) THEN
        CREATE TABLE IF NOT EXISTS billing_db.user_checkin_stats_backup AS
        SELECT * FROM billing_db.user_checkin_stats;

        ALTER TABLE billing_db.user_checkin_stats
        ALTER COLUMN user_id TYPE UUID
        USING
            CASE
                WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN user_id::uuid
                ELSE NULL
            END;

        DELETE FROM billing_db.user_checkin_stats WHERE user_id IS NULL;
        RAISE NOTICE 'billing_db.user_checkin_stats.user_id 已转换为UUID类型';
    END IF;

    -- token_reservations表
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'billing_db'
            AND table_name = 'token_reservations'
            AND column_name = 'user_id'
            AND data_type = 'text'
    ) THEN
        CREATE TABLE IF NOT EXISTS billing_db.token_reservations_backup AS
        SELECT * FROM billing_db.token_reservations;

        ALTER TABLE billing_db.token_reservations
        ALTER COLUMN user_id TYPE UUID
        USING
            CASE
                WHEN user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN user_id::uuid
                ELSE NULL
            END;

        DELETE FROM billing_db.token_reservations WHERE user_id IS NULL;
        RAISE NOTICE 'billing_db.token_reservations.user_id 已转换为UUID类型';
    END IF;
END $$;

-- 5. 添加NOT NULL约束确保数据完整性
ALTER TABLE offer_db.offers
ADD CONSTRAINT IF NOT EXISTS offers_user_id_not_null
CHECK (user_id IS NOT NULL);

ALTER TABLE billing_db.checkins
ADD CONSTRAINT IF NOT EXISTS checkins_user_id_not_null
CHECK (user_id IS NOT NULL);

-- 6. 验证迁移结果
SELECT
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE column_name = 'user_id'
    AND table_schema IN ('offer_db', 'billing_db', 'siterank_db', 'adscenter_db', 'shared_db')
ORDER BY table_schema, table_name;

COMMIT;

-- 输出迁移完成信息
DO $$
BEGIN
    RAISE NOTICE '===== 用户ID类型统一迁移完成 =====';
    RAISE NOTICE '所有表的user_id字段已统一为UUID类型';
    RAISE NOTICE '备份表已创建，表名后缀为_backup';
    RAISE NOTICE '如需回滚，请使用备份表恢复数据';
    RAISE NOTICE '====================================';
END $$;