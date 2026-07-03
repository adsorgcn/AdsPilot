-- ============================================================================
-- 自动创建用户和默认组织的触发器
-- ============================================================================

-- 1. 删除旧触发器(如果存在)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. 创建或替换触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  default_org_id INTEGER;
  default_org_uuid UUID;
  user_display_name TEXT;
  user_email TEXT;
BEGIN
  user_email := NEW.email;

  -- 从Google OAuth提取显示名称
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(user_email, '@', 1)
  );

  -- 创建用户记录
  INSERT INTO public.users (
    id,
    display_name,
    photo_url,
    onboarded,
    created_at
  )
  VALUES (
    NEW.id,
    user_display_name,
    NEW.raw_user_meta_data->>'avatar_url',
    true,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 创建默认组织
  INSERT INTO public.organizations (
    name,
    logo_url,
    created_at
  )
  VALUES (
    user_display_name || '''s Organization',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  RETURNING id, uuid INTO default_org_id, default_org_uuid;

  -- 创建成员关系
  INSERT INTO public.memberships (
    user_id,
    organization_id,
    role,
    created_at
  )
  VALUES (
    NEW.id,
    default_org_id,
    2,
    NOW()
  );

  RAISE NOTICE 'Auto-created user % with organization %', NEW.id, default_org_uuid;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
