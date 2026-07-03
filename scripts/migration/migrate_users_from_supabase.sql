-- =============================================================================
-- Google-Monetize 用户数据迁移脚本
-- 从Supabase auth.users 迁移到 Cloud SQL user.users
--
-- 执行方式: 通过golang-migrate工具执行
-- 环境变量: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
--
-- 创建日期: 2025-01-22
-- 版本: v1.0
-- =============================================================================

-- 创建迁移函数（如果不存在）
CREATE OR REPLACE FUNCTION migrate_user_from_supabase_to_cloudsql()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    -- 用户变量
    v_supabase_url TEXT := current_setting('supabase.url', '');
    v_supabase_service_role_key TEXT := current_setting('supabase.service_role_key', '');

    -- 统计变量
    v_migrated_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_error_count INTEGER := 0;

    -- 用户数据记录
    user_record RECORD;

    -- 游标，用于批量处理
    CURSOR c_user CURSOR FOR
        SELECT
            id,
            email,
                    COALESCE(raw_user_meta_data->>'full_name',
                            COALESCE(raw_user_meta_data->>'name',
                            COALESCE(email, '')::TEXT) AS display_name,
                    COALESCE(raw_user_meta_data->>'avatar_url',
                            COALESCE(raw_user_meta_data->>'picture',
                            raw_user_meta_data->>'avatar_url')::TEXT) AS photo_url,
                    created_at,
                    updated_at,
                    email_confirmed_at,
                    phone_confirmed_at,
                    last_sign_in_at,
                    phone,
                    app_metadata,
                    user_metadata
        FROM auth.users
        WHERE deleted_at IS NULL
        ORDER BY created_at ASC;
BEGIN
    -- 遍历所有用户
    FOR user_record IN c_user LOOP
        -- 检查用户是否已存在于Cloud SQL
        PERFORM 1 INTO user.users
            (
                id,
                email,
                display_name,
                photo_url,
                status,
                email_verified,
                phone_verified,
                created_at,
                updated_at,
                language,
                timezone,
                preferences,
                metadata
            )
        SELECT
                user_record.id,
                user_record.email,
                user_record.display_name,
                user_record.photo_url,
                'active', -- 默认状态
                COALESCE(user_record.email_confirmed_at IS NOT NULL, false, true), -- email_confirmed_at为NULL则认为未验证
                COALESCE(user_record.phone_confirmed_at IS NOT NULL, false, true), -- phone_confirmed_at为NULL则认为未验证
                user_record.created_at,
                user_record.updated_at,
                'en', -- 默认语言
                'UTC', -- 默认时区
                '{}'::jsonb, -- 默认偏好设置
                '{}'::jsonb -- 默认元数据
            )
        ON CONFLICT (id) DO NOTHING
        RETURNING;

        -- 更新统计
        GET DIAGNOSTICS v_skipped_count = v_skipped_count + 1;
    END LOOP;

    -- 生成迁移报告
    RETURN jsonb_build_object(
        'migrated_users', v_migrated_count,
        'skipped_users', v_skipped_count,
        'error_count', v_error_count,
        'status', CASE
            WHEN v_error_count > 0 THEN 'completed_with_errors'
            WHEN v_migrated_count = 0 THEN 'no_new_users'
            ELSE 'completed'
        END,
        'timestamp', NOW()::text,
        'supabase_url', v_supabase_url,
        'service_role_key_used', CASE WHEN v_supabase_service_role_key IS NOT NULL AND v_supabase_service_role_key != '' THEN 'true' ELSE 'false' END
    );
END;
$$;

-- 创建user表（如果不存在）
CREATE TABLE IF NOT EXISTS user.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    photo_url TEXT,
    status TEXT CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_users_email ON user.users(email);
CREATE INDEX IF NOT EXISTS idx_user_users_status ON user.users(status);
CREATE INDEX IF NOT EXISTS idx_user_users_created_at ON user.users(created_at);

-- 插入迁移记录
INSERT INTO schema_migrations (version, description, executed_at, success)
VALUES (
    '20250122_001_migrate_users_from_supabase',
    'Migrate users from Supabase auth.users to Cloud SQL user.users',
    NOW(),
    true
);

-- 执行迁移
SELECT migrate_user_from_supabase_to_cloudsql() as migration_result;