package evaluation

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/aievaluator"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/brandextract"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/browserexec"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/similarweb"
	"github.com/google/uuid"
)

// Publisher interface for event publishing
type Publisher interface {
	Publish(ctx context.Context, eventType string, payload interface{}) error
}

// Service orchestrates offer evaluations
type Service struct {
	db              *sql.DB
	browserExec     BrowserExecClient
	similarwebCache SimilarWebClient
	brandExtractor  BrandExtractor
	aiEvaluator     AIEvaluator
	publisher       Publisher
}

// NewService creates a new evaluation service
func NewService(
	db *sql.DB,
	browserExec *browserexec.Client,
	similarwebCache *similarweb.CachedClient,
	aiEvaluator *aievaluator.Service,
	publisher Publisher,
) *Service {
	return &Service{
		db:              db,
		browserExec:     browserExec,
		similarwebCache: similarwebCache,
		brandExtractor:  brandextract.NewExtractor(),
		aiEvaluator:     aiEvaluator,
		publisher:       publisher,
	}
}

// EvaluationType represents the type of evaluation
type EvaluationType string

const (
	EvaluationTypeBasic EvaluationType = "basic"
	EvaluationTypeAI    EvaluationType = "ai"
)

// EvaluationStatus represents evaluation status
type EvaluationStatus string

const (
	StatusPending    EvaluationStatus = "pending"
	StatusProcessing EvaluationStatus = "processing"
	StatusSuccess    EvaluationStatus = "success"
	StatusFailed     EvaluationStatus = "failed"
)

// EvaluationRequest represents an evaluation request
type EvaluationRequest struct {
	OfferID      string
	UserID       string
	IncludeAI    bool
	ForceRefresh bool
}

// EvaluationResult represents the result of an evaluation
type EvaluationResult struct {
	ID             string
	OfferID        string
	UserID         string
	Type           EvaluationType
	Status         EvaluationStatus
	TokensConsumed int

	// Landing page info
	LandingPageURL            *string
	Domain                    *string
	BrandName                 *string
	BrandExtractionConfidence *float64

	// SimilarWeb data
	SimilarWebData   *similarweb.SimilarWebData
	SimilarWebCached bool

	// AI evaluation (only for type=ai)
	AIRecommendationScore *int
	AIReasons             []string
	AIIndustry            *string

	// Error info
	ErrorMessage *string
	ErrorCode    *string

	// Timestamps
	StartedAt   time.Time
	CompletedAt *time.Time
}

// CreateEvaluation creates a new evaluation task
func (s *Service) CreateEvaluation(ctx context.Context, req *EvaluationRequest) (*EvaluationResult, error) {
	// 1. Get Offer info
	offer, err := s.getOffer(ctx, req.OfferID)
	if err != nil {
		return nil, fmt.Errorf("failed to get offer: %w", err)
	}

	// 2. Calculate URL hash
	urlHash := hashURL(offer.OriginalURL)

	// 3. Determine evaluation type and token cost
	evalType := EvaluationTypeBasic
	tokensCost := 1
	if req.IncludeAI {
		evalType = EvaluationTypeAI
		tokensCost = 3 // 1 basic + 2 AI
	}

	// 4. Create evaluation record
	evaluationID := uuid.New().String()
	now := time.Now()

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO offer_evaluations (
			id, user_id, offer_id, offer_url_hash, evaluation_type,
			status, tokens_consumed, started_at, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, evaluationID, req.UserID, req.OfferID, urlHash, evalType,
		StatusPending, tokensCost, now, now)

	if err != nil {
		return nil, fmt.Errorf("failed to create evaluation record: %w", err)
	}

	result := &EvaluationResult{
		ID:             evaluationID,
		OfferID:        req.OfferID,
		UserID:         req.UserID,
		Type:           evalType,
		Status:         StatusPending,
		TokensConsumed: tokensCost,
		StartedAt:      now,
	}

	return result, nil
}
