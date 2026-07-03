-- Schema 级隔离迁移
-- 目的：将不同服务的表分离到独立的 schema 中，提高数据隔离性
-- 参考：docs/MarkerkitGo/MicroserviceArchitectureReview.md 阶段1

-- 创建独立 schema
CREATE SCHEMA IF NOT EXISTS offer_db;
CREATE SCHEMA IF NOT EXISTS billing_db;
CREATE SCHEMA IF NOT EXISTS siterank_db;
CREATE SCHEMA IF NOT EXISTS adscenter_db;
CREATE SCHEMA IF NOT EXISTS shared_db;

-- 迁移 offer 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Offer') THEN
        ALTER TABLE IF EXISTS public."Offer" SET SCHEMA offer_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='OfferStatusHistory') THEN
        ALTER TABLE IF EXISTS public."OfferStatusHistory" SET SCHEMA offer_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='OfferPreferences') THEN
        ALTER TABLE IF EXISTS public."OfferPreferences" SET SCHEMA offer_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='OfferKpiDeadLetter') THEN
        ALTER TABLE IF EXISTS public."OfferKpiDeadLetter" SET SCHEMA offer_db;
    END IF;
END $$;

-- 迁移 billing 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Subscription') THEN
        ALTER TABLE IF EXISTS public."Subscription" SET SCHEMA billing_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='UserToken') THEN
        ALTER TABLE IF EXISTS public."UserToken" SET SCHEMA billing_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='TokenTransaction') THEN
        ALTER TABLE IF EXISTS public."TokenTransaction" SET SCHEMA billing_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='UserTokenPool') THEN
        ALTER TABLE IF EXISTS public."UserTokenPool" SET SCHEMA billing_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='TokenCreditLot') THEN
        ALTER TABLE IF EXISTS public."TokenCreditLot" SET SCHEMA billing_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='TokenCreditAllocation') THEN
        ALTER TABLE IF EXISTS public."TokenCreditAllocation" SET SCHEMA billing_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='TokenRepairAudit') THEN
        ALTER TABLE IF EXISTS public."TokenRepairAudit" SET SCHEMA billing_db;
    END IF;
END $$;

-- 迁移 siterank 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='SiterankAnalysis') THEN
        ALTER TABLE IF EXISTS public."SiterankAnalysis" SET SCHEMA siterank_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='SiterankHistory') THEN
        ALTER TABLE IF EXISTS public."SiterankHistory" SET SCHEMA siterank_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='domain_cache') THEN
        ALTER TABLE IF EXISTS public.domain_cache SET SCHEMA siterank_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='domain_country_cache') THEN
        ALTER TABLE IF EXISTS public.domain_country_cache SET SCHEMA siterank_db;
    END IF;
END $$;

-- 迁移 adscenter 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='UserAdsConnection') THEN
        ALTER TABLE IF EXISTS public."UserAdsConnection" SET SCHEMA adscenter_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='BulkAudit') THEN
        ALTER TABLE IF EXISTS public."BulkAudit" SET SCHEMA adscenter_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='MccLink') THEN
        ALTER TABLE IF EXISTS public."MccLink" SET SCHEMA adscenter_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='AuditEvents') THEN
        ALTER TABLE IF EXISTS public."AuditEvents" SET SCHEMA adscenter_db;
    END IF;
END $$;

-- 迁移共享表到 shared_db (User, schema_migrations, idempotency_keys等)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User') THEN
        ALTER TABLE IF EXISTS public."User" SET SCHEMA shared_db;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schema_migrations') THEN
        ALTER TABLE IF EXISTS public.schema_migrations SET SCHEMA shared_db;
    END IF;
    -- idempotency_keys 保留在各服务的 schema 中，如果已存在则不迁移
END $$;

-- 创建跨 schema 访问的视图（可选，用于兼容性）
-- 示例：CREATE OR REPLACE VIEW public."Offer" AS SELECT * FROM offer_db."Offer";

COMMENT ON SCHEMA offer_db IS 'Offer service tables';
COMMENT ON SCHEMA billing_db IS 'Billing service tables';
COMMENT ON SCHEMA siterank_db IS 'Siterank service tables';
COMMENT ON SCHEMA adscenter_db IS 'Adscenter service tables';
COMMENT ON SCHEMA shared_db IS 'Shared tables across services';
