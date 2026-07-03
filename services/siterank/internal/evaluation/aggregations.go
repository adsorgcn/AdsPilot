package evaluation

import (
	"context"
	"encoding/json"
	"fmt"
)

// --- BE-019: Aggregation Table Update ---

// updateAggregations updates evaluation_aggregations table
func (s *Service) updateAggregations(ctx context.Context, urlHash string, eval *EvaluationResult) error {
	var swDataJSON []byte
	if eval.SimilarWebData != nil {
		swDataJSON, _ = json.Marshal(eval.SimilarWebData)
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO evaluation_aggregations (
			offer_url_hash,
			offer_url,
			total_evaluations,
			last_evaluation_id,
			last_evaluation_at,
			latest_domain,
			latest_brand,
			latest_similarweb_data,
			latest_ai_score,
			created_at,
			updated_at
		) VALUES ($1, $2, 1, $3, NOW(), $4, $5, $6, $7, NOW(), NOW())
		ON CONFLICT (offer_url_hash) DO UPDATE SET
			total_evaluations = evaluation_aggregations.total_evaluations + 1,
			last_evaluation_id = EXCLUDED.last_evaluation_id,
			last_evaluation_at = EXCLUDED.last_evaluation_at,
			latest_domain = EXCLUDED.latest_domain,
			latest_brand = EXCLUDED.latest_brand,
			latest_similarweb_data = EXCLUDED.latest_similarweb_data,
			latest_ai_score = EXCLUDED.latest_ai_score,
			updated_at = NOW()
	`, urlHash,
		"", // offer_url - we don't have it here, would need to pass from caller
		eval.ID,
		eval.Domain,
		eval.BrandName,
		swDataJSON,
		eval.AIRecommendationScore)

	if err != nil {
		// Log error but don't fail the evaluation
		fmt.Printf("Warning: failed to update aggregations: %v\n", err)
		return err
	}

	return nil
}
