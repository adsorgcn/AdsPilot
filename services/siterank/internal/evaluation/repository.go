package evaluation

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/brandextract"
)

// Helper types

type offerInfo struct {
	ID          string
	OriginalURL string
	BrandName   *string
}

type evaluationInfo struct {
	ID           string
	OfferID      string
	UserID       string
	ForceRefresh bool
}

// Repository functions

func (s *Service) getOffer(ctx context.Context, offerID string) (*offerInfo, error) {
	var offer offerInfo
	var brandName sql.NullString

	err := s.db.QueryRowContext(ctx, `
		SELECT id, original_url, brand_name
		FROM offers
		WHERE id = $1
	`, offerID).Scan(&offer.ID, &offer.OriginalURL, &brandName)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("offer not found")
	}
	if err != nil {
		return nil, err
	}

	if brandName.Valid {
		offer.BrandName = &brandName.String
	}

	return &offer, nil
}

func (s *Service) getEvaluation(ctx context.Context, evaluationID string) (*evaluationInfo, error) {
	var eval evaluationInfo
	// Note: ForceRefresh is not stored in DB, would need to be passed through request context
	eval.ForceRefresh = false

	err := s.db.QueryRowContext(ctx, `
		SELECT id, offer_id, user_id
		FROM offer_evaluations
		WHERE id = $1
	`, evaluationID).Scan(&eval.ID, &eval.OfferID, &eval.UserID)

	if err != nil {
		return nil, err
	}

	return &eval, nil
}

// BrandNameExtractedEvent represents the event when brand name is extracted from offer
type BrandNameExtractedEvent struct {
	OfferID     string  `json:"offerId"`
	BrandName   string  `json:"brandName"`
	Source      string  `json:"source"`      // "auto_extracted" or "domain_fallback"
	Confidence  float64 `json:"confidence"`  // 0.0 to 1.0
	ExtractedAt string  `json:"extractedAt"` // ISO timestamp
}

// publishBrandNameExtracted publishes an event for brand name extraction
// This replaces direct database UPDATE to Offer table (cross-domain write violation)
// Offer service should subscribe to this event and update its own table
func (s *Service) publishBrandNameExtracted(ctx context.Context, offerID string, brandResult *brandextract.BrandExtractionResult) error {
	if s.publisher == nil {
		return fmt.Errorf("publisher not configured")
	}

	source := "auto_extracted"
	if brandResult.Source == "domain_fallback" {
		source = "domain_fallback"
	}

	event := BrandNameExtractedEvent{
		OfferID:     offerID,
		BrandName:   brandResult.BrandName,
		Source:      source,
		Confidence:  brandResult.Confidence,
		ExtractedAt: time.Now().UTC().Format(time.RFC3339),
	}

	if err := s.publisher.Publish(ctx, "BrandNameExtracted", event); err != nil {
		return fmt.Errorf("failed to publish BrandNameExtracted event: %w", err)
	}

	return nil
}

func (s *Service) updateEvaluationStatus(ctx context.Context, evaluationID string, status EvaluationStatus) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE offer_evaluations
		SET status = $1, updated_at = $2
		WHERE id = $3
	`, status, time.Now(), evaluationID)
	return err
}

func (s *Service) markEvaluationFailed(ctx context.Context, evaluationID, errorMsg, errorCode string) {
	now := time.Now()
	s.db.ExecContext(ctx, `
		UPDATE offer_evaluations
		SET status = $1,
		    error_message = $2,
		    error_code = $3,
		    completed_at = $4,
		    updated_at = $5
		WHERE id = $6
	`, StatusFailed, errorMsg, errorCode, now, now, evaluationID)
}

// URL hashing functions

func hashURL(url string) string {
	hash := sha256.Sum256([]byte(url))
	return hex.EncodeToString(hash[:])
}

// HashURL is the exported version of hashURL for use by other packages
func HashURL(url string) string {
	return hashURL(url)
}
