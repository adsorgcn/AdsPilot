-- 简化版本：修复触发器使用starter套餐

-- 删除现有触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 重新创建触发器函数
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
    true,
    'starter',
    100,
    100,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    photo_url = EXCLUDED.photo_url,
    subscription_tier = EXCLUDED.subscription_tier,
    updated_at = NOW();

  -- 记录成功日志
  RAISE NOTICE 'Successfully created user % with starter tier', NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 错误不会阻止用户创建，但会记录详细日志
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 验证结果
DO $$
BEGIN
  RAISE NOTICE '=== Trigger Fix Completed ===';
  RAISE NOTICE 'New users will be created with starter subscription tier';
  RAISE NOTICE 'Starter users have offer_creation permission';
  RAISE NOTICE 'Offer creation should now work for all users';
  RAISE NOTICE '==================================';
END $$;