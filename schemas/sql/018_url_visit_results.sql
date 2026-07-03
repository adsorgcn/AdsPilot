-- URL访问结果表
-- 用于存储browser-exec服务的URL访问结果，支持用户级别数据隔离

-- 确保 auth schema 及其 users 表存在（与 Supabase 兼容）
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY
);

DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE FUNCTION auth.uid() RETURNS uuid AS $f$ SELECT NULL::uuid; $f$ LANGUAGE sql STABLE';
  EXCEPTION
    WHEN duplicate_function THEN
      NULL;
  END;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY
);

-- 创建访问结果表
CREATE TABLE IF NOT EXISTS url_visit_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 用户关联（用于数据隔离）
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,

  -- 任务信息
  task_id VARCHAR(255),  -- 任务唯一标识
  batch_id VARCHAR(255), -- 批次ID（便于分组查询）

  -- URL信息
  source_url TEXT NOT NULL,  -- 原始URL
  source_url_hash VARCHAR(64) NOT NULL,  -- 原始URL的SHA256 hash，用于汇聚同一Offer URL的所有数据
  final_url TEXT,            -- 最终落地页URL

  -- 访问结果分类
  result_type VARCHAR(50) NOT NULL, -- 'success', 'failed', 'blocked', 'timeout', 'error'
  landing_page_type VARCHAR(50),    -- 'final', 'intermediate', 'error', 'suspended'

  -- 品牌和内容信息
  brand_name TEXT,
  page_title TEXT,
  domain VARCHAR(255),
  is_intermediate BOOLEAN DEFAULT false,

  -- 失败信息
  failure_reason TEXT,
  error_message TEXT,

  -- 性能指标
  total_duration_ms INTEGER,     -- 总耗时（毫秒）
  dns_duration_ms INTEGER,       -- DNS解析耗时
  connect_duration_ms INTEGER,   -- 连接耗时
  request_duration_ms INTEGER,   -- 请求耗时
  response_duration_ms INTEGER,  -- 响应耗时

  -- 流量消耗
  total_bytes_transferred BIGINT,   -- 总流量（字节）
  html_bytes INTEGER,               -- HTML大小
  css_bytes INTEGER,                -- CSS大小
  js_bytes INTEGER,                 -- JS大小
  image_bytes BIGINT,               -- 图片大小
  font_bytes INTEGER,               -- 字体大小

  -- 重定向信息
  redirect_count INTEGER DEFAULT 0,
  redirect_chain JSONB,             -- 重定向链 [{url, status}]

  -- 代理信息
  proxy_used VARCHAR(255),          -- 使用的代理IP（脱敏）
  proxy_country VARCHAR(10),        -- 代理国家代码

  -- 浏览器信息
  user_agent TEXT,
  viewport_size VARCHAR(50),

  -- 访问模式
  visit_mode VARCHAR(20),  -- 'evaluate', 'click', 'resolve', 'check'

  -- 检测结果
  cloudflare_challenge BOOLEAN DEFAULT false,
  captcha_detected BOOLEAN DEFAULT false,
  bot_detected BOOLEAN DEFAULT false,

  -- HTTP状态
  http_status_code INTEGER,

  -- 完整结果JSON（保留所有原始数据）
  raw_result JSONB,

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_url_visit_results_user_id ON url_visit_results(user_id);
CREATE INDEX IF NOT EXISTS idx_url_visit_results_account_id ON url_visit_results(account_id);
CREATE INDEX IF NOT EXISTS idx_url_visit_results_task_id ON url_visit_results(task_id);
CREATE INDEX IF NOT EXISTS idx_url_visit_results_batch_id ON url_visit_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_url_visit_results_result_type ON url_visit_results(result_type);
CREATE INDEX IF NOT EXISTS idx_url_visit_results_domain ON url_visit_results(domain);
CREATE INDEX IF NOT EXISTS idx_url_visit_results_created_at ON url_visit_results(created_at DESC);

-- 复合索引（常见查询组合）
CREATE INDEX IF NOT EXISTS idx_url_visit_results_user_batch ON url_visit_results(user_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_url_visit_results_user_created ON url_visit_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_url_visit_results_source_url_hash ON url_visit_results(source_url_hash);
CREATE INDEX IF NOT EXISTS idx_url_visit_results_user_url_hash ON url_visit_results(user_id, source_url_hash);

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_url_visit_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'url_visit_results_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER url_visit_results_updated_at
      BEFORE UPDATE ON url_visit_results
      FOR EACH ROW
      EXECUTE FUNCTION update_url_visit_results_updated_at();';
  END IF;
END;
$$;

-- 行级安全策略（RLS）- 用户只能访问自己的数据
ALTER TABLE url_visit_results ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'url_visit_results'
      AND policyname = 'Users can view their own visit results'
  ) THEN
    EXECUTE $$CREATE POLICY "Users can view their own visit results"
      ON url_visit_results
      FOR SELECT
      USING (auth.uid() = user_id);$$;
  END IF;
