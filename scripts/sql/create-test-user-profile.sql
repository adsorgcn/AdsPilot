-- P0-1: 创建测试用户的user_profiles记录
--
-- 测试用户信息:
--   email: test-user@autoads.dev
--   user_id: 37fd3629-a06a-47c8-b33a-31944afaa14c
--
-- 执行方式:
--   1. 登录 Supabase Dashboard (https://supabase.com/dashboard)
--   2. 选择项目 (YOUR_SUPABASE_PROJECT)
--   3. 进入 SQL Editor
--   4. 复制以下SQL并执行
--
-- 预期结果:
--   - user_profiles表中创建一条记录
--   - 修复 406 错误 (Cannot coerce the result to a single JSON object)
--   - Dashboard统计卡片可以正常加载
--   - 订阅信息和Token余额正常显示

-- 检查用户是否已存在
SELECT
  user_id,
  subscription_tier,
  token_balance,
  created_at
FROM public.user_profiles
WHERE user_id = '37fd3629-a06a-47c8-b33a-31944afaa14c';

-- 如果上面查询返回空结果，执行以下INSERT
INSERT INTO public.user_profiles (
  user_id,
  subscription_tier,
  trial_end_date,
  token_balance,
  monthly_token_allocation,
  display_name,
  photo_url,
  onboarded,
  created_at,
  updated_at
)
VALUES (
  '37fd3629-a06a-47c8-b33a-31944afaa14c',
  'trial',                                    -- 试用版订阅
  (NOW() + INTERVAL '30 days')::TIMESTAMP,   -- 试用期到30天后
  10000,                                      -- 10000 tokens初始余额
  10000,                                      -- 每月10000 tokens配额
  'Test User',                                -- 显示名称
  NULL,                                       -- 头像URL (可选)
  true,                                       -- 已完成onboarding
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
  subscription_tier = EXCLUDED.subscription_tier,
  trial_end_date = EXCLUDED.trial_end_date,
  token_balance = EXCLUDED.token_balance,
  monthly_token_allocation = EXCLUDED.monthly_token_allocation,
  display_name = EXCLUDED.display_name,
  onboarded = EXCLUDED.onboarded,
  updated_at = NOW();

-- 验证插入结果
SELECT
  user_id,
  subscription_tier,
  trial_end_date,
  token_balance,
  monthly_token_allocation,
  display_name,
  onboarded,
  created_at,
  updated_at
FROM public.user_profiles
WHERE user_id = '37fd3629-a06a-47c8-b33a-31944afaa14c';

-- 预期输出示例:
--
-- user_id                              | subscription_tier | trial_end_date      | token_balance | monthly_token_allocation | display_name | onboarded | created_at                 | updated_at
-- -------------------------------------|-------------------|---------------------|---------------|--------------------------|--------------|-----------|----------------------------|---------------------------
-- 37fd3629-a06a-47c8-b33a-31944afaa14c | trial             | 2025-11-11 xx:xx:xx | 10000         | 10000                    | Test User    | true      | 2025-10-12 xx:xx:xx        | 2025-10-12 xx:xx:xx

-- 后续验证步骤:
-- 1. 在浏览器中访问: https://www.urlchecker.dev/dashboard
-- 2. 使用 test-user@autoads.dev 登录
-- 3. 检查 Dashboard 统计卡片是否正常显示
-- 4. 检查浏览器控制台是否还有 406 错误
-- 5. 检查订阅信息是否显示 "Trial - 30天剩余"
-- 6. 检查 Token 余额是否显示 "10000"
