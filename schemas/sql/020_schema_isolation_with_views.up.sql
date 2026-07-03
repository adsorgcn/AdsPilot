-- Schema 级隔离迁移（带兼容性视图）
-- 目的：将不同服务的表分离到独立的 schema 中，提高数据隔离性
-- 策略：表迁移到新 schema + public schema 保留视图别名，确保零停机迁移
-- 参考：docs/MarkerkitGo/MicroserviceArchitectureReview.md 阶段1

-- 1. 创建独立 schema
CREATE SCHEMA IF NOT EXISTS offer_db;
CREATE SCHEMA IF NOT EXISTS billing_db;
CREATE SCHEMA IF NOT EXISTS siterank_db;
CREATE SCHEMA IF NOT EXISTS adscenter_db;
CREATE SCHEMA IF NOT EXISTS shared_db;

COMMENT ON SCHEMA offer_db IS 'Offer service tables';
COMMENT ON SCHEMA billing_db IS 'Billing service tables';
COMMENT ON SCHEMA siterank_db IS 'Siterank service tables';
COMMENT ON SCHEMA adscenter_db IS 'Adscenter service tables';
COMMENT ON SCHEMA shared_db IS 'Shared tables across services';

-- 2. 迁移 offer 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Offer') THEN
        ALTER TABLE public."Offer" SET SCHEMA offer_db;
        CREATE OR REPLACE VIEW public."Offer" AS SELECT * FROM offer_db."Offer";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='OfferStatusHistory') THEN
        ALTER TABLE public."OfferStatusHistory" SET SCHEMA offer_db;
        CREATE OR REPLACE VIEW public."OfferStatusHistory" AS SELECT * FROM offer_db."OfferStatusHistory";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='OfferPreferences') THEN
        ALTER TABLE public."OfferPreferences" SET SCHEMA offer_db;
        CREATE OR REPLACE VIEW public."OfferPreferences" AS SELECT * FROM offer_db."OfferPreferences";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='OfferKpiDeadLetter') THEN
        ALTER TABLE public."OfferKpiDeadLetter" SET SCHEMA offer_db;
        CREATE OR REPLACE VIEW public."OfferKpiDeadLetter" AS SELECT * FROM offer_db."OfferKpiDeadLetter";
    END IF;
END $$;

-- 3. 迁移 billing 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Subscription') THEN
        ALTER TABLE public."Subscription" SET SCHEMA billing_db;
        CREATE OR REPLACE VIEW public."Subscription" AS SELECT * FROM billing_db."Subscription";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='UserToken') THEN
        ALTER TABLE public."UserToken" SET SCHEMA billing_db;
        CREATE OR REPLACE VIEW public."UserToken" AS SELECT * FROM billing_db."UserToken";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='TokenTransaction') THEN
        ALTER TABLE public."TokenTransaction" SET SCHEMA billing_db;
        CREATE OR REPLACE VIEW public."TokenTransaction" AS SELECT * FROM billing_db."TokenTransaction";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='UserTokenPool') THEN
        ALTER TABLE public."UserTokenPool" SET SCHEMA billing_db;
        CREATE OR REPLACE VIEW public."UserTokenPool" AS SELECT * FROM billing_db."UserTokenPool";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='TokenCreditLot') THEN
        ALTER TABLE public."TokenCreditLot" SET SCHEMA billing_db;
        CREATE OR REPLACE VIEW public."TokenCreditLot" AS SELECT * FROM billing_db."TokenCreditLot";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='TokenCreditAllocation') THEN
        ALTER TABLE public."TokenCreditAllocation" SET SCHEMA billing_db;
        CREATE OR REPLACE VIEW public."TokenCreditAllocation" AS SELECT * FROM billing_db."TokenCreditAllocation";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='TokenRepairAudit') THEN
        ALTER TABLE public."TokenRepairAudit" SET SCHEMA billing_db;
        CREATE OR REPLACE VIEW public."TokenRepairAudit" AS SELECT * FROM billing_db."TokenRepairAudit";
    END IF;
END $$;

-- 4. 迁移 siterank 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='SiterankAnalysis') THEN
        ALTER TABLE public."SiterankAnalysis" SET SCHEMA siterank_db;
        CREATE OR REPLACE VIEW public."SiterankAnalysis" AS SELECT * FROM siterank_db."SiterankAnalysis";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='SiterankHistory') THEN
        ALTER TABLE public."SiterankHistory" SET SCHEMA siterank_db;
        CREATE OR REPLACE VIEW public."SiterankHistory" AS SELECT * FROM siterank_db."SiterankHistory";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='domain_cache') THEN
        ALTER TABLE public.domain_cache SET SCHEMA siterank_db;
        CREATE OR REPLACE VIEW public.domain_cache AS SELECT * FROM siterank_db.domain_cache;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='domain_country_cache') THEN
        ALTER TABLE public.domain_country_cache SET SCHEMA siterank_db;
        CREATE OR REPLACE VIEW public.domain_country_cache AS SELECT * FROM siterank_db.domain_country_cache;
    END IF;
END $$;

-- 5. 迁移 adscenter 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='UserAdsConnection') THEN
        ALTER TABLE public."UserAdsConnection" SET SCHEMA adscenter_db;
        CREATE OR REPLACE VIEW public."UserAdsConnection" AS SELECT * FROM adscenter_db."UserAdsConnection";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='BulkAudit') THEN
        ALTER TABLE public."BulkAudit" SET SCHEMA adscenter_db;
        CREATE OR REPLACE VIEW public."BulkAudit" AS SELECT * FROM adscenter_db."BulkAudit";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='MccLink') THEN
        ALTER TABLE public."MccLink" SET SCHEMA adscenter_db;
        CREATE OR REPLACE VIEW public."MccLink" AS SELECT * FROM adscenter_db."MccLink";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='AuditEvents') THEN
        ALTER TABLE public."AuditEvents" SET SCHEMA adscenter_db;
        CREATE OR REPLACE VIEW public."AuditEvents" AS SELECT * FROM adscenter_db."AuditEvents";
    END IF;
END $$;

-- 6. 迁移共享表到 shared_db
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User') THEN
        ALTER TABLE public."User" SET SCHEMA shared_db;
        CREATE OR REPLACE VIEW public."User" AS SELECT * FROM shared_db."User";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schema_migrations') THEN
        ALTER TABLE public.schema_migrations SET SCHEMA shared_db;
        CREATE OR REPLACE VIEW public.schema_migrations AS SELECT * FROM shared_db.schema_migrations;
    END IF;
END $$;

-- 7. 设置注释说明视图用途
COMMENT ON VIEW public."Offer" IS 'Compatibility view -> offer_db.Offer';
COMMENT ON VIEW public."TokenTransaction" IS 'Compatibility view -> billing_db.TokenTransaction';
COMMENT ON VIEW public."SiterankAnalysis" IS 'Compatibility view -> siterank_db.SiterankAnalysis';

-- 8. 迁移完成通知
DO $$
BEGIN
    RAISE NOTICE 'Schema isolation migration completed successfully';
    RAISE NOTICE 'Tables moved to dedicated schemas with compatibility views in public schema';
    RAISE NOTICE 'Next step: Update services to use schema-specific DATABASE_URL or set search_path';
END $$;
