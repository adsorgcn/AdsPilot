package evaluation

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
)

func TestListEvaluations(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	svc := NewService(db, nil, nil, nil, nil)
	ctx := context.Background()
	now := time.Now()

	columns := []string{
		"id", "user_id", "offer_id", "evaluation_type", "status", "tokens_consumed",
		"landing_page_url", "domain", "brand_name", "brand_extraction_confidence",
		"similarweb_data", "similarweb_cached",
		"ai_recommendation_score", "ai_reasons", "ai_industry",
		"error_message", "error_code",
		"started_at", "completed_at",
	}

	rows := sqlmock.NewRows(columns).
		AddRow(
			"eval-1", "user-1", "offer-1", "basic", "success", 1,
			"https://example.com", "example.com", "Example", 0.92,
			`{"global_rank":1234}`, true,
			85, `["Strong brand presence","High conversion potential"]`, "Retail",
			nil, nil,
			now.Add(-10*time.Minute), now.Add(-8*time.Minute),
		).
		AddRow(
			"eval-2", "user-1", "offer-1", "ai", "failed", 3,
			"https://example.com", "example.com", "Example", 0.88,
			nil, false,
			90, `["Great engagement"]`, "Retail",
			"AI evaluation failed", "AI_EVALUATION_ERROR",
			now.Add(-30*time.Minute), nil,
		)

	queryPattern := regexp.QuoteMeta("SELECT id, user_id, offer_id") + `.*FROM offer_evaluations\s+WHERE offer_id = \$1 AND user_id = \$2 AND evaluation_type = \$3\s+ORDER BY COALESCE\(completed_at, started_at\) DESC LIMIT \$4`
	mock.ExpectQuery(queryPattern).
		WithArgs("offer-1", "user-1", string(EvaluationTypeBasic), 5).
		WillReturnRows(rows)

	evalType := EvaluationTypeBasic
	results, err := svc.ListEvaluations(ctx, "offer-1", "user-1", &evalType, 5)
	require.NoError(t, err)
	require.Len(t, results, 2)

	require.Equal(t, "eval-1", results[0].ID)
	require.NotNil(t, results[0].AIRecommendationScore)
	require.Equal(t, 85, *results[0].AIRecommendationScore)
	require.Equal(t, EvaluationTypeBasic, results[0].Type)
	require.Equal(t, EvaluationStatus("success"), results[0].Status)
	require.NotNil(t, results[0].SimilarWebData)
	require.NotNil(t, results[0].CompletedAt)

	require.Equal(t, "eval-2", results[1].ID)
	require.Equal(t, EvaluationStatus("failed"), results[1].Status)
	require.NotNil(t, results[1].AIRecommendationScore)
	require.Equal(t, 90, *results[1].AIRecommendationScore)
	require.NotNil(t, results[1].ErrorMessage)

	require.NoError(t, mock.ExpectationsWereMet())
}
