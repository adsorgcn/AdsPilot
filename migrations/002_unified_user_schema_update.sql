-- Migration 002: 统一用户Schema更新
--
-- 这个迁移更新Supabase数据库以匹配统一用户服务的架构设计
-- 添加权限管理、Token管理、订阅管理等表结构

-- 开启事务
BEGIN;

-- 1. 更新users表结构
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS organization_id UUID,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

-- 重命名subscription_tier为subscription_plan以保持一致性
DO $$
BEGIN
    -- 检查列是否存在且尚未重命名
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users'
            AND column_name = 'subscription_tier'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users'
            AND column_name = 'subscription_plan'
    ) THEN
        ALTER TABLE public.users
        RENAME COLUMN subscription_tier TO subscription_plan;

        RAISE NOTICE 'Column subscription_tier renamed to subscription_plan';
    END IF;
END $$;

-- 2. 创建用户权限表
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_admin BOOLEAN DEFAULT false,
    subscription_plan TEXT DEFAULT 'starter',
    can_use_ai BOOLEAN DEFAULT false,
    can_create_offers BOOLEAN DEFAULT true,
    can_manage_ads BOOLEAN DEFAULT false,
    can_access_analytics BOOLEAN DEFAULT false,
    max_offers_per_month INTEGER DEFAULT 10,
    max_tokens_per_month INTEGER DEFAULT 1000,
    can_export_data BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_plan ON public.user_permissions(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_user_permissions_admin ON public.user_permissions(is_admin);

-- 3. 创建Token余额表
CREATE TABLE IF NOT EXISTS public.user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0,
    reserved INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON public.user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_balance ON public.user_tokens(balance);

-- 4. 创建订阅表
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'starter',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
    is_trial BOOLEAN DEFAULT false,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    current_period_ends_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions(plan);

-- 5. 创建组织表
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);

-- 6. 创建用户组织关系表
CREATE TABLE IF NOT EXISTS public.user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, organization_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON public.user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON public.user_organizations(organization_id);

-- 7. 创建用户活动追踪表
CREATE TABLE IF NOT EXISTS public.user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('login', 'logout', 'offer_created', 'offer_evaluated', 'token_consumed', 'token_purchased', 'subscription_changed', 'feature_used', 'profile_updated')),
    description TEXT NOT NULL,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON public.user_activities(type);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON public.user_activities(created_at);

-- 8. 创建Token预留表
CREATE TABLE IF NOT EXISTS public.token_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    reference_id TEXT,
    status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'refunded', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes'),
    confirmed_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_token_reservations_user_id ON public.token_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_reservations_status ON public.token_reservations(status);
CREATE INDEX IF NOT EXISTS idx_token_reservations_expires_at ON public.token_reservations(expires_at);

-- 9. 数据迁移：将现有数据迁移到新结构

-- 迁移用户权限数据
INSERT INTO public.user_permissions (user_id, subscription_plan, can_create_offers, max_offers_per_month)
SELECT
    id as user_id,
    subscription_plan as subscription_plan,
    CASE
        WHEN subscription_plan IN ('professional', 'elite') THEN true
        ELSE true
    END as can_create_offers,
    CASE
        WHEN subscription_plan = 'starter' THEN 10
        WHEN subscription_plan = 'professional' THEN 50
        WHEN subscription_plan = 'elite' THEN 999
        ELSE 10
    END as max_offers_per_month
FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- 初始化Token余额
INSERT INTO public.user_tokens (user_id, balance)
SELECT
    id as user_id,
    COALESCE(token_balance, 0) as balance
FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- 创建订阅记录
INSERT INTO public.subscriptions (user_id, plan, is_trial)
SELECT
    id as user_id,
    subscription_plan as plan,
    false as is_trial
FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- 10. 更新现有用户的role字段
UPDATE public.users
SET role = 'user'
WHERE role IS NULL;

-- 11. 创建RLS策略以确保数据安全

-- 用户权限RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own permissions" ON public.user_permissions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own permissions" ON public.user_permissions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all permissions" ON public.user_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_permissions up
            WHERE up.user_id = auth.uid() AND up.is_admin = true
        )
    );

-- Token余额RLS
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tokens" ON public.user_tokens
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own tokens" ON public.user_tokens
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all tokens" ON public.user_tokens
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_permissions up
            WHERE up.user_id = auth.uid() AND up.is_admin = true
        )
    );

-- 订阅RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all subscriptions" ON public.subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_permissions up
            WHERE up.user_id = auth.uid() AND up.is_admin = true
        )
    );

-- 用户活动RLS
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own activities" ON public.user_activities
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own activities" ON public.user_activities
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all activities" ON public.user_activities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_permissions up
            WHERE up.user_id = auth.uid() AND up.is_admin = true
        )
    );

-- 12. 创建触发器以自动更新updated_at字段

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表创建触发器
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at
    BEFORE UPDATE ON public.user_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tokens_updated_at
    BEFORE UPDATE ON public.user_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13. 创建视图以简化查询

