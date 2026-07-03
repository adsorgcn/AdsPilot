-- ========================================
-- 修复 User Schema - 独立修复脚本
-- 解决 PostgreSQL 保留关键字问题
-- ========================================

-- 开始事务
BEGIN;

-- 删除可能存在的损坏 schema（如果存在）
DROP SCHEMA IF EXISTS "user" CASCADE;

-- 重新创建用户域Schema（正确使用引号）
CREATE SCHEMA "user";

-- 创建用户主表
CREATE TABLE "user".users (
    -- 主键: 存储Supabase auth.users.id (UUID转TEXT)
    id TEXT PRIMARY KEY,

    -- 基础信息
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    phone TEXT,

    -- 用户状态
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),

    -- 认证相关
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    last_sign_in_at TIMESTAMPTZ,

    -- 用户偏好设置
    language TEXT DEFAULT 'zh-CN',
    timezone TEXT DEFAULT 'Asia/Shanghai',
    preferences JSONB DEFAULT '{}'::jsonb,

    -- 元数据
    metadata JSONB DEFAULT '{}'::jsonb,

    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 创建索引
CREATE INDEX idx_users_email ON "user".users(email);
CREATE INDEX idx_users_status ON "user".users(status);
CREATE INDEX idx_users_created_at ON "user".users(created_at);
CREATE INDEX idx_users_deleted_at ON "user".users(deleted_at);

-- 创建更新时间戳触发器函数
CREATE OR REPLACE FUNCTION "user".update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为用户表创建更新时间戳触发器
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON "user".users
    FOR EACH ROW
    EXECUTE FUNCTION "user".update_updated_at_column();

-- 提交事务
COMMIT;

-- 验证创建结果
DO $$
BEGIN
    -- 验证schema
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'user') THEN
        RAISE NOTICE '✅ user schema created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create user schema';
    END IF;

    -- 验证表
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'user' AND table_name = 'users') THEN
        RAISE NOTICE '✅ user.users table created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create user.users table';
    END IF;

    RAISE NOTICE '🎉 User Schema 修复完成!';
    RAISE NOTICE '   ✅ 使用了正确的引号语法: CREATE SCHEMA "user"';
    RAISE NOTICE '   ✅ 解决了 PostgreSQL 保留关键字问题';
END $$;