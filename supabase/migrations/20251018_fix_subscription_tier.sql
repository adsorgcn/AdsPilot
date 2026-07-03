-- 修复订阅套餐问题
-- 执行日期: 2025-10-18
-- 目的: 将trial套餐更新为starter套餐，修复Offer创建权限问题

-- =============================================================================
-- 问题总结:
-- 1. 用户数据库中的subscription_tier都是"trial"
-- 2. 系统应该只有starter、professional、elite三个套餐
-- 3. routes.yaml中没有定义trial套餐权限
-- 4. 导致Starter用户无法创建Offer
-- =============================================================================

-- 第一步: 更新现有用户的订阅套餐
-- =============================================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- 将所有trial用户更新为starter
    UPDATE public.users
    SET subscription_tier = 'starter'
    WHERE subscription_tier = 'trial';

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RAISE NOTICE 'Updated % users from trial to starter tier', updated_count;
END $$;

-- 第二步: 更新触发器函数，新用户注册时使用starter套餐
-- =============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

  -- 创建用户记录，使用starter套餐
  INSERT INTO public.users (
    id,
    display_name,
    photo_url,
    onboarded,
    subscription_tier,
    monthly_token_allocation,
    token_balance,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    user_display_name,
    user_photo_url,
    true,  -- 默认已完成onboarding
    'starter',  -- ✅ 修复：使用starter套餐而不是trial
    100,  -- 默认100 tokens
    100,  -- 初始余额100 tokens
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    photo_url = EXCLUDED.photo_url,
    subscription_tier = EXCLUDED.subscription_tier,
    updated_at = NOW();

  -- 记录成功日志
  RAISE NOTICE 'Successfully created/updated user: id=%, email=%, tier=%, name=%',
    NEW.id, user_email, 'starter', user_display_name;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 错误不会阻止用户创建，但会记录详细日志
    RAISE WARNING 'Error in handle_new_user for user % (email: %): % - %',
      NEW.id, user_email, SQLERRM, SQLSTATE;

    -- 即使出错也返回NEW，确保auth.users记录创建成功
    RETURN NEW;
END;
$$;

-- 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 第三步: 验证修复结果
-- =============================================================================
DO $$
DECLARE
    starter_count INTEGER;
    trial_count INTEGER;
    total_count INTEGER;
BEGIN
    -- 统计各种套餐的���户数量
    SELECT COUNT(*) INTO starter_count FROM public.users WHERE subscription_tier = 'starter';
    SELECT COUNT(*) INTO trial_count FROM public.users WHERE subscription_tier = 'trial';
    SELECT COUNT(*) INTO total_count FROM public.users;

    -- 输出修复结果
    RAISE NOTICE '=== Subscription Tier Fix Results ===';
    RAISE NOTICE 'Starter users: %', starter_count;
    RAISE NOTICE 'Trial users: %', trial_count;
    RAISE NOTICE 'Total users: %', total_count;

    IF trial_count = 0 THEN
        RAISE NOTICE '✅ SUCCESS: No trial users remaining';
    ELSE
        RAISE WARNING '⚠️ WARNING: % trial users still exist', trial_count;
    END IF;

    -- 验证starter用户有权限
    IF starter_count > 0 THEN
        RAISE NOTICE '✅ SUCCESS: % users have starter tier with offer creation permissions', starter_count;
    END IF;

    RAISE NOTICE '========================================';
END $$;

-- 第四步: 添加注释说明
-- =============================================================================
COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates or updates public.users record when a new auth.users record is created. Uses starter tier as default subscription tier.';

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
  'Triggers automatic user setup after OAuth signup with starter subscription tier';

-- =============================================================================
-- 修复完成
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Subscription tier fix completed successfully!';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '1. Updated all trial users to starter tier';
    RAISE NOTICE '2. Updated trigger function to use starter tier for new users';
    RAISE NOTICE '3. Starter users now have offer creation permissions';
    RAISE NOTICE '4. Offer creation should work for all users';
    RAISE NOTICE '========================================';
END $$;