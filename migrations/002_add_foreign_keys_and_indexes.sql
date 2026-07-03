-- Migration 002: 完善数据库外键约束和索引
--
-- 这个迁移添加了缺失的外键约束和性能优化索引

BEGIN;

-- 1. 添加外键约束
DO $$
BEGIN
    -- offer_evaluations表的外键约束
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'offer_db'
            AND table_name = 'offer_evaluations'
            AND constraint_name = 'fk_offer_evaluations_offer'
    ) THEN
        ALTER TABLE offer_db.offer_evaluations
        ADD CONSTRAINT fk_offer_evaluations_offer
        FOREIGN KEY (offer_id) REFERENCES offer_db.offers(id)
        ON DELETE CASCADE;

        RAISE NOTICE '添加offer_evaluations.offer_id外键约束';
    END IF;

    -- offer_revenues表的外键约束
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'offer_db'
            AND table_name = 'offer_revenues'
            AND constraint_name = 'fk_offer_revenues_offer'
    ) THEN
        ALTER TABLE offer_db.offer_revenues
        ADD CONSTRAINT fk_offer_revenues_offer
        FOREIGN KEY (offer_id) REFERENCES offer_db.offers(id)
        ON DELETE CASCADE;

        RAISE NOTICE '添加offer_revenues.offer_id外键约束';
    END IF;
END $$;

-- 2. 添加复合索引优化查询性能
DO $$
BEGIN
    -- 用户Offer查询优化
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'offer_db'
            AND tablename = 'offers'
            AND indexname = 'idx_offers_user_status_date'
    ) THEN
        CREATE INDEX idx_offers_user_status_date
        ON offer_db.offers(user_id, status, created_at DESC);

        RAISE NOTICE '创建offers表复合索引: user_id, status, created_at';
    END IF;

    -- Offer评估查询优化
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'offer_db'
            AND tablename = 'offer_evaluations'
            AND indexname = 'idx_evaluations_offer_created'
    ) THEN
        CREATE INDEX idx_evaluations_offer_created
        ON offer_db.offer_evaluations(offer_id, created_at DESC);

        RAISE NOTICE '创建offer_evaluations表复合索引: offer_id, created_at';
    END IF;

    -- Billing查询优化
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'billing_db'
            AND tablename = 'checkins'
            AND indexname = 'idx_checkins_user_date'
    ) THEN
        CREATE INDEX idx_checkins_user_date
        ON billing_db.checkins(user_id, checkin_date DESC);

        RAISE NOTICE '创建checkins表复合索引: user_id, checkin_date';
    END IF;

    -- Token预留查询优化
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'billing_db'
            AND tablename = 'token_reservations'
            AND indexname = 'idx_token_reservations_user_status'
    ) THEN
        CREATE INDEX idx_token_reservations_user_status
        ON billing_db.token_reservations(user_id, status, created_at DESC);

        RAISE NOTICE '创建token_reservations表复合索引: user_id, status, created_at';
    END IF;
END $$;

-- 3. 添加JSONB字段的GIN索引
DO $$
BEGIN
    -- offer_evaluations的ai_recommendation_reasons字段索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'offer_db'
            AND tablename = 'offer_evaluations'
            AND indexname = 'idx_evaluations_ai_reasons_gin'
    ) THEN
        CREATE INDEX idx_evaluations_ai_reasons_gin
        ON offer_db.offer_evaluations USING GIN(ai_recommendation_reasons);

        RAISE NOTICE '创建offer_evaluations.ai_recommendation_reasons GIN索引';
    END IF;

    -- similarweb_global_cache的similarweb_data字段索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'siterank_db'
            AND tablename = 'similarweb_global_cache'
            AND indexname = 'idx_similarweb_cache_data_gin'
    ) THEN
        CREATE INDEX idx_similarweb_cache_data_gin
        ON siterank_db.similarweb_global_cache USING GIN(similarweb_data);

        RAISE NOTICE '创建similarweb_global_cache.similarweb_data GIN索引';
    END IF;
END $$;

-- 4. 添加业务约束
DO $$
BEGIN
    -- 确保ROAS为非负数
    ALTER TABLE offer_db.offers
    ADD CONSTRAINT IF NOT EXISTS chk_offers_roas_positive
    CHECK (roas >= 0);

    -- 确保CTR在有效范围内
    ALTER TABLE offer_db.offers
    ADD CONSTRAINT IF NOT EXISTS chk_offers_ctr_valid
    CHECK (ctr >= 0 AND ctr <= 1);

    -- 确保评分在有效范围内
    ALTER TABLE offer_db.offers
    ADD CONSTRAINT IF NOT EXISTS chk_offers_score_range
    CHECK (siterank_score >= 0 AND siterank_score <= 100);

    -- 确保每日签到记录唯一性
    ALTER TABLE billing_db.checkins
    ADD CONSTRAINT IF NOT EXISTS unique_user_checkin_date
    UNIQUE (user_id, checkin_date);

    -- 确保Token数量为正数
    ALTER TABLE billing_db.token_reservations
    ADD CONSTRAINT IF NOT EXISTS chk_token_reservations_amount_positive
    CHECK (amount > 0);

    RAISE NOTICE '添加业务约束完成';
END $$;

-- 5. 创建部分索引优化查询
DO $$
BEGIN
    -- 为活跃的offers创建索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'offer_db'
            AND tablename = 'offers'
            AND indexname = 'idx_offers_active_status'
    ) THEN
        CREATE INDEX idx_offers_active_status
        ON offer_db.offers(user_id, created_at DESC)
        WHERE status IN ('evaluated', 'ready_to_deploy', 'deployed');

        RAISE NOTICE '创建offers表活跃状态部分索引';
    END IF;

    -- 为未确认的Token预留创建索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'billing_db'
            AND tablename = 'token_reservations'
            AND indexname = 'idx_token_reservations_pending'
    ) THEN
        CREATE INDEX idx_token_reservations_pending
        ON billing_db.token_reservations(user_id, created_at)
        WHERE status = 'reserved';

        RAISE NOTICE '创建token_reservations表预留状态部分索引';
    END IF;
END $$;

-- 6. 创建统计信息更新触发器
DO $$
BEGIN
    -- 创建更新offers表的updated_at字段的触发器
    CREATE OR REPLACE FUNCTION update_offer_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_update_offer_updated_at ON offer_db.offers;
    CREATE TRIGGER trigger_update_offer_updated_at
        BEFORE UPDATE ON offer_db.offers
        FOR EACH ROW
        EXECUTE FUNCTION update_offer_updated_at();

    RAISE NOTICE '创建offers.updated_at更新触发器';
END $$;

-- 7. 验证索引创建结果
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname IN ('offer_db', 'billing_db', 'siterank_db', 'adscenter_db')
    AND (
        indexname LIKE '%idx_%'
        OR indexname LIKE '%fk_%'
        OR indexname LIKE '%chk_%'
        OR indexname LIKE '%unique_%'
    )
ORDER BY schemaname, tablename, indexname;

COMMIT;

-- 输出迁移完成信息
DO $$
BEGIN
    RAISE NOTICE '===== 数据库约束和索引优化迁移完成 =====';
    RAISE NOTICE '1. 添加了外键约束确保数据完整性';
    RAISE NOTICE '2. 创建了复合索引优化常用查询';
    RAISE NOTICE '3. 添加了JSONB字段的GIN索引';
    RAISE NOTICE '4. 添加了业务约束确保数据质量';
    RAISE NOTICE '5. 创建了部分索引优化特定查询';
    RAISE NOTICE '6. 添加了触发器自动更新时间戳';
    RAISE NOTICE '=========================================';
END $$;