# 触发器修复执行指南

## 🎯 执行目标
更新Supabase数据库触发器，确保新用户注册时使用"starter"套餐而不是"trial"套餐。

## 📋 执行步骤

### 1. 打开Supabase SQL编辑器
1. 访问 https://supabase.com/dashboard
2. 选择Google-Monetize项目
3. 进入 SQL Editor → New query

### 2. 执行修复SQL脚本

#### 方法A: 执行完整脚本（推荐）
```sql
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
  RAISE NOTICE 'Starter users have offer_evaluation permission';
  RAISE NOTICE 'Offer creation should now work for all users';
  RAISE NOTICE '==================================';
END $$;
```

#### 方法B: 分步执行（如果完整脚本失败）

**步骤1: 删除现有触发器**
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

**步骤2: 重新创建函数**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
-- [完整函数代码同上]
$$;
```

**步骤3: 创建触发器**
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### 3. 验证修复结果

#### 检查触发器状态
```sql
SELECT
  tgname,
  tgrelid::regclass as table_name,
  tgfoid::regproc as function_name
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

#### 检查函数定义
```sql
SELECT
  proname,
  prosrc
FROM pg_proc
WHERE proname = 'handle_new_user';
```

#### 测试新用户注册
1. 使用新的Google账号注册
2. 检查public.users表中的subscription_tier
3. 确认是'starter'而不是'trial'

## ✅ 预期结果

执行成功后，你应该看到：

1. **触发器创建成功**: 不出现错误信息
2. **NOTICE日志**: 显示"Trigger Fix Completed"等成功信息
3. **新用户正确创建**: 新注册用户的subscription_tier为'starter'
4. **Offer创建功能正常**: Starter用户可以成功创建Offer

## ⚠️ 故障排除

### 如果出现权限错误
- 确保你使用的是项目所有者权限
- 检查SQL Editor中的权限设置

### 如果函数已存在错误
- 先执行 `DROP FUNCTION IF EXISTS public.handle_new_user();`
- 然后重新执行创建脚本

### 如果触发器创建失败
- 检查auth.users表是否存在
- 确认语法正确性
- 查看详细错误信息

## 📞 支持

如果执行过程中遇到问题：
1. 截图错误信息
2. 记录执行步骤
3. 联系技术支持

---

**重要性**: 这个修复确保了所有新用户都能正确获得starter套餐的权限，包括创建Offer的能力。