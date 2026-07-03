-- Offer评估功能数据库Schema
-- 包括：评估记录表、扩展Offer表、AI评估历史表

-- 1. 扩展Offer表，添加品牌名相关字段
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS brand_name_source VARCHAR(20);  -- 'manual' | 'auto_extracted' | 'domain_fallback'
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS brand_name_confidence FLOAT;

-- 添加注释
COMMENT ON COLUMN "Offer".brand_name IS '品牌名称';
COMMENT ON COLUMN "Offer".brand_name_source IS '品牌名来源: manual(用户手动), auto_extracted(自动提取), domain_fallback(域名fallback)';
COMMENT ON COLUMN "Offer".brand_name_confidence IS '品牌名提取置信度 (0.0-1.0)';

-- 迁移前清理可能存在的旧视图，避免列类型变更冲突
DROP VIEW IF EXISTS offer_evaluations_latest;
DROP VIEW IF EXISTS offer_evaluation_stats;

-- 2. 创建Offer评估记录表
CREATE TABLE IF NOT EXISTS offer_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 关联
  user_id UUID NOT NULL,  -- 关联auth.users，但不设置外键（Firebase Auth在外部）
  offer_id UUID NOT NULL REFERENCES "Offer"(id) ON DELETE CASCADE,

  -- Offer URL Hash (SHA256汇聚key)
  offer_url_hash VARCHAR(64) NOT NULL,

  -- 评估类型
  evaluation_type VARCHAR(20) NOT NULL CHECK (evaluation_type IN ('basic', 'ai')),

  -- 落地页信息
  landing_page_url TEXT,
  domain VARCHAR(255),
  brand_name TEXT,
  brand_extraction_confidence FLOAT,

  -- SimilarWeb数据
  similarweb_data JSONB,
  similarweb_cached BOOLEAN DEFAULT false,
  similarweb_fetched_at TIMESTAMP WITH TIME ZONE,

  -- AI评估结果 (仅evaluation_type='ai'时有值)
  ai_recommendation_score INTEGER CHECK (ai_recommendation_score >= 0 AND ai_recommendation_score <= 100),
  ai_reasons JSONB,  -- 数组: ["reason1", "reason2", "reason3"]
  ai_industry TEXT,
  ai_traffic_insights JSONB,
  ai_ad_insights JSONB,

  -- Token消耗
  tokens_consumed INTEGER NOT NULL DEFAULT 0,

  -- 状态
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  error_message TEXT,
  error_code VARCHAR(50),

  -- 时间戳
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offer_evaluations'
      AND column_name = 'offer_url_hash'
  ) THEN
    ALTER TABLE offer_evaluations
      ADD COLUMN offer_url_hash VARCHAR(64);

    UPDATE offer_evaluations
    SET offer_url_hash = md5(COALESCE(offer_id::text, id::text))
    WHERE offer_url_hash IS NULL;

    ALTER TABLE offer_evaluations
      ALTER COLUMN offer_url_hash SET NOT NULL;
  END IF;
END;
$do$;

ALTER TABLE offer_evaluations
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- 增量补列：evaluation_type 及其约束
ALTER TABLE offer_evaluations
  ADD COLUMN IF NOT EXISTS evaluation_type VARCHAR(20);

ALTER TABLE offer_evaluations
  ALTER COLUMN evaluation_type TYPE VARCHAR(20)
  USING evaluation_type::text;

UPDATE offer_evaluations
SET evaluation_type = COALESCE(NULLIF(evaluation_type::text, ''), 'basic')
WHERE evaluation_type IS NULL OR evaluation_type::text = '';

ALTER TABLE offer_evaluations
  ALTER COLUMN evaluation_type SET DEFAULT 'basic';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'offer_evaluations'::regclass
      AND conname = 'offer_evaluations_evaluation_type_check'
  ) THEN
    ALTER TABLE offer_evaluations
      ADD CONSTRAINT offer_evaluations_evaluation_type_check
      CHECK (evaluation_type IN ('basic', 'ai'));
  END IF;
END;
$$;

ALTER TABLE offer_evaluations
  ALTER COLUMN evaluation_type SET NOT NULL;

