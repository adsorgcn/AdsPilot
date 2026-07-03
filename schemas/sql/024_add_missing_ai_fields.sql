-- 补充缺失的AI评估字段
-- 根据AIEvaluationResult结构补充完整的数据库字段

-- 添加缺失的AI评估字段
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_product_type TEXT;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_estimated_aov TEXT;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_search_insights JSONB;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_geo_insights JSONB;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_risk_assessment JSONB;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_seasonality_insights JSONB;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_conversion_insights JSONB;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_ltv_insights JSONB;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_profitability_insights JSONB;

-- 添加字段注释
COMMENT ON COLUMN offer_evaluations.ai_product_type IS 'AI识别的产品类型: Physical/Digital/Service/Hybrid';
COMMENT ON COLUMN offer_evaluations.ai_estimated_aov IS 'AI预估的客单价范围，如 "$50-$100" 或 "$200+"';
COMMENT ON COLUMN offer_evaluations.ai_search_insights IS 'AI搜索洞察: 有机搜索占比、品牌vs非品牌流量、搜索意图、SEO强度';
COMMENT ON COLUMN offer_evaluations.ai_geo_insights IS 'AI地理洞察: 主要市场分布、地域集中度、广告平台适配建议';
COMMENT ON COLUMN offer_evaluations.ai_risk_assessment IS 'AI风险评估: 流量风险、转化风险、竞争风险、整体风险等级、缓解措施';
COMMENT ON COLUMN offer_evaluations.ai_seasonality_insights IS 'AI季节性洞察: 当前时机评估、旺季分析、紧急程度、推广时机建议';
COMMENT ON COLUMN offer_evaluations.ai_conversion_insights IS 'AI转化路径分析: 结账复杂度、移动优化、信任信号、支付摩擦、预估转化率';
COMMENT ON COLUMN offer_evaluations.ai_ltv_insights IS 'AI客户终身价值: 复购潜力、购物车大小、交叉销售机会、LTV预估、LTV/CAC比率';
COMMENT ON COLUMN offer_evaluations.ai_profitability_insights IS 'AI盈利能力分析: 价格定位、毛利率估算、运费策略、盈亏平衡CPA、盈利前景';

-- 添加v2.5.0新增字段
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_competitor_insights JSONB;
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS ai_budget_recommendation JSONB;

COMMENT ON COLUMN offer_evaluations.ai_competitor_insights IS 'AI竞争对手分析: 市场饱和度、竞争压力、进入壁垒、差异化策略';
COMMENT ON COLUMN offer_evaluations.ai_budget_recommendation IS 'AI智能预算建议: 测试阶段预算、扩量阶段预算、ROAS触发条件、最大预算上限';

-- 更新现有字段注释（补充说明）
COMMENT ON COLUMN offer_evaluations.ai_traffic_insights IS 'AI流量洞察: 月访问量、增长趋势、跳出率、用户参与度、品牌忠诚度';
COMMENT ON COLUMN offer_evaluations.ai_ad_insights IS 'AI广告建议: 现有广告投入、竞争强度、推荐渠道、预算指导、创意策略';
