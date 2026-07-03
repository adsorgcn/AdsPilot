-- ============================================================================
-- 创建public.users表 - 用户业务数据
-- ============================================================================
-- 执行方式: 在Supabase Dashboard SQL编辑器手动执行
-- 原因: Supabase托管环境权限限制
-- URL: https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT/sql/new
-- ============================================================================

-- Step 1: 创建users表
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    photo_url TEXT,
    onboarded BOOLEAN DEFAULT false,
    subscription_tier TEXT DEFAULT 'trial',
    monthly_token_allocation INTEGER DEFAULT 0,
    token_balance INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: 创建索引
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON public.users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

-- Step 3: 启用RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 4: 创建RLS策略 - 用户只能读写自己的数据
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- Step 5: 为现有auth.users创建对应的public.users记录
INSERT INTO public.users (id, display_name, photo_url, onboarded)
SELECT
    id,
    COALESCE(
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'name',
        SPLIT_PART(email, '@', 1)
    ),
    raw_user_meta_data->>'avatar_url',
    true
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Step 6: 创建updated_at自动更新触发器
CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at_trigger
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_users_updated_at();

-- Step 7: 验证
DO $$
DECLARE
    user_count INTEGER;
    auth_user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.users;
    SELECT COUNT(*) INTO auth_user_count FROM auth.users;

    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'auth.users count: %', auth_user_count;
    RAISE NOTICE 'public.users count: %', user_count;

    IF user_count < auth_user_count THEN
        RAISE WARNING 'Mismatch: Some auth.users do not have public.users records';
    END IF;
END $$;
