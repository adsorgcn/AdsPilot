-- 回滚 Schema 级隔离迁移
-- 将表从专用 schema 移回 public schema

-- 1. 删除兼容性视图
DROP VIEW IF EXISTS public."Offer" CASCADE;
DROP VIEW IF EXISTS public."OfferStatusHistory" CASCADE;
DROP VIEW IF EXISTS public."OfferPreferences" CASCADE;
DROP VIEW IF EXISTS public."OfferKpiDeadLetter" CASCADE;

DROP VIEW IF EXISTS public."Subscription" CASCADE;
DROP VIEW IF EXISTS public."UserToken" CASCADE;
DROP VIEW IF EXISTS public."TokenTransaction" CASCADE;
DROP VIEW IF EXISTS public."UserTokenPool" CASCADE;
DROP VIEW IF EXISTS public."TokenCreditLot" CASCADE;
DROP VIEW IF EXISTS public."TokenCreditAllocation" CASCADE;
DROP VIEW IF EXISTS public."TokenRepairAudit" CASCADE;

DROP VIEW IF EXISTS public."SiterankAnalysis" CASCADE;
DROP VIEW IF EXISTS public."SiterankHistory" CASCADE;
DROP VIEW IF EXISTS public.domain_cache CASCADE;
DROP VIEW IF EXISTS public.domain_country_cache CASCADE;

DROP VIEW IF EXISTS public."UserAdsConnection" CASCADE;
DROP VIEW IF EXISTS public."BulkAudit" CASCADE;
DROP VIEW IF EXISTS public."MccLink" CASCADE;
DROP VIEW IF EXISTS public."AuditEvents" CASCADE;

DROP VIEW IF EXISTS public."User" CASCADE;
DROP VIEW IF EXISTS public.schema_migrations CASCADE;

-- 2. 移回 offer 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='offer_db' AND table_name='Offer') THEN
        ALTER TABLE offer_db."Offer" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='offer_db' AND table_name='OfferStatusHistory') THEN
        ALTER TABLE offer_db."OfferStatusHistory" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='offer_db' AND table_name='OfferPreferences') THEN
        ALTER TABLE offer_db."OfferPreferences" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='offer_db' AND table_name='OfferKpiDeadLetter') THEN
        ALTER TABLE offer_db."OfferKpiDeadLetter" SET SCHEMA public;
    END IF;
END $$;

-- 3. 移回 billing 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='billing_db' AND table_name='Subscription') THEN
        ALTER TABLE billing_db."Subscription" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='billing_db' AND table_name='UserToken') THEN
        ALTER TABLE billing_db."UserToken" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='billing_db' AND table_name='TokenTransaction') THEN
        ALTER TABLE billing_db."TokenTransaction" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='billing_db' AND table_name='UserTokenPool') THEN
        ALTER TABLE billing_db."UserTokenPool" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='billing_db' AND table_name='TokenCreditLot') THEN
        ALTER TABLE billing_db."TokenCreditLot" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='billing_db' AND table_name='TokenCreditAllocation') THEN
        ALTER TABLE billing_db."TokenCreditAllocation" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='billing_db' AND table_name='TokenRepairAudit') THEN
        ALTER TABLE billing_db."TokenRepairAudit" SET SCHEMA public;
    END IF;
END $$;

-- 4. 移回 siterank 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='siterank_db' AND table_name='SiterankAnalysis') THEN
        ALTER TABLE siterank_db."SiterankAnalysis" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='siterank_db' AND table_name='SiterankHistory') THEN
        ALTER TABLE siterank_db."SiterankHistory" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='siterank_db' AND table_name='domain_cache') THEN
        ALTER TABLE siterank_db.domain_cache SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='siterank_db' AND table_name='domain_country_cache') THEN
        ALTER TABLE siterank_db.domain_country_cache SET SCHEMA public;
    END IF;
END $$;

-- 5. 移回 adscenter 服务的表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='adscenter_db' AND table_name='UserAdsConnection') THEN
        ALTER TABLE adscenter_db."UserAdsConnection" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='adscenter_db' AND table_name='BulkAudit') THEN
        ALTER TABLE adscenter_db."BulkAudit" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='adscenter_db' AND table_name='MccLink') THEN
        ALTER TABLE adscenter_db."MccLink" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='adscenter_db' AND table_name='AuditEvents') THEN
        ALTER TABLE adscenter_db."AuditEvents" SET SCHEMA public;
    END IF;
END $$;

-- 6. 移回共享表
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='shared_db' AND table_name='User') THEN
        ALTER TABLE shared_db."User" SET SCHEMA public;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='shared_db' AND table_name='schema_migrations') THEN
        ALTER TABLE shared_db.schema_migrations SET SCHEMA public;
    END IF;
END $$;

-- 7. 删除空 schema (可选，谨慎执行)
-- DROP SCHEMA IF EXISTS offer_db CASCADE;
-- DROP SCHEMA IF EXISTS billing_db CASCADE;
-- DROP SCHEMA IF EXISTS siterank_db CASCADE;
-- DROP SCHEMA IF EXISTS adscenter_db CASCADE;
-- DROP SCHEMA IF EXISTS shared_db CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'Schema isolation rollback completed';
    RAISE NOTICE 'All tables moved back to public schema';
END $$;