END;
$do$;

-- 用户可以插入自己的结果
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'url_visit_results'
      AND policyname = 'Users can insert their own visit results'
  ) THEN
    EXECUTE $$CREATE POLICY "Users can insert their own visit results"
      ON url_visit_results
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);$$;
  END IF;
END;
$do$;

-- 用户可以更新自己的结果
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'url_visit_results'
      AND policyname = 'Users can update their own visit results'
  ) THEN
    EXECUTE $$CREATE POLICY "Users can update their own visit results"
      ON url_visit_results
      FOR UPDATE
      USING (auth.uid() = user_id);$$;
  END IF;
END;
$do$;

-- 用户可以删除自己的结果
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'url_visit_results'
      AND policyname = 'Users can delete their own visit results'
  ) THEN
    EXECUTE $$CREATE POLICY "Users can delete their own visit results"
      ON url_visit_results
      FOR DELETE
      USING (auth.uid() = user_id);$$;
  END IF;
END;
$do$;

-- 服务角色可以访问所有数据（用于后台服务）
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'url_visit_results'
      AND policyname = 'Service role can access all visit results'
  ) THEN
    EXECUTE $$CREATE POLICY "Service role can access all visit results"
      ON url_visit_results
      FOR ALL
      USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
      );$$;
  END IF;
END;
$do$;

-- 创建视图：用于前端展示的简化数据
CREATE OR REPLACE VIEW url_visit_results_summary AS
SELECT
  id,
  user_id,
  account_id,
  task_id,
  batch_id,
  source_url,
  final_url,
  result_type,
  landing_page_type,
  brand_name,
  page_title,
  domain,
  is_intermediate,
  failure_reason,
  total_duration_ms,
  total_bytes_transferred,
  redirect_count,
  http_status_code,
  cloudflare_challenge,
  captcha_detected,
  bot_detected,
  created_at
FROM url_visit_results;

-- 创建统计视图：按批次汇总
CREATE OR REPLACE VIEW url_visit_batch_stats AS
SELECT
  batch_id,
  user_id,
  account_id,
  COUNT(*) as total_visits,
  COUNT(*) FILTER (WHERE result_type = 'success') as successful_visits,
  COUNT(*) FILTER (WHERE result_type = 'failed') as failed_visits,
  COUNT(*) FILTER (WHERE result_type = 'blocked') as blocked_visits,
  COUNT(*) FILTER (WHERE landing_page_type = 'final') as final_landings,
  COUNT(*) FILTER (WHERE landing_page_type = 'intermediate') as intermediate_pages,
  COUNT(*) FILTER (WHERE landing_page_type = 'error') as error_pages,
  ROUND(AVG(total_duration_ms)) as avg_duration_ms,
  SUM(total_bytes_transferred) as total_bytes,
  COUNT(*) FILTER (WHERE cloudflare_challenge = true) as cloudflare_challenges,
  MIN(created_at) as batch_start_time,
  MAX(created_at) as batch_end_time
FROM url_visit_results
WHERE batch_id IS NOT NULL
GROUP BY batch_id, user_id, account_id;

-- 为视图也添加RLS
ALTER VIEW url_visit_results_summary SET (security_invoker = true);
ALTER VIEW url_visit_batch_stats SET (security_invoker = true);

-- 添加注释
COMMENT ON TABLE url_visit_results IS 'URL访问结果表，存储browser-exec服务的URL访问详细结果';
COMMENT ON COLUMN url_visit_results.result_type IS '访问结果类型：success=成功, failed=失败, blocked=被拦截, timeout=超时, error=错误';
COMMENT ON COLUMN url_visit_results.landing_page_type IS '落地页类型：final=最终落地页, intermediate=中间页, error=错误页, suspended=账号暂停页';
COMMENT ON COLUMN url_visit_results.total_bytes_transferred IS '总流量消耗（字节），用于成本分析';
COMMENT ON COLUMN url_visit_results.raw_result IS '完整的原始结果JSON，保留所有细节以便后续分析';
