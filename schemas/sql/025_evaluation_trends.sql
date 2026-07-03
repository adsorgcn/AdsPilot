-- AI评估历史趋势分析视图
-- 用于对比同一Offer的多次评估结果，识别改进趋势

-- 1. 评估趋势视图 (包含分数变化和关键指标对比)
CREATE OR REPLACE VIEW offer_evaluation_trends AS
SELECT
    e.id,
    e.offer_id,
    e.user_id,
    e.evaluation_type,
    e.ai_recommendation_score as current_score,
    LAG(e.ai_recommendation_score) OVER (
        PARTITION BY e.offer_id, e.evaluation_type
        ORDER BY e.created_at
    ) as previous_score,
    e.ai_recommendation_score - LAG(e.ai_recommendation_score) OVER (
        PARTITION BY e.offer_id, e.evaluation_type
        ORDER BY e.created_at
    ) as score_delta,
    e.ai_industry,
    e.ai_product_type,

    -- 提取关键指标进行对比
    (e.ai_conversion_insights->>'estimatedCVR') as current_cvr,
    LAG(e.ai_conversion_insights->>'estimatedCVR') OVER (
        PARTITION BY e.offer_id, e.evaluation_type
        ORDER BY e.created_at
    ) as previous_cvr,

    (e.ai_ltv_insights->>'estimatedLTV') as current_ltv,
    LAG(e.ai_ltv_insights->>'estimatedLTV') OVER (
        PARTITION BY e.offer_id, e.evaluation_type
        ORDER BY e.created_at
    ) as previous_ltv,

    (e.ai_profitability_insights->>'breakEvenCPA') as current_break_even_cpa,
    LAG(e.ai_profitability_insights->>'breakEvenCPA') OVER (
        PARTITION BY e.offer_id, e.evaluation_type
        ORDER BY e.created_at
    ) as previous_break_even_cpa,

    (e.ai_seasonality_insights->>'currentTiming') as current_timing,
    LAG(e.ai_seasonality_insights->>'currentTiming') OVER (
        PARTITION BY e.offer_id, e.evaluation_type
        ORDER BY e.created_at
    ) as previous_timing,

    e.created_at as evaluation_date,
    LAG(e.created_at) OVER (
        PARTITION BY e.offer_id, e.evaluation_type
        ORDER BY e.created_at
    ) as previous_evaluation_date,

    -- 计算评估间隔天数
    EXTRACT(DAY FROM (e.created_at - LAG(e.created_at) OVER (
        PARTITION BY e.offer_id, e.evaluation_type
        ORDER BY e.created_at
    ))) as days_since_last_eval

FROM offer_evaluations e
WHERE e.status = 'success'
  AND e.evaluation_type = 'ai'
  AND e.ai_recommendation_score IS NOT NULL
ORDER BY e.offer_id, e.created_at DESC;

COMMENT ON VIEW offer_evaluation_trends IS 'AI评估历史趋势视图，显示分数变化、关键指标对比和评估间隔';

-- 2. 创建评估统计聚合视图
CREATE OR REPLACE VIEW offer_evaluation_summary AS
SELECT
    offer_id,
    evaluation_type,
    COUNT(*) as total_evaluations,
    MAX(ai_recommendation_score) as highest_score,
    MIN(ai_recommendation_score) as lowest_score,
    AVG(ai_recommendation_score)::int as avg_score,
    MAX(ai_recommendation_score) - MIN(ai_recommendation_score) as score_range,

    -- 最新评估信息
    (SELECT ai_recommendation_score
     FROM offer_evaluations e2
     WHERE e2.offer_id = e.offer_id
       AND e2.evaluation_type = e.evaluation_type
       AND e2.status = 'success'
     ORDER BY e2.created_at DESC
     LIMIT 1) as latest_score,

    (SELECT created_at
     FROM offer_evaluations e2
     WHERE e2.offer_id = e.offer_id
       AND e2.evaluation_type = e.evaluation_type
       AND e2.status = 'success'
     ORDER BY e2.created_at DESC
     LIMIT 1) as latest_evaluation_date,

    -- 趋势判断 (improving/stable/declining)
    CASE
        WHEN (SELECT ai_recommendation_score
              FROM offer_evaluations e2
              WHERE e2.offer_id = e.offer_id
                AND e2.evaluation_type = e.evaluation_type
                AND e2.status = 'success'
              ORDER BY e2.created_at DESC
              LIMIT 1) >
             (SELECT ai_recommendation_score
              FROM offer_evaluations e2
              WHERE e2.offer_id = e.offer_id
                AND e2.evaluation_type = e.evaluation_type
                AND e2.status = 'success'
              ORDER BY e2.created_at DESC
              LIMIT 1 OFFSET 1)
        THEN 'improving'
        WHEN (SELECT ai_recommendation_score
              FROM offer_evaluations e2
              WHERE e2.offer_id = e.offer_id
                AND e2.evaluation_type = e.evaluation_type
                AND e2.status = 'success'
              ORDER BY e2.created_at DESC
              LIMIT 1) <
             (SELECT ai_recommendation_score
              FROM offer_evaluations e2
              WHERE e2.offer_id = e.offer_id
                AND e2.evaluation_type = e.evaluation_type
                AND e2.status = 'success'
              ORDER BY e2.created_at DESC
              LIMIT 1 OFFSET 1)
        THEN 'declining'
        ELSE 'stable'
    END as trend_direction

FROM offer_evaluations e
WHERE e.status = 'success'
  AND e.evaluation_type = 'ai'
GROUP BY e.offer_id, e.evaluation_type;

COMMENT ON VIEW offer_evaluation_summary IS 'Offer评估统计摘要，包含最高/最低/平均分、趋势方向判断';

-- 3. 创建获取趋势对比的函数
CREATE OR REPLACE FUNCTION get_evaluation_trend_comparison(
    p_offer_id UUID,
    p_evaluation_type VARCHAR DEFAULT 'ai'
)
RETURNS TABLE (
    evaluation_id UUID,
    score_current INT,
    score_previous INT,
    score_change INT,
    score_change_pct NUMERIC,
    cvr_current TEXT,
    cvr_previous TEXT,
    ltv_current TEXT,
    ltv_previous TEXT,
    timing_current TEXT,
    timing_previous TEXT,
    evaluation_date TIMESTAMPTZ,
    days_since_previous INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.current_score,
        t.previous_score,
        t.score_delta,
        CASE
            WHEN t.previous_score > 0 THEN
                ROUND((t.score_delta::numeric / t.previous_score) * 100, 1)
            ELSE NULL
        END as score_change_percentage,
        t.current_cvr,
        t.previous_cvr,
        t.current_ltv,
        t.previous_ltv,
        t.current_timing,
        t.previous_timing,
        t.evaluation_date,
        t.days_since_last_eval::int
    FROM offer_evaluation_trends t
    WHERE t.offer_id = p_offer_id
      AND t.evaluation_type = p_evaluation_type
      AND t.previous_score IS NOT NULL  -- 只返回有对比数据的记录
    ORDER BY t.evaluation_date DESC
    LIMIT 5;  -- 最近5次对比
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_evaluation_trend_comparison IS '获取Offer最近5次评估的趋势对比数据';