-- 兼容旧表缺失的可选字段
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS landing_page_url TEXT;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS brand_extraction_confidence FLOAT;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS similarweb_data JSONB;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS similarweb_cached BOOLEAN DEFAULT false;
UPDATE offer_evaluations SET similarweb_cached = COALESCE(similarweb_cached, false);
ALTER TABLE offer_evaluations ALTER COLUMN similarweb_cached SET DEFAULT false;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS similarweb_fetched_at TIMESTAMPTZ;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_recommendation_score INTEGER;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_reasons JSONB;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_industry TEXT;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_traffic_insights JSONB;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_ad_insights JSONB;

-- tokens_consumed 列：默认0且不可为空
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS tokens_consumed INTEGER DEFAULT 0;
UPDATE offer_evaluations SET tokens_consumed = COALESCE(tokens_consumed, 0);
ALTER TABLE offer_evaluations ALTER COLUMN tokens_consumed SET DEFAULT 0;
ALTER TABLE offer_evaluations ALTER COLUMN tokens_consumed SET NOT NULL;

-- status 列：默认 pending + 校验
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS status VARCHAR(20);

ALTER TABLE offer_evaluations
  ALTER COLUMN status TYPE VARCHAR(20)
  USING status::text;

UPDATE offer_evaluations SET status = COALESCE(NULLIF(status::text, ''), 'pending');
ALTER TABLE offer_evaluations ALTER COLUMN status SET DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'offer_evaluations'::regclass
      AND conname = 'offer_evaluations_status_check'
  ) THEN
    ALTER TABLE offer_evaluations
      ADD CONSTRAINT offer_evaluations_status_check
      CHECK (status IN ('pending', 'processing', 'success', 'failed'));
  END IF;
END;
$$;

-- 兼容其他非必填字段
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS error_code VARCHAR(50);
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_user_id ON offer_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_offer_id ON offer_evaluations(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_url_hash ON offer_evaluations(offer_url_hash);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_status ON offer_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_type ON offer_evaluations(evaluation_type);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_created_at ON offer_evaluations(created_at DESC);

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_offer_type ON offer_evaluations(offer_id, evaluation_type);
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_user_status ON offer_evaluations(user_id, status);

-- 添加注释
COMMENT ON TABLE offer_evaluations IS 'Offer评估记录表，存储普通评估和AI评估结果';
COMMENT ON COLUMN offer_evaluations.offer_url_hash IS 'Offer URL的SHA256 hash，用于汇聚同一URL的所有评估数据';
COMMENT ON COLUMN offer_evaluations.evaluation_type IS '评估类型: basic(普通评估1token), ai(AI评估2tokens)';
COMMENT ON COLUMN offer_evaluations.tokens_consumed IS '本次评估消耗的tokens数量';
COMMENT ON COLUMN offer_evaluations.similarweb_cached IS '是否从Redis缓存读取的SimilarWeb数据';

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_offer_evaluations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'offer_evaluations' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE offer_evaluations ADD COLUMN user_id UUID;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'offer_evaluations_updated_at'
  ) THEN
    EXECUTE 'DROP TRIGGER offer_evaluations_updated_at ON offer_evaluations';
  END IF;

  EXECUTE 'CREATE TRIGGER offer_evaluations_updated_at
    BEFORE UPDATE ON offer_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_offer_evaluations_updated_at();';

  IF NOT EXISTS (
    SELECT 1 FROM offer_evaluations WHERE user_id IS NULL
  ) THEN
    EXECUTE 'ALTER TABLE offer_evaluations ALTER COLUMN user_id SET NOT NULL';
  END IF;
END;
$$;