CREATE OR REPLACE VIEW public.user_complete_info AS
SELECT
    u.id,
    u.display_name,
    u.photo_url,
    u.role,
    u.onboarded,
    u.is_active,
    u.organization_id,
    u.created_at,
    u.updated_at,
    p.is_admin,
    p.subscription_plan,
    p.can_use_ai,
    p.can_create_offers,
    p.can_manage_ads,
    p.can_access_analytics,
    p.max_offers_per_month,
    p.max_tokens_per_month,
    p.can_export_data,
    t.balance,
    t.reserved,
    t.balance - t.reserved as available_tokens,
    s.plan as subscription_plan_db,
    s.status as subscription_status,
    s.is_trial,
    s.current_period_ends_at,
    o.name as organization_name,
    o.description as organization_description
FROM public.users u
LEFT JOIN public.user_permissions p ON u.id = p.user_id
LEFT JOIN public.user_tokens t ON u.id = t.user_id
LEFT JOIN public.subscriptions s ON u.id = s.user_id
LEFT JOIN public.organizations o ON u.organization_id = o.id;

-- 14. 创建统计函数

CREATE OR REPLACE FUNCTION public.get_user_stats(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_activities', (SELECT COUNT(*) FROM public.user_activities WHERE user_id = user_uuid),
        'login_count', (SELECT COUNT(*) FROM public.user_activities WHERE user_id = user_uuid AND type = 'login'),
        'last_login', (SELECT created_at FROM public.user_activities WHERE user_id = user_uuid AND type = 'login' ORDER BY created_at DESC LIMIT 1),
        'token_balance', (SELECT balance FROM public.user_tokens WHERE user_id = user_uuid),
        'available_tokens', (SELECT balance - reserved FROM public.user_tokens WHERE user_id = user_uuid),
        'subscription_status', (SELECT status FROM public.subscriptions WHERE user_id = user_uuid ORDER BY created_at DESC LIMIT 1),
        'permissions', (SELECT row_to_json(p.*) FROM public.user_permissions p WHERE p.user_id = user_uuid)
    ) INTO stats;

    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- 15. 数据验证约束

-- 确保Token余额不为负数
ALTER TABLE public.user_tokens
ADD CONSTRAINT check_balance_non_negative CHECK (balance >= 0);

ALTER TABLE public.user_tokens
ADD CONSTRAINT check_reserved_not_negative CHECK (reserved >= 0);

-- 确保预留金额不超过余额
ALTER TABLE public.user_tokens
ADD CONSTRAINT check_reserved_not_exceed_balance CHECK (reserved <= balance);

-- 确保预留金额为正数
ALTER TABLE public.token_reservations
ADD CONSTRAINT check_amount_positive CHECK (amount > 0);

-- 确保max_offers_per_month为正数
ALTER TABLE public.user_permissions
ADD CONSTRAINT check_max_offers_positive CHECK (max_offers_per_month > 0);

-- 16. 添加注释
COMMENT ON TABLE public.users IS '用户基础信息表';
COMMENT ON TABLE public.user_permissions IS '用户权限配置表';
COMMENT ON TABLE public.user_tokens IS '用户Token余额表';
COMMENT ON TABLE public.subscriptions IS '用户订阅信息表';
COMMENT ON TABLE public.organizations IS '组织信息表';
COMMENT ON TABLE public.user_organizations IS '用户-组织关系表';
COMMENT ON TABLE public.user_activities IS '用户活动追踪表';
COMMENT ON TABLE public.token_reservations IS 'Token预留记录表';

COMMENT ON COLUMN public.users.role IS '用户角色: user, admin';
COMMENT ON COLUMN public.users.organization_id IS '所属组织ID';
COMMENT ON COLUMN public.users.subscription_plan IS '订阅计划: starter, professional, elite';
COMMENT ON COLUMN public.user_permissions.can_use_ai IS '是否可以使用AI功能';
COMMENT ON COLUMN public.user_permissions.max_offers_per_month IS '每月最大Offer数量';
COMMENT ON COLUMN public.user_tokens.balance IS 'Token余额';
COMMENT ON COLUMN public.user_tokens.reserved IS '预留中的Token数量';
COMMENT ON COLUMN public.subscriptions.trial_ends_at IS '试用期结束时间';
COMMENT ON COLUMN public.subscriptions.current_period_ends_at IS '当前订阅周期结束时间';

-- 完成迁移
COMMIT;

-- 迁移后验证
DO $$
DECLARE
    table_count INTEGER;
    record_count INTEGER;
BEGIN
    -- 验证表是否创建成功
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('user_permissions', 'user_tokens', 'subscriptions', 'organizations', 'user_organizations', 'user_activities', 'token_reservations');

    RAISE NOTICE 'Created %d tables for unified user schema', table_count;

    -- 验证用户数据完整性
    SELECT COUNT(*) INTO record_count FROM public.users;
    RAISE NOTICE 'Found %d users in database', record_count;

    SELECT COUNT(*) INTO record_count FROM public.user_permissions;
    RAISE NOTICE 'Created %d user permission records', record_count;

    SELECT COUNT(*) INTO record_count FROM public.user_tokens;
    RAISE NOTICE 'Created %d user token records', record_count;

    SELECT COUNT(*) INTO record_count FROM public.subscriptions;
    RAISE NOTICE 'Created %d subscription records', record_count;

    -- 验证RLS策略
    SELECT COUNT(*) INTO record_count FROM pg_policies
    WHERE tablename IN ('user_permissions', 'user_tokens', 'subscriptions', 'user_activities');
    RAISE NOTICE 'Created %d RLS policies for data security', record_count;
END $$;