package evaluation

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/similarweb"
)

// getEvaluationInternal retrieves evaluation without user_id check (for internal use)
func (s *Service) getEvaluationInternal(ctx context.Context, evaluationID string) (*EvaluationResult, error) {
	var result EvaluationResult
	var evalType string
	var status string
	var landingPageURL, domain, brandName sql.NullString
	var brandConfidence sql.NullFloat64
	var swDataJSON []byte
	var swCached sql.NullBool
	var aiScore sql.NullInt32
	var aiReasonsJSON []byte
	var aiIndustry sql.NullString
	var errorMsg, errorCode sql.NullString
	var completedAt sql.NullTime

	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, offer_id, evaluation_type, status, tokens_consumed,
		       landing_page_url, domain, brand_name, brand_extraction_confidence,
		       similarweb_data, similarweb_cached,
		       ai_recommendation_score, ai_reasons, ai_industry,
		       error_message, error_code,
		       started_at, completed_at
		FROM offer_evaluations
		WHERE id = $1
	`, evaluationID).Scan(
		&result.ID, &result.UserID, &result.OfferID, &evalType, &status, &result.TokensConsumed,
		&landingPageURL, &domain, &brandName, &brandConfidence,
		&swDataJSON, &swCached,
		&aiScore, &aiReasonsJSON, &aiIndustry,
		&errorMsg, &errorCode,
		&result.StartedAt, &completedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("evaluation not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query evaluation: %w", err)
	}

	result.Type = EvaluationType(evalType)
	result.Status = EvaluationStatus(status)

	if landingPageURL.Valid {
		result.LandingPageURL = &landingPageURL.String
	}
	if domain.Valid {
		result.Domain = &domain.String
	}
	if brandName.Valid {
		result.BrandName = &brandName.String
	}
	if brandConfidence.Valid {
		result.BrandExtractionConfidence = &brandConfidence.Float64
	}
	if swCached.Valid {
		result.SimilarWebCached = swCached.Bool
	}
	if len(swDataJSON) > 0 {
		var swData similarweb.SimilarWebData
		if err := json.Unmarshal(swDataJSON, &swData); err == nil {
			result.SimilarWebData = &swData
		}
	}
	if aiScore.Valid {
		score := int(aiScore.Int32)
		result.AIRecommendationScore = &score
	}
	if len(aiReasonsJSON) > 0 {
		var reasons []string
		if err := json.Unmarshal(aiReasonsJSON, &reasons); err == nil {
			result.AIReasons = reasons
		}
	}
	if aiIndustry.Valid {
		result.AIIndustry = &aiIndustry.String
	}
	if errorMsg.Valid {
		result.ErrorMessage = &errorMsg.String
	}
	if errorCode.Valid {
		result.ErrorCode = &errorCode.String
	}
	if completedAt.Valid {
		result.CompletedAt = &completedAt.Time
	}

	return &result, nil
}

// GetEvaluation retrieves evaluation by ID
func (s *Service) GetEvaluation(ctx context.Context, evaluationID, userID string) (*EvaluationResult, error) {
	var result EvaluationResult
	var evalType string
	var status string
	var landingPageURL, domain, brandName sql.NullString
	var brandConfidence sql.NullFloat64
	var swDataJSON []byte
	var swCached sql.NullBool
	var aiScore sql.NullInt32
	var aiReasonsJSON []byte
	var aiIndustry sql.NullString
	var errorMsg, errorCode sql.NullString
	var completedAt sql.NullTime

	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, offer_id, evaluation_type, status, tokens_consumed,
		       landing_page_url, domain, brand_name, brand_extraction_confidence,
		       similarweb_data, similarweb_cached,
		       ai_recommendation_score, ai_reasons, ai_industry,
		       error_message, error_code,
		       started_at, completed_at
		FROM offer_evaluations
		WHERE id = $1 AND user_id = $2
	`, evaluationID, userID).Scan(
		&result.ID, &result.UserID, &result.OfferID, &evalType, &status, &result.TokensConsumed,
		&landingPageURL, &domain, &brandName, &brandConfidence,
		&swDataJSON, &swCached,
		&aiScore, &aiReasonsJSON, &aiIndustry,
		&errorMsg, &errorCode,
		&result.StartedAt, &completedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("evaluation not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query evaluation: %w", err)
	}

	result.Type = EvaluationType(evalType)
	result.Status = EvaluationStatus(status)

	if landingPageURL.Valid {
		result.LandingPageURL = &landingPageURL.String
	}
	if domain.Valid {
		result.Domain = &domain.String
	}
	if brandName.Valid {
		result.BrandName = &brandName.String
	}
	if brandConfidence.Valid {
		result.BrandExtractionConfidence = &brandConfidence.Float64
	}
	if swCached.Valid {
		result.SimilarWebCached = swCached.Bool
	}
	if len(swDataJSON) > 0 {
		var swData similarweb.SimilarWebData
		if err := json.Unmarshal(swDataJSON, &swData); err == nil {
			result.SimilarWebData = &swData
		}
	}
	if aiScore.Valid {
		score := int(aiScore.Int32)
		result.AIRecommendationScore = &score
	}
	if len(aiReasonsJSON) > 0 {
		var reasons []string
		if err := json.Unmarshal(aiReasonsJSON, &reasons); err == nil {
			result.AIReasons = reasons
		}
	}
	if aiIndustry.Valid {
		result.AIIndustry = &aiIndustry.String
	}
	if errorMsg.Valid {
		result.ErrorMessage = &errorMsg.String
	}
	if errorCode.Valid {
		result.ErrorCode = &errorCode.String
	}
	if completedAt.Valid {
		result.CompletedAt = &completedAt.Time
	}

	return &result, nil
}

// GetLatestEvaluation gets latest evaluation for an offer
func (s *Service) GetLatestEvaluation(ctx context.Context, offerID, userID string, evalType EvaluationType) (*EvaluationResult, error) {
	var evaluationID string

	err := s.db.QueryRowContext(ctx, `
		SELECT id
		FROM offer_evaluations
		WHERE offer_id = $1 AND user_id = $2 AND evaluation_type = $3 AND status = 'success'
		ORDER BY completed_at DESC
		LIMIT 1
	`, offerID, userID, evalType).Scan(&evaluationID)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("no evaluation found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query latest evaluation: %w", err)
	}

	return s.GetEvaluation(ctx, evaluationID, userID)
}

// ListEvaluations returns the latest evaluation records for an offer
func (s *Service) ListEvaluations(ctx context.Context, offerID, userID string, evalType *EvaluationType, limit int) ([]EvaluationResult, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}

	baseQuery := `
		SELECT id, user_id, offer_id, evaluation_type, status, tokens_consumed,
		       landing_page_url, domain, brand_name, brand_extraction_confidence,
		       similarweb_data, similarweb_cached,
		       ai_recommendation_score, ai_reasons, ai_industry,
		       error_message, error_code,
		       started_at, completed_at
		FROM offer_evaluations
		WHERE offer_id = $1 AND user_id = $2
	`

	args := []any{offerID, userID}
	argIdx := 3

	if evalType != nil {
		baseQuery += fmt.Sprintf(" AND evaluation_type = $%d", argIdx)
		args = append(args, string(*evalType))
		argIdx++
	}

	baseQuery += fmt.Sprintf(" ORDER BY COALESCE(completed_at, started_at) DESC LIMIT $%d", argIdx)
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query evaluations: %w", err)
	}
	defer rows.Close()

	results := make([]EvaluationResult, 0)

	for rows.Next() {
		var result EvaluationResult
		var evalTypeStr, statusStr string
		var landingPageURL, domain, brandName sql.NullString
		var brandConfidence sql.NullFloat64
		var swDataJSON []byte
		var swCached sql.NullBool
		var aiScore sql.NullInt32
		var aiReasonsJSON []byte
		var aiIndustry sql.NullString
		var errorMsg, errorCode sql.NullString
		var completedAt sql.NullTime

		if err := rows.Scan(
			&result.ID, &result.UserID, &result.OfferID, &evalTypeStr, &statusStr, &result.TokensConsumed,
			&landingPageURL, &domain, &brandName, &brandConfidence,
			&swDataJSON, &swCached,
			&aiScore, &aiReasonsJSON, &aiIndustry,
			&errorMsg, &errorCode,
			&result.StartedAt, &completedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan evaluation row: %w", err)
		}

		result.Type = EvaluationType(evalTypeStr)
		result.Status = EvaluationStatus(statusStr)

		if landingPageURL.Valid {
			result.LandingPageURL = &landingPageURL.String
		}
		if domain.Valid {
			result.Domain = &domain.String
		}
		if brandName.Valid {
			result.BrandName = &brandName.String
		}
		if brandConfidence.Valid {
			result.BrandExtractionConfidence = &brandConfidence.Float64
		}
		if swCached.Valid {
			result.SimilarWebCached = swCached.Bool
		}
		if len(swDataJSON) > 0 {
			var swData similarweb.SimilarWebData
			if err := json.Unmarshal(swDataJSON, &swData); err == nil {
				result.SimilarWebData = &swData
			}
		}
		if aiScore.Valid {
			score := int(aiScore.Int32)
			result.AIRecommendationScore = &score
		}
		if len(aiReasonsJSON) > 0 {
			var reasons []string
			if err := json.Unmarshal(aiReasonsJSON, &reasons); err == nil {
				result.AIReasons = reasons
			}
		}
		if aiIndustry.Valid {
			result.AIIndustry = &aiIndustry.String
		}
		if errorMsg.Valid {
			result.ErrorMessage = &errorMsg.String
		}
		if errorCode.Valid {
			result.ErrorCode = &errorCode.String
		}
		if completedAt.Valid {
			result.CompletedAt = &completedAt.Time
		}

		results = append(results, result)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate evaluations: %w", err)
	}

	return results, nil
}
