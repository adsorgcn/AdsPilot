package evaluation

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/aievaluator"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/metrics"
)

// ExecuteAIEvaluation performs AI evaluation (2 tokens)
// This should be called after ExecuteBasicEvaluation completes successfully
func (s *Service) ExecuteAIEvaluation(ctx context.Context, evaluationID string) error {
	startTime := time.Now()
	defer func() {
		metrics.EvaluationDuration.WithLabelValues("ai", "total").Observe(time.Since(startTime).Seconds())
	}()

	// 1. Get basic evaluation results
	eval, err := s.getEvaluationInternal(ctx, evaluationID)
	if err != nil {
		return fmt.Errorf("failed to get evaluation: %w", err)
	}

	// Ensure we have the required data from basic evaluation
	if eval.Domain == nil || *eval.Domain == "" {
		s.markEvaluationFailed(ctx, evaluationID, "missing domain from basic evaluation", "MISSING_DOMAIN")
		return fmt.Errorf("missing domain from basic evaluation")
	}

	// 2. Prepare AI evaluation input
	aiInput := &aievaluator.EvaluationInput{
		Domain:         *eval.Domain,
		LandingPageURL: "",
		BrandName:      "",
	}

	if eval.LandingPageURL != nil {
		aiInput.LandingPageURL = *eval.LandingPageURL
	}
	if eval.BrandName != nil {
		aiInput.BrandName = *eval.BrandName
	}
	if eval.SimilarWebData != nil {
		aiInput.SimilarWebData = eval.SimilarWebData
	}

	// 3. Call AI evaluator
	aiStart := time.Now()
	aiResult, err := s.aiEvaluator.EvaluateOffer(ctx, aiInput)
	metrics.GeminiAPILatency.Observe(time.Since(aiStart).Seconds())
	if err != nil {
		metrics.GeminiAPIErrors.WithLabelValues("evaluation_failed").Inc()
		s.markEvaluationFailed(ctx, evaluationID, fmt.Sprintf("AI evaluation failed: %v", err), "AI_EVALUATION_ERROR")
		return fmt.Errorf("AI evaluation failed: %w", err)
	}

	// 4. Save AI evaluation results (including v2.5 competitor/budget insights)
	now := time.Now()
	aiReasonsJSON, _ := json.Marshal(aiResult.Reasons)
	aiTrafficJSON, _ := json.Marshal(aiResult.TrafficInsights)
	aiSearchJSON, _ := json.Marshal(aiResult.SearchInsights)
	aiGeoJSON, _ := json.Marshal(aiResult.GeoInsights)
	aiAdJSON, _ := json.Marshal(aiResult.AdInsights)
	aiRiskJSON, _ := json.Marshal(aiResult.RiskAssessment)
	aiSeasonalityJSON, _ := json.Marshal(aiResult.SeasonalityInsights)
	aiConversionJSON, _ := json.Marshal(aiResult.ConversionInsights)
	aiLTVJSON, _ := json.Marshal(aiResult.LTVInsights)
	aiProfitabilityJSON, _ := json.Marshal(aiResult.ProfitabilityInsights)
	aiCompetitorJSON, _ := json.Marshal(aiResult.CompetitorInsights)
	aiBudgetJSON, _ := json.Marshal(aiResult.BudgetRecommendation)

	_, err = s.db.ExecContext(ctx, `
		UPDATE offer_evaluations
		SET ai_recommendation_score = $1,
		    ai_reasons = $2,
		    ai_industry = $3,
		    ai_product_type = $4,
		    ai_estimated_aov = $5,
		    ai_traffic_insights = $6,
		    ai_search_insights = $7,
		    ai_geo_insights = $8,
		    ai_ad_insights = $9,
		    ai_risk_assessment = $10,
		    ai_seasonality_insights = $11,
		    ai_conversion_insights = $12,
		    ai_ltv_insights = $13,
		    ai_profitability_insights = $14,
		    ai_competitor_insights = $15,
		    ai_budget_recommendation = $16,
		    completed_at = $17,
		    updated_at = $18
		WHERE id = $19
	`, aiResult.RecommendationScore,
		aiReasonsJSON,
		aiResult.Industry,
		aiResult.ProductType,
		aiResult.EstimatedAOV,
		aiTrafficJSON,
		aiSearchJSON,
		aiGeoJSON,
		aiAdJSON,
		aiRiskJSON,
		aiSeasonalityJSON,
		aiConversionJSON,
		aiLTVJSON,
		aiProfitabilityJSON,
		aiCompetitorJSON,
		aiBudgetJSON,
		now,
		now,
		evaluationID)

	if err != nil {
		return fmt.Errorf("failed to save AI evaluation results: %w", err)
	}

	// Record metrics
	metrics.EvaluationRequestsTotal.WithLabelValues("ai", "success").Inc()
	metrics.TokensConsumed.WithLabelValues("ai").Add(2) // AI adds 2 tokens (basic already counted 1)
	metrics.AIEvaluationScore.WithLabelValues().Observe(float64(aiResult.RecommendationScore))

	return nil
}
