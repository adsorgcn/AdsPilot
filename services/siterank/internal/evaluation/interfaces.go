package evaluation

import (
	"context"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/aievaluator"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/brandextract"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/browserexec"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/similarweb"
)

// BrowserExecClient defines the interface for browser-exec operations
type BrowserExecClient interface {
	VisitURL(ctx context.Context, url string) (*browserexec.VisitResult, error)
}

// SimilarWebClient defines the interface for SimilarWeb data operations
type SimilarWebClient interface {
	GetDomainData(ctx context.Context, domain string, forceRefresh bool) (*similarweb.CachedResult, error)
}

// BrandExtractor defines the interface for brand extraction operations
type BrandExtractor interface {
	ExtractFromLandingPage(ctx context.Context, finalURL, domain, pageTitle, pageContent string) *brandextract.BrandExtractionResult
}

// AIEvaluator defines the interface for AI evaluation operations
type AIEvaluator interface {
	EvaluateOffer(ctx context.Context, input *aievaluator.EvaluationInput) (*aievaluator.AIEvaluationResult, error)
}