-- 3. 创建AI评估历史表 (用于分析和优化Prompt)
CREATE TABLE IF NOT EXISTS ai_evaluation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES offer_evaluations(id) ON DELETE CASCADE,

  -- Prompt和响应
  prompt_text TEXT NOT NULL,
  prompt_version VARCHAR(20) DEFAULT 'v1.0',
  response_raw TEXT NOT NULL,
  response_parsed JSONB,

  -- 性能指标
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  model_version VARCHAR(50) DEFAULT 'gemini-1.5-flash',

  -- 结果质量
  parse_success BOOLEAN DEFAULT true,
  parse_error TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_history_evaluation_id ON ai_evaluation_history(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_created_at ON ai_evaluation_history(created_at DESC);

COMMENT ON TABLE ai_evaluation_history IS 'AI评估历史，用于监控Gemini API性能和优化Prompt';

-- 4. 创建视图：最新评估结果 (方便前端查询)
CREATE OR REPLACE VIEW offer_evaluations_latest AS
SELECT DISTINCT ON (offer_id, evaluation_type)
  e.id,
  e.user_id,
  e.offer_id,
  e.evaluation_type,
  e.domain,
  e.brand_name,
  e.similarweb_data,
  e.ai_recommendation_score,
  e.ai_reasons,
  e.ai_industry,
  e.ai_traffic_insights,
  e.ai_ad_insights,
  e.status,
  e.completed_at,
  ol.name AS offer_name,
  COALESCE(ol.original_url_camel, ol.original_url_snake) AS offer_url
FROM offer_evaluations e
LEFT JOIN (
  SELECT
    id,
    name,
    to_jsonb(o) ->> 'originalUrl' AS original_url_camel,
    to_jsonb(o) ->> 'original_url' AS original_url_snake
  FROM "Offer" o
) AS ol ON e.offer_id::text = ol.id
WHERE e.status = 'success'
ORDER BY e.offer_id, e.evaluation_type, e.completed_at DESC;

COMMENT ON VIEW offer_evaluations_latest IS 'Offer最新评估结果视图，每个Offer的每种类型只保留最新一条成功记录';

-- 5. 创建汇总视图：Offer评估统计
CREATE OR REPLACE VIEW offer_evaluation_stats AS
SELECT
  offer_id,
  COUNT(*) as total_evaluations,
  COUNT(*) FILTER (WHERE evaluation_type = 'basic') as basic_evaluations,
  COUNT(*) FILTER (WHERE evaluation_type = 'ai') as ai_evaluations,
  COUNT(*) FILTER (WHERE status = 'success') as successful_evaluations,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_evaluations,
  SUM(tokens_consumed) as total_tokens_consumed,
  MAX(completed_at) FILTER (WHERE status = 'success' AND evaluation_type = 'basic') as last_basic_evaluation_at,
  MAX(completed_at) FILTER (WHERE status = 'success' AND evaluation_type = 'ai') as last_ai_evaluation_at
FROM offer_evaluations
GROUP BY offer_id;

COMMENT ON VIEW offer_evaluation_stats IS 'Offer评估统计视图，展示每个Offer的评估次数、成功率、Token消耗等';

-- 6. Row Level Security (RLS) - 用户级别数据隔离
ALTER TABLE offer_evaluations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own evaluations' AND tablename = 'offer_evaluations') THEN
    EXECUTE 'DROP POLICY "Users can view their own evaluations" ON offer_evaluations';
  END IF;
END;
$$;

-- 用户只能查看自己的评估记录
CREATE POLICY "Users can view their own evaluations"
  ON offer_evaluations
  FOR SELECT
  USING (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- 用户只能创建自己的评估记录
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own evaluations' AND tablename = 'offer_evaluations') THEN
    EXECUTE 'DROP POLICY "Users can insert their own evaluations" ON offer_evaluations';
  END IF;
END;
$$;

CREATE POLICY "Users can insert their own evaluations"
  ON offer_evaluations
  FOR INSERT
  WITH CHECK (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- 用户只能更新自己的评估记录
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own evaluations' AND tablename = 'offer_evaluations') THEN
    EXECUTE 'DROP POLICY "Users can update their own evaluations" ON offer_evaluations';
  END IF;
END;
$$;

CREATE POLICY "Users can update their own evaluations"
  ON offer_evaluations
  FOR UPDATE
  USING (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Service role可以访问所有数据
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can access all evaluations' AND tablename = 'offer_evaluations') THEN
    EXECUTE 'DROP POLICY "Service role can access all evaluations" ON offer_evaluations';
  END IF;
END;
$$;

CREATE POLICY "Service role can access all evaluations"
  ON offer_evaluations
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- AI评估历史表的RLS (通过evaluation_id关联)
ALTER TABLE ai_evaluation_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own ai history' AND tablename = 'ai_evaluation_history') THEN
    EXECUTE 'DROP POLICY "Users can view their own ai history" ON ai_evaluation_history';
  END IF;
END;
$$;

CREATE POLICY "Users can view their own ai history"
  ON ai_evaluation_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM offer_evaluations
      WHERE offer_evaluations.id = ai_evaluation_history.evaluation_id
      AND offer_evaluations.user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can access all ai history' AND tablename = 'ai_evaluation_history') THEN
    EXECUTE 'DROP POLICY "Service role can access all ai history" ON ai_evaluation_history';
  END IF;
END;
$$;

CREATE POLICY "Service role can access all ai history"
  ON ai_evaluation_history
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
