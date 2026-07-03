-- ============================================================================
-- 修复认证流程 - 彻底解决注册登录异常
-- ============================================================================
-- 执行时间: 2025-10-18
-- 目的: 修复重定向循环、用户数据创建失败等问题
-- ============================================================================

-- ============================================================================
-- Part 1: 确保users表存在且结构正确
-- ============================================================================

-- 创建users表(如果不存在)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    photo_url TEXT,
    onboarded BOOLEAN DEFAULT true,  -- 默认为true，避免onboarding重定向
    subscription_tier TEXT DEFAULT 'trial',
    monthly_token_allocation INTEGER DEFAULT 0,
    token_balance INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON public.users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_onboarded ON public.users(onboarded);

-- ============================================================================
-- Part 2: 配置RLS策略
-- ============================================================================

-- 启用RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 删除旧策略(如果存在)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

-- 用户可以查看自己的数据
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

-- 用户可以更新自己的数据
CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- Service role可以管理所有用户(用于触发器)
CREATE POLICY "Service role can manage all users"
    ON public.users FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- Part 3: 创建或更新触发器函数
-- ============================================================================

-- 删除旧触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建新的触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  user_display_name TEXT;
  user_email TEXT;
  user_photo_url TEXT;
BEGIN
  -- 提取用户信息
  user_email := NEW.email;
  user_photo_url := NEW.raw_user_meta_data->>'avatar_url';
  
  -- 从Google OAuth提取显示名称
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(user_email, '@', 1),
    'User'
  );

  -- 创建用户记录
  -- 注意: token余额由billing服务的trial订阅创建时统一管理
  INSERT INTO public.users (
    id,
    display_name,
    photo_url,
    onboarded,
    subscription_tier,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    user_display_name,
    user_photo_url,
    true,  -- 默认已完成onboarding
    'trial',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    photo_url = EXCLUDED.photo_url,
    updated_at = NOW();

  -- 记录成功日志
  RAISE NOTICE 'Successfully created/updated user: id=%, email=%, name=%', 
    NEW.id, user_email, user_display_name;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 记录错误但不阻止用户创建
    RAISE WARNING 'Error in handle_new_user for user % (email: %): % - %', 
      NEW.id, user_email, SQLERRM, SQLSTATE;
    
    -- 即使出错也返回NEW，确保auth.users记录创建成功
    RETURN NEW;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates or updates public.users record when a new auth.users record is created. Uses ON CONFLICT to handle race conditions.';

-- 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
  'Triggers automatic user setup after OAuth signup';

-- ============================================================================
-- Part 4: 为现有用户创建记录
-- ============================================================================

-- 为所有现有的auth.users创建对应的public.users记录
-- 注意: token余额由billing服务统一管理，不在此处设置
INSERT INTO public.users (
  id,
  display_name,
  photo_url,
  onboarded,
  subscription_tier,
  created_at,
  updated_at
)
SELECT
  au.id,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    SPLIT_PART(au.email, '@', 1),
    'User'
  ) as display_name,
  au.raw_user_meta_data->>'avatar_url' as photo_url,
  true as onboarded,
  'trial' as subscription_tier,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Part 5: 创建updated_at自动更新触发器
-- ============================================================================

-- 创建或替换updated_at更新函数
CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除旧触发器(如果存在)
DROP TRIGGER IF EXISTS users_updated_at_trigger ON public.users;

-- 创建新触发器
CREATE TRIGGER users_updated_at_trigger
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_users_updated_at();

-- ============================================================================
-- Part 6: 验证和报告
-- ============================================================================

DO $$
DECLARE
    user_count INTEGER;
    auth_user_count INTEGER;
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.users;
    SELECT COUNT(*) INTO auth_user_count FROM auth.users;
    SELECT COUNT(*) INTO missing_count 
    FROM auth.users au 
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = au.id);

    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Auth Flow Fix Migration Completed!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'auth.users count: %', auth_user_count;
    RAISE NOTICE 'public.users count: %', user_count;
    RAISE NOTICE 'Missing users: %', missing_count;
    
    IF missing_count > 0 THEN
        RAISE WARNING 'Warning: % auth.users do not have public.users records', missing_count;
        RAISE NOTICE 'Run the migration again to create missing records';
    ELSE
        RAISE NOTICE 'Success: All auth.users have corresponding public.users records';
    END IF;
    
    RAISE NOTICE '=================================================';
END $$;

-- ============================================================================
-- Part 7: 测试触发器
-- ============================================================================

-- 注意: 以下测试代码仅用于验证，不会在生产环境执行
-- 如需测试，请在测试环境手动执行

/*
-- 测试1: 创建测试用户
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- 生成测试用户ID
    test_user_id := gen_random_uuid();
    
    -- 插入测试auth.users记录
    INSERT INTO auth.users (
        id,
        email,
        raw_user_meta_data,
        created_at,
        updated_at
    ) VALUES (
        test_user_id,
        'test_' || test_user_id || '@example.com',
        '{"full_name": "Test User", "avatar_url": "https://example.com/avatar.jpg"}'::jsonb,
        NOW(),
        NOW()
    );
    
    -- 等待触发器执行
    PERFORM pg_sleep(1);
    
    -- 验证public.users记录是否创建
    IF EXISTS (SELECT 1 FROM public.users WHERE id = test_user_id) THEN
        RAISE NOTICE 'Test PASSED: User record created successfully';
        
        -- 清理测试数据
        DELETE FROM auth.users WHERE id = test_user_id;
    ELSE
        RAISE WARNING 'Test FAILED: User record not created';
    END IF;
END $$;
*/

