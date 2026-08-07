-- Local-mode schema, step 1: the "user" schema.
-- Derived from deployments/disabled-db-migrator/fix-user-schema.sql, made
-- idempotent (no DROP SCHEMA) and seeded with the single local-model user.

BEGIN;

CREATE SCHEMA IF NOT EXISTS "user";

CREATE TABLE IF NOT EXISTS "user".users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    last_sign_in_at TIMESTAMPTZ,
    language TEXT DEFAULT 'zh-CN',
    timezone TEXT DEFAULT 'Asia/Shanghai',
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON "user".users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON "user".users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON "user".users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON "user".users(deleted_at);

CREATE OR REPLACE FUNCTION "user".update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON "user".users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON "user".users
    FOR EACH ROW
    EXECUTE FUNCTION "user".update_updated_at_column();

-- The single-user local model attributes all requests to this fixed user
-- (see pkg/middleware.LocalModeUserID).
INSERT INTO "user".users (id, email, name)
VALUES ('local', 'local@adspilot.invalid', 'Local User')
ON CONFLICT (id) DO NOTHING;

COMMIT;
