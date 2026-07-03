# 数据库迁移执行指南

由于Supabase的权限限制,需要通过Supabase Dashboard的SQL编辑器手动执行迁移脚本。

## 执行步骤

### 1. 访问Supabase SQL编辑器

访问: https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT/sql/new

### 2. 执行触发器创建脚本

复制并执行 `20250109_auto_create_user_on_signup.sql` 的内容

### 3. 执行监控脚本

复制并执行 `20250109_trigger_monitoring.sql` 的内容

### 4. 验证触发器

执行以下SQL验证触发器已成功创建:

```sql
-- 检查触发器是否存在
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 检查函数是否存在
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
  AND routine_schema = 'public';
```

### 5. 测试触发器(可选)

```sql
-- 查看现有测试数据
SELECT COUNT(*) FROM auth.users;
SELECT COUNT(*) FROM public.users;
SELECT COUNT(*) FROM public.organizations;

-- 注意:不要在生产环境执行测试插入!
```

## 常见问题

### Q: 出现权限错误怎么办?
A: 确保在Supabase Dashboard中以项目所有者身份登录执行。

### Q: 如何回滚?
A: 执行以下SQL:
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.trigger_execution_logs;
```

### Q: 触发器会影响现有用户吗?
A: 不会。触发器只在新用户注册时触发(AFTER INSERT)。
