package browserexec

import (
	"context"
	"fmt"

	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
)

// Client wraps browser-exec service API using serviceclient
type Client struct {
	registry *serviceclient.Registry
}

// NewClient creates a new browser-exec client using serviceclient
func NewClient(registry *serviceclient.Registry) *Client {
	return &Client{
		registry: registry,
	}
}

// VisitRequest represents a request to visit a URL
type VisitRequest struct {
	URL     string `json:"url"`
	Timeout int    `json:"timeout,omitempty"` // seconds, default 60
}

// VisitResult represents the result of visiting a URL
type VisitResult struct {
	Success     bool   `json:"success"`
	Error       string `json:"error,omitempty"`
	FinalURL    string `json:"finalUrl"`
	StatusCode  int    `json:"statusCode"`
	PageTitle   string `json:"pageTitle"`
	PageContent string `json:"pageContent"` // May be truncated
	Duration    int    `json:"duration"`    // milliseconds
}

// VisitURL visits a URL using browser-exec service via serviceclient
func (c *Client) VisitURL(ctx context.Context, url string) (*VisitResult, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	reqBody := map[string]interface{}{
		"url":     url,
		"timeout": 60,
	}

	var result VisitResult
	err := c.registry.CallJSON(ctx, "browser-exec", serviceclient.Request{
		Method: "POST",
		Path:   "/api/visit",
		Body:   reqBody,
	}, &result)

	if err != nil {
		return nil, fmt.Errorf("browser-exec visit failed: %w", err)
	}

	return &result, nil
}

// VisitURLWithRetry is deprecated, use VisitURL (serviceclient handles retries)
func (c *Client) VisitURLWithRetry(ctx context.Context, url string, maxRetries int) (*VisitResult, error) {
	return c.VisitURL(ctx, url)
}

// --- SimilarWeb Integration ---

// SimilarWebRequest represents a request to fetch SimilarWeb data
type SimilarWebRequest struct {
	Domain    string `json:"domain"`
	TimeoutMs int    `json:"timeoutMs,omitempty"` // default 20000ms
	Retries   int    `json:"retries,omitempty"`   // default 2
	BackoffMs int    `json:"backoffMs,omitempty"` // default 500ms
}

// SimilarWebData represents SimilarWeb data structure
type SimilarWebData struct {
	GlobalRank       *int           `json:"global_rank,omitempty"`
	CategoryRank     *int           `json:"category_rank,omitempty"`
	TopCountryShares []CountryShare `json:"top_country_shares,omitempty"`
	CountryRank      *int           `json:"country_rank,omitempty"`
	MonthlyVisits    *int           `json:"monthly_visits,omitempty"`
}

// CountryShare represents traffic distribution by country
type CountryShare struct {
	Country string  `json:"country"`
	Value   float64 `json:"value"`
}

// SimilarWebResponse represents the response from browser-exec /similarweb endpoint
type SimilarWebResponse struct {
	OK             bool           `json:"ok"`
	Status         int            `json:"status"`
	Domain         string         `json:"domain"`
	Data           SimilarWebData `json:"data"`
	ParseMethod    string         `json:"parseMethod"` // "json", "html", or "none"
	Via            string         `json:"via"`         // "proxy" or "direct"
	ResponseTimeMs int            `json:"responseTimeMs"`
}

// FetchSimilarWebData fetches SimilarWeb data via browser-exec service using serviceclient
func (c *Client) FetchSimilarWebData(ctx context.Context, domain string) (*SimilarWebResponse, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	reqBody := map[string]interface{}{
		"domain":    domain,
		"timeoutMs": 20000,
		"retries":   2,
		"backoffMs": 500,
	}

	var result SimilarWebResponse
	err := c.registry.CallJSON(ctx, "browser-exec", serviceclient.Request{
		Method: "POST",
		Path:   "/api/v1/browser/similarweb",
		Body:   reqBody,
	}, &result)

	if err != nil {
		return nil, fmt.Errorf("browser-exec similarweb failed: %w", err)
	}

	return &result, nil
}

// FetchSimilarWebDataWithRetry is deprecated, use FetchSimilarWebData (serviceclient handles retries)
func (c *Client) FetchSimilarWebDataWithRetry(ctx context.Context, domain string, maxRetries int) (*SimilarWebResponse, error) {
	return c.FetchSimilarWebData(ctx, domain)
}
