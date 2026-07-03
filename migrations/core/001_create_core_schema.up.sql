-- ========================================
-- Google-Monetize 数据库迁移: Core Schema (跨功能共享主数据)
-- 迁移ID: core-000001
-- 版本: v1.0
-- 创建时间: 2026-06-29
-- 说明: 联盟/offer、流量源/点击、转化、IP情报、指纹浏览器映射
--       (Phase 0 地基。执行方式见 migrations/core/README.md)
-- ========================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS core;

-- ========== 联盟账户与 offer(功能①) ==========

CREATE TABLE IF NOT EXISTS core.affiliate_accounts (
    id            BIGSERIAL PRIMARY KEY,
    provider      TEXT NOT NULL,                 -- 'cj' | 'impact' | 'awin' ...  (ShareASale 已于 2025-10-06 关闭并入 Awin)
    display_name  TEXT,
    credentials   TEXT NOT NULL,                 -- crypto.Encrypt 后的 JSON(禁止明文)
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.offers (
    id              BIGSERIAL PRIMARY KEY,
    affiliate_id    BIGINT REFERENCES core.affiliate_accounts(id),
    external_id     TEXT NOT NULL,               -- 联盟侧 offer id
    name            TEXT NOT NULL,
    advertiser      TEXT,
    category        TEXT,
    country         TEXT,
    payout_type     TEXT,                         -- CPA/CPL/CPS/RevShare
    payout_value    NUMERIC,
    currency        TEXT,
    epc             NUMERIC,                      -- 联盟给的 EPC(若有)
    landing_url     TEXT,
    raw             JSONB,                        -- 联盟原始返回
    ai_score        NUMERIC,                      -- AI 选 offer 打分
    ai_reason       TEXT,                         -- AI 选择理由
    status          TEXT NOT NULL DEFAULT 'new',  -- new/picked/testing/paused/dead
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(affiliate_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_offers_status ON core.offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_country_cat ON core.offers(country, category);

CREATE TABLE IF NOT EXISTS core.ad_designs (
    id            BIGSERIAL PRIMARY KEY,
    offer_id      BIGINT REFERENCES core.offers(id),
    channel       TEXT,                           -- 'google_search'|'native'|'pop'
    headline      TEXT,
    description   TEXT,
    landing_brief TEXT,                           -- AI 生成的落地页方向
    assets        JSONB,                          -- 文案变体/素材引用
    ai_model      TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== 流量源与点击(功能③) ==========

CREATE TABLE IF NOT EXISTS core.traffic_sources (
    id            BIGSERIAL PRIMARY KEY,
    provider      TEXT NOT NULL,                 -- 'native_x'|'pop_y'|'google_ads'...
    display_name  TEXT,
    credentials   TEXT,                          -- crypto.Encrypt
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 点击是高频大表:按月 RANGE 分区,为水平扩展预留
CREATE TABLE IF NOT EXISTS core.clicks (
    id              BIGSERIAL,
    click_id        TEXT NOT NULL,                -- 我们生成的唯一点击标识(透传到落地页)
    offer_id        BIGINT,
    traffic_src_id  BIGINT,
    campaign_ref    TEXT,
    ip              INET,
    ip_country      TEXT,
    user_agent      TEXT,
    referer         TEXT,
    device          TEXT,
    -- 行为信号(异步回填)
    dwell_ms        INTEGER,
    had_interaction BOOLEAN,
    js_executed     BOOLEAN,
    -- 风控(异步回填)
    risk_score      SMALLINT,                     -- 0-100,越高越可疑
    risk_verdict    TEXT,                         -- 'real'|'suspect'|'fake'
    risk_reasons    JSONB,
    ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

CREATE INDEX IF NOT EXISTS idx_clicks_click_id ON core.clicks(click_id);
CREATE INDEX IF NOT EXISTS idx_clicks_src ON core.clicks(traffic_src_id, ts);

-- 建当月 + 下月分区(CC/运维需定时新建后续月份分区,见 README)
DO $$
DECLARE
    m0 date := date_trunc('month', now())::date;
    m1 date := (date_trunc('month', now()) + interval '1 month')::date;
    m2 date := (date_trunc('month', now()) + interval '2 month')::date;
BEGIN
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS core.clicks_p%s PARTITION OF core.clicks FOR VALUES FROM (%L) TO (%L)',
        to_char(m0,'YYYYMM'), m0, m1);
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS core.clicks_p%s PARTITION OF core.clicks FOR VALUES FROM (%L) TO (%L)',
        to_char(m1,'YYYYMM'), m1, m2);
END $$;

CREATE TABLE IF NOT EXISTS core.conversions (
    id              BIGSERIAL PRIMARY KEY,
    click_id        TEXT,                         -- 关联 core.clicks.click_id
    offer_id        BIGINT,
    traffic_src_id  BIGINT,
    value           NUMERIC,
    currency        TEXT,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending/confirmed/reversed(联盟拒付)
    source          TEXT,                          -- 'postback'|'api_pull'
    raw             JSONB,
    ts              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversions_click ON core.conversions(click_id);
CREATE INDEX IF NOT EXISTS idx_conversions_status ON core.conversions(status);

-- ========== IP 情报缓存(功能③ 反作弊,避免重复打外部 API) ==========

CREATE TABLE IF NOT EXISTS core.ip_intel (
    ip            INET PRIMARY KEY,
    is_datacenter BOOLEAN,
    is_proxy      BOOLEAN,
    is_vpn        BOOLEAN,
    fraud_score   SMALLINT,                       -- 外部情报商给的分
    country       TEXT,
    asn           TEXT,
    provider      TEXT,                           -- 'ipqs'|'maxmind'|...
    raw           JSONB,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ttl_days      INTEGER DEFAULT 30
);

-- ========== 指纹浏览器与账户映射(功能④) ==========

CREATE TABLE IF NOT EXISTS core.browser_profiles (
    id              BIGSERIAL PRIMARY KEY,
    provider        TEXT NOT NULL,               -- 'adspower'|'bit'|'multilogin'
    external_env_id TEXT,                         -- 指纹软件里的环境 id
    google_account  TEXT,                         -- 绑定的 Google Ads 账户(customer id)
    proxy_ref       TEXT,
    owner_user_id   BIGINT,                       -- 归属团队成员
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
