-- ============================================================================
-- 触发器执行监控
-- ============================================================================

-- 创建触发器执行日志表
CREATE TABLE IF NOT EXISTS public.trigger_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    trigger_name TEXT NOT NULL,
    user_id UUID NOT NULL,
    status TEXT NOT NULL, -- 'success' or 'error'
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_trigger_logs_user_id ON public.trigger_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_created_at ON public.trigger_execution_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_trigger_logs_status ON public.trigger_execution_logs(status);

-- 更新触发器函数以记录日志
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
  start_time TIMESTAMPTZ;
  execution_time INTEGER;
BEGIN
  start_time := clock_timestamp();

  BEGIN
    -- 原有逻辑...
    user_email := NEW.email;
    user_display_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(user_email, '@', 1)
    );

    INSERT INTO public.users (id, display_name, photo_url, onboarded, created_at)
    VALUES (
      NEW.id,
      user_display_name,
      NEW.raw_user_meta_data->>'avatar_url',
      true,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organizations (name, logo_url, created_at)
    VALUES (
      user_display_name || '''s Organization',
      NEW.raw_user_meta_data->>'avatar_url',
      NOW()
    )
    RETURNING id, uuid INTO default_org_id, default_org_uuid;

    INSERT INTO public.memberships (user_id, organization_id, role, created_at)
    VALUES (NEW.id, default_org_id, 2, NOW());

    -- 计算执行时间
    execution_time := EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::INTEGER;

    -- 记录成功日志
    INSERT INTO public.trigger_execution_logs (
      trigger_name,
      user_id,
      status,
      execution_time_ms,
      created_at
    )
    VALUES (
      'on_auth_user_created',
      NEW.id,
      'success',
      execution_time,
      NOW()
    );

    RETURN NEW;

  EXCEPTION
    WHEN OTHERS THEN
      -- 计算执行时间
      execution_time := EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::INTEGER;

      -- 记录错误日志
      INSERT INTO public.trigger_execution_logs (
        trigger_name,
        user_id,
        status,
        error_message,
        execution_time_ms,
        created_at
      )
      VALUES (
        'on_auth_user_created',
        NEW.id,
        'error',
        SQLERRM,
        execution_time,
        NOW()
      );

      -- 不阻止用户创建
      RETURN NEW;
  END;
END;
$$;

-- 授权
GRANT USAGE ON SCHEMA public TO postgres, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
