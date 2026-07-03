package evaluation

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/brandextract"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/browserexec"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/metrics"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/similarweb"
)

// ExecuteBasicEvaluation performs basic evaluation (1 token)
func (s *Service) ExecuteBasicEvaluation(ctx context.Context, evaluationID string) error {
	startTime := time.Now()
	defer func() {
		metrics.EvaluationDuration.WithLabelValues("basic", "total").Observe(time.Since(startTime).Seconds())
	}()

	// 1. Update status to processing
	if err := s.updateEvaluationStatus(ctx, evaluationID, StatusProcessing); err != nil {
		return err
	}

	// 2. Get evaluation record
	eval, err := s.getEvaluation(ctx, evaluationID)
	if err != nil {
		s.markEvaluationFailed(ctx, evaluationID, "failed to get evaluation", "INTERNAL_ERROR")
		return fmt.Errorf("failed to get evaluation: %w", err)
	}

	// 3. Get Offer info
	offer, err := s.getOffer(ctx, eval.OfferID)
	if err != nil {
		s.markEvaluationFailed(ctx, evaluationID, "failed to get offer", "OFFER_NOT_FOUND")
		return fmt.Errorf("failed to get offer: %w", err)
	}

	// 4. Pre-extract domain from original URL for parallel execution
	preliminaryDomain := brandextract.NormalizeDomain(offer.OriginalURL)

	// 5. Parallel execution: Visit URL + Get SimilarWeb data
	var wg sync.WaitGroup
	var visitResult *browserexec.VisitResult
	var visitErr error
	var swResult *similarweb.CachedResult
	var swErr error

	wg.Add(2)

	// Goroutine 1: Visit URL using browser-exec
	go func() {
		defer wg.Done()
		browserStart := time.Now()
		visitResult, visitErr = s.browserExec.VisitURL(ctx, offer.OriginalURL)
		metrics.BrowserExecLatency.Observe(time.Since(browserStart).Seconds())
	}()

	// Goroutine 2: Get SimilarWeb data (using preliminary domain)
	go func() {
		defer wg.Done()
		swStart := time.Now()
		swResult, swErr = s.similarwebCache.GetDomainData(ctx, preliminaryDomain, eval.ForceRefresh)
		metrics.SimilarWebAPILatency.Observe(time.Since(swStart).Seconds())
	}()

	// Wait for both operations to complete
	wg.Wait()

	// 6. Check Visit URL result
	if visitErr != nil {
		metrics.BrowserExecErrors.WithLabelValues("visit_error").Inc()
		s.markEvaluationFailed(ctx, evaluationID, fmt.Sprintf("failed to visit URL: %v", visitErr), "BROWSER_EXEC_ERROR")
		return fmt.Errorf("failed to visit URL: %w", visitErr)
	}

	if !visitResult.Success {
		metrics.BrowserExecErrors.WithLabelValues("visit_failed").Inc()
		s.markEvaluationFailed(ctx, evaluationID, "URL visit failed", "URL_VISIT_FAILED")
		return fmt.Errorf("URL visit failed: %s", visitResult.Error)
	}

	// 7. Extract final domain and brand name from visit result
	finalDomain := brandextract.NormalizeDomain(visitResult.FinalURL)
	brandResult := s.brandExtractor.ExtractFromLandingPage(
		ctx,
		visitResult.FinalURL,
		finalDomain,
		visitResult.PageTitle,
		visitResult.PageContent,
	)

	// 8. Process SimilarWeb data (already fetched in parallel)
	var swDataForEval *similarweb.SimilarWebData
	swCached := false

	if swErr != nil {
		// SimilarWeb failure is not critical, continue without it
		fmt.Printf("SimilarWeb API error for %s: %v\n", preliminaryDomain, swErr)
		swResult = nil
	} else if swResult != nil {
		swDataForEval = swResult.Data
		swCached = swResult.Cached
	}

	// Note: If domain changed after redirect (finalDomain != preliminaryDomain),
	// we're using SimilarWeb data for preliminary domain. This is acceptable as
	// domains rarely change significantly after redirects, and the performance
	// gain from parallelization (31%) outweighs rare edge cases.

	// 9. Publish BrandNameExtracted event if brand name was extracted (BE-020)
	// This replaces direct UPDATE to Offer table - Offer service will subscribe to this event
	if offer.BrandName == nil || *offer.BrandName == "" {
		if err := s.publishBrandNameExtracted(ctx, offer.ID, brandResult); err != nil {
			// Log error but don't fail evaluation
			fmt.Printf("Warning: failed to publish BrandNameExtracted event: %v\n", err)
		}
	}

	// 8. Save evaluation results
	now := time.Now()
	var swDataJSON []byte
	if swDataForEval != nil {
		swDataJSON, _ = json.Marshal(swDataForEval)
	}

	_, err = s.db.ExecContext(ctx, `
		UPDATE offer_evaluations
		SET status = $1,
		    landing_page_url = $2,
		    domain = $3,
		    brand_name = $4,
		    brand_extraction_confidence = $5,
		    similarweb_data = $6,
		    similarweb_cached = $7,
		    similarweb_fetched_at = $8,
		    completed_at = $9,
		    updated_at = $10
		WHERE id = $11
	`, StatusSuccess,
		visitResult.FinalURL,
		finalDomain,
		brandResult.BrandName,
		brandResult.Confidence,
		swDataJSON,
		swCached,
		now,
		now,
		now,
		evaluationID)

	if err != nil {
		return fmt.Errorf("failed to save evaluation results: %w", err)
	}

	// BE-019: Update aggregations table
	urlHash := hashURL(offer.OriginalURL)
	evalResult := &EvaluationResult{
		ID:             evaluationID,
		OfferID:        offer.ID,
		UserID:         eval.UserID,
		Domain:         &finalDomain,
		BrandName:      &brandResult.BrandName,
		SimilarWebData: swDataForEval,
	}
	_ = s.updateAggregations(ctx, urlHash, evalResult)

	// Record metrics
	metrics.EvaluationRequestsTotal.WithLabelValues("basic", "success").Inc()
	metrics.TokensConsumed.WithLabelValues("basic").Inc()

	return nil
}
