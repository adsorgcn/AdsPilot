-- 测试数据库初始化脚本
-- 创建基本的表结构用于测试

-- User 表
CREATE TABLE IF NOT EXISTS "User" (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Offer 表
CREATE TABLE IF NOT EXISTS "Offer" (
    id VARCHAR(255) PRIMARY KEY,
    "userId" VARCHAR(255) NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    "originalUrl" TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'opportunity',
    "siterankScore" DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_offer_user_id ON "Offer"("userId");
CREATE INDEX IF NOT EXISTS idx_offer_status ON "Offer"(status);
CREATE INDEX IF NOT EXISTS idx_offer_created_at ON "Offer"(created_at);

-- GoogleAdsAccount 表
CREATE TABLE IF NOT EXISTS "GoogleAdsAccount" (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    refresh_token_encrypted TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE
);

-- BulkActionOperation 表
CREATE TABLE IF NOT EXISTS "BulkActionOperation" (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    plan JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE
);

-- BulkActionAudit 表
CREATE TABLE IF NOT EXISTS "BulkActionAudit" (
    id BIGSERIAL PRIMARY KEY,
    op_id VARCHAR(255) NOT NULL,
    kind VARCHAR(50) NOT NULL,
    snapshot JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (op_id) REFERENCES "BulkActionOperation"(id) ON DELETE CASCADE
);

-- OfferAccountMap 表
CREATE TABLE IF NOT EXISTS "OfferAccountMap" (
    offer_id VARCHAR(255) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    linked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (offer_id, account_id),
    FOREIGN KEY (offer_id) REFERENCES "Offer"(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE
);

-- OfferPreferences 表
CREATE TABLE IF NOT EXISTS "OfferPreferences" (
    user_id VARCHAR(255) NOT NULL,
    offer_id VARCHAR(255) NOT NULL,
    auto_status_enabled BOOLEAN DEFAULT FALSE,
    zero_perf_days INTEGER DEFAULT 5,
    rosc_decline_days INTEGER DEFAULT 7,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, offer_id),
    FOREIGN KEY (offer_id) REFERENCES "Offer"(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE
);

-- OfferStatusHistory 表
CREATE TABLE IF NOT EXISTS "OfferStatusHistory" (
    id BIGSERIAL PRIMARY KEY,
    offer_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (offer_id) REFERENCES "Offer"(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE
);

-- OfferDailyKPI 表
CREATE TABLE IF NOT EXISTS "OfferDailyKPI" (
    offer_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    spend DOUBLE PRECISION DEFAULT 0,
    revenue DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (offer_id, date),
    FOREIGN KEY (offer_id) REFERENCES "Offer"(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE
);

-- idempotency_keys 表
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    scope VARCHAR(100) NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    PRIMARY KEY (key, user_id, scope)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- 插入测试用户
INSERT INTO "User" (id, email, name) 
VALUES ('test-user-1', 'test1@example.com', 'Test User 1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "User" (id, email, name) 
VALUES ('test-user-2', 'test2@example.com', 'Test User 2')
ON CONFLICT (id) DO NOTHING;

-- 完成
SELECT 'Test database initialized successfully' AS status;
