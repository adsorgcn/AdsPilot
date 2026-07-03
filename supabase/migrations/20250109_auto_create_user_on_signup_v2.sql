-- ============================================================================
-- 自动创建用户和默认组织的触发器 (兼容版本)
-- ============================================================================

-- 1. 创建触发器函数
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
  -- 从auth.users提取用户信息
  user_email := NEW.email;

  -- 尝试从Google OAuth metadata提取显示名称
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(user_email, '@', 1)  -- 使用邮箱前缀作为fallback
  );

  -- 2. 创建public.users记录
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
    NEW.raw_user_meta_data->>'avatar_url',  -- Google头像
    true,  -- 标记为已完成onboarding
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 3. 创建默认组织(使用用户名称)
  INSERT INTO public.organizations (
    name,
    logo_url,
    created_at
  )
  VALUES (
    user_display_name || '''s Organization',  -- "张三's Organization"
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  RETURNING id, uuid INTO default_org_id, default_org_uuid;

  -- 4. 创建成员关系(owner角色)
  INSERT INTO public.memberships (
    user_id,
    organization_id,
    role,
    created_at
  )
  VALUES (
    NEW.id,
    default_org_id,
    2,  -- 2 = owner
    NOW()
  );

  -- 5. 记录日志(可选)
  RAISE NOTICE 'Auto-created user % with organization %', NEW.id, default_org_uuid;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 记录错误但不阻止用户创建
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates public.users record, default organization, and membership when a new auth.users record is created';

-- 2. 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
  'Triggers automatic user setup after Google OAuth signup';
