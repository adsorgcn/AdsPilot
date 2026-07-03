package similarweb

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/browserexec"
)

// Client is a client for SimilarWeb API
type Client struct {
	baseURL           string
	httpClient        *http.Client
	browserExecClient *browserexec.Client // Optional: use browser-exec for fetching
}

// NewClient creates a new SimilarWeb API client
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		// Default to known SimilarWeb API endpoint
		baseURL = "https://data.similarweb.com/api/v1"
	}

	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		browserExecClient: nil,
	}
}

// NewClientWithBrowserExec creates a SimilarWeb client that uses browser-exec service
func NewClientWithBrowserExec(browserExecClient *browserexec.Client) *Client {
	return &Client{
		baseURL:           "", // Not used when browser-exec is available
		httpClient:        nil,
		browserExecClient: browserExecClient,
	}
}

// SimilarWebData represents the response from SimilarWeb API
type SimilarWebData struct {
	GlobalRank        *int                   `json:"GlobalRank,omitempty"`
	CategoryRank      *int                   `json:"CategoryRank,omitempty"`
	Category          string                 `json:"Category,omitempty"`
	TotalVisits       *float64               `json:"TotalVisits,omitempty"`
	TopCountryRanks   []CountryRank          `json:"TopCountryRanks,omitempty"`
	TopCountryShares  []CountryShare         `json:"TopCountryShares,omitempty"` // Traffic distribution by country
	TrafficSources    *TrafficSources        `json:"TrafficSources,omitempty"`
	EngagementMetrics *EngagementMetrics     `json:"EngagementMetrics,omitempty"`
	RawResponse       map[string]interface{} `json:"RawResponse,omitempty"` // Store full response
}

type CountryRank struct {
	Country string `json:"Country"`
	Rank    int    `json:"Rank"`
}

type CountryShare struct {
	CountryCode string  `json:"CountryCode"` // e.g., "US", "GB"
	Share       float64 `json:"Share"`       // e.g., 0.4050 = 40.5%
}

type TrafficSources struct {
	Direct    *float64 `json:"Direct,omitempty"`
	Referrals *float64 `json:"Referrals,omitempty"`
	Search    *float64 `json:"Search,omitempty"`
	Social    *float64 `json:"Social,omitempty"`
	Mail      *float64 `json:"Mail,omitempty"`
	Paid      *float64 `json:"Paid,omitempty"`
}

type EngagementMetrics struct {
	BounceRate       *float64 `json:"BounceRate,omitempty"`
	PagesPerVisit    *float64 `json:"PagesPerVisit,omitempty"`
	AvgVisitDuration *float64 `json:"AvgVisitDuration,omitempty"` // seconds
}

// NormalizeDomain normalizes a domain or URL to a canonical form
func NormalizeDomain(input string) string {
	// Remove protocol if present
	input = strings.TrimPrefix(input, "http://")
	input = strings.TrimPrefix(input, "https://")

	// Parse to extract hostname
	if !strings.Contains(input, "/") {
		input = "http://" + input // Add dummy protocol for parsing
	}

	parsed, err := url.Parse("http://" + strings.TrimPrefix(input, "http://"))
	if err != nil {
		// Fallback: simple string processing
		domain := strings.Split(input, "/")[0]
		domain = strings.ToLower(domain)
		if strings.HasPrefix(domain, "www.") {
			domain = domain[4:]
		}
		return domain
	}

	domain := parsed.Hostname()
	domain = strings.ToLower(domain)

	// Remove www. prefix
	if strings.HasPrefix(domain, "www.") {
		domain = domain[4:]
	}

	return domain
}

// GetDomainData fetches SimilarWeb data for a domain with retry logic
func (c *Client) GetDomainData(ctx context.Context, domain string) (*SimilarWebData, error) {
	return c.GetDomainDataWithRetry(ctx, domain, 3)
}

// GetDomainDataWithRetry fetches SimilarWeb data with configurable retry attempts
func (c *Client) GetDomainDataWithRetry(ctx context.Context, domain string, maxRetries int) (*SimilarWebData, error) {
	// Normalize domain
	domain = NormalizeDomain(domain)

	if domain == "" {
		return nil, fmt.Errorf("invalid domain")
	}

	// If browser-exec client is available, use it (preferred method)
	if c.browserExecClient != nil {
		return c.fetchViaBrowserExec(ctx, domain, maxRetries)
	}

	// Fallback to direct API call
	return c.fetchDirectly(ctx, domain, maxRetries)
}

// fetchViaBrowserExec fetches SimilarWeb data via browser-exec service
func (c *Client) fetchViaBrowserExec(ctx context.Context, domain string, maxRetries int) (*SimilarWebData, error) {
	resp, err := c.browserExecClient.FetchSimilarWebDataWithRetry(ctx, domain, maxRetries)
	if err != nil {
		return nil, fmt.Errorf("browser-exec similarweb fetch failed: %w", err)
	}

	// Check if request was successful
	if !resp.OK {
		return nil, fmt.Errorf("browser-exec similarweb returned non-ok status: %d", resp.Status)
	}

	// Convert browser-exec response to SimilarWebData
	data := &SimilarWebData{
		GlobalRank:       resp.Data.GlobalRank,
		CategoryRank:     resp.Data.CategoryRank,
		TopCountryShares: make([]CountryShare, 0),
		RawResponse:      make(map[string]interface{}),
	}

	// Convert country shares
	for _, cs := range resp.Data.TopCountryShares {
		data.TopCountryShares = append(data.TopCountryShares, CountryShare{
			CountryCode: cs.Country,
			Share:       cs.Value,
		})
	}

	// Add to raw response for compatibility
	data.RawResponse["GlobalRank"] = resp.Data.GlobalRank
	data.RawResponse["CategoryRank"] = resp.Data.CategoryRank
	data.RawResponse["TopCountryShares"] = resp.Data.TopCountryShares
	if resp.Data.CountryRank != nil {
		data.RawResponse["CountryRank"] = resp.Data.CountryRank
	}
	if resp.Data.MonthlyVisits != nil {
		visits := float64(*resp.Data.MonthlyVisits)
		data.TotalVisits = &visits
		data.RawResponse["MonthlyVisits"] = resp.Data.MonthlyVisits
	}
	data.RawResponse["via"] = resp.Via
	data.RawResponse["parseMethod"] = resp.ParseMethod

	return data, nil
}

// fetchDirectly fetches SimilarWeb data directly from API (fallback method)
func (c *Client) fetchDirectly(ctx context.Context, domain string, maxRetries int) (*SimilarWebData, error) {

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		// Build request URL
		reqURL := fmt.Sprintf("%s/data?domain=%s", c.baseURL, url.QueryEscape(domain))

		// Create request
		req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		// Set headers
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "Google-Monetize-Siterank/1.0")

		// Execute request
		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("failed to fetch data (attempt %d/%d): %w", attempt+1, maxRetries+1, err)

			// Check if error is retryable
			if !isRetryableError(err) {
				return nil, lastErr
			}

			// Apply exponential backoff before retry
			if attempt < maxRetries {
				backoff := time.Duration(1<<uint(attempt)) * time.Second
				select {
				case <-time.After(backoff):
					continue
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}
			continue
		}
		defer resp.Body.Close()

		// Read response body
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = fmt.Errorf("failed to read response (attempt %d/%d): %w", attempt+1, maxRetries+1, err)
			resp.Body.Close()

			// Apply exponential backoff before retry
			if attempt < maxRetries {
				backoff := time.Duration(1<<uint(attempt)) * time.Second
				select {
				case <-time.After(backoff):
					continue
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}
			continue
		}

		// Check status code
		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("similarweb API returned status %d (attempt %d/%d): %s", resp.StatusCode, attempt+1, maxRetries+1, string(body))
			resp.Body.Close()

			// Check if status code is retryable (5xx errors)
			if !isRetryableStatusCode(resp.StatusCode) {
				return nil, lastErr
			}

			// Apply exponential backoff before retry
			if attempt < maxRetries {
				backoff := time.Duration(1<<uint(attempt)) * time.Second
				select {
				case <-time.After(backoff):
					continue
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}
			continue
		}

		// Parse response
		var rawData map[string]interface{}
		if err := json.Unmarshal(body, &rawData); err != nil {
			lastErr = fmt.Errorf("failed to parse response (attempt %d/%d): %w", attempt+1, maxRetries+1, err)
			resp.Body.Close()

			// JSON parse errors are not retryable
			return nil, lastErr
		}

		resp.Body.Close()

		// Success - convert to structured data and return
		return c.convertToStructuredData(rawData), nil
	}

	// All retries exhausted
	return nil, fmt.Errorf("failed after %d retries: %w", maxRetries+1, lastErr)
}

// isRetryableError checks if an error is retryable
func isRetryableError(err error) bool {
	// Network errors, timeouts, and temporary errors are retryable
	if err == nil {
		return false
	}

	// Check for common retryable error patterns
	errStr := err.Error()
	retryablePatterns := []string{
		"timeout",
		"connection refused",
		"connection reset",
		"temporary failure",
		"no such host", // DNS temporary failures
		"i/o timeout",
	}

	for _, pattern := range retryablePatterns {
		if strings.Contains(strings.ToLower(errStr), pattern) {
			return true
		}
	}

	return false
}

// isRetryableStatusCode checks if an HTTP status code is retryable
func isRetryableStatusCode(statusCode int) bool {
	// 5xx errors are retryable (server errors)
	// 429 (Too Many Requests) is retryable
	return statusCode >= 500 || statusCode == 429
}

// convertToStructuredData converts raw JSON data to structured SimilarWebData
func (c *Client) convertToStructuredData(rawData map[string]interface{}) *SimilarWebData {
	// Convert to structured data
	data := &SimilarWebData{
		RawResponse: rawData,
	}

	// Extract known fields (handle both snake_case and PascalCase)
	if globalRank, ok := rawData["GlobalRank"].(float64); ok {
		rank := int(globalRank)
		data.GlobalRank = &rank
	} else if globalRank, ok := rawData["global_rank"].(float64); ok {
		rank := int(globalRank)
		data.GlobalRank = &rank
	}

	if categoryRank, ok := rawData["CategoryRank"].(float64); ok {
		rank := int(categoryRank)
		data.CategoryRank = &rank
	} else if categoryRank, ok := rawData["category_rank"].(float64); ok {
		rank := int(categoryRank)
		data.CategoryRank = &rank
	}

	if category, ok := rawData["Category"].(string); ok {
		data.Category = category
	} else if category, ok := rawData["category"].(string); ok {
		data.Category = category
	}

	if totalVisits, ok := rawData["TotalVisits"].(float64); ok {
		data.TotalVisits = &totalVisits
	} else if totalVisits, ok := rawData["total_visits"].(float64); ok {
		data.TotalVisits = &totalVisits
	}

	// Extract top country ranks
	if topCountries, ok := rawData["TopCountryRanks"].([]interface{}); ok {
		for _, country := range topCountries {
			if countryMap, ok := country.(map[string]interface{}); ok {
				cr := CountryRank{}
				if name, ok := countryMap["Country"].(string); ok {
					cr.Country = name
				}
				if rank, ok := countryMap["Rank"].(float64); ok {
					cr.Rank = int(rank)
				}
				data.TopCountryRanks = append(data.TopCountryRanks, cr)
			}
		}
	}

	// Extract top country shares (traffic distribution by country)
	if topCountryShares, ok := rawData["TopCountryShares"].([]interface{}); ok {
		for _, country := range topCountryShares {
			if countryMap, ok := country.(map[string]interface{}); ok {
				cs := CountryShare{}
				if code, ok := countryMap["CountryCode"].(string); ok {
					cs.CountryCode = code
				} else if code, ok := countryMap["Country"].(float64); ok {
					// Handle country code as number, convert to string
					cs.CountryCode = fmt.Sprintf("%.0f", code)
				}
				if share, ok := countryMap["Value"].(float64); ok {
					cs.Share = share
				}
				if cs.CountryCode != "" {
					data.TopCountryShares = append(data.TopCountryShares, cs)
				}
			}
		}
	}

	// Extract traffic sources
	if trafficSources, ok := rawData["TrafficSources"].(map[string]interface{}); ok {
		data.TrafficSources = &TrafficSources{}
		if direct, ok := trafficSources["Direct"].(float64); ok {
			data.TrafficSources.Direct = &direct
		}
		if referrals, ok := trafficSources["Referrals"].(float64); ok {
			data.TrafficSources.Referrals = &referrals
		}
		if search, ok := trafficSources["Search"].(float64); ok {
			data.TrafficSources.Search = &search
		}
		if social, ok := trafficSources["Social"].(float64); ok {
			data.TrafficSources.Social = &social
		}
		if mail, ok := trafficSources["Mail"].(float64); ok {
			data.TrafficSources.Mail = &mail
		}
		if paid, ok := trafficSources["Paid"].(float64); ok {
			data.TrafficSources.Paid = &paid
		}
	}

	// Extract engagement metrics
	if engagement, ok := rawData["EngagementMetrics"].(map[string]interface{}); ok {
		data.EngagementMetrics = &EngagementMetrics{}
		if bounceRate, ok := engagement["BounceRate"].(float64); ok {
			data.EngagementMetrics.BounceRate = &bounceRate
		}
		if pagesPerVisit, ok := engagement["PagesPerVisit"].(float64); ok {
			data.EngagementMetrics.PagesPerVisit = &pagesPerVisit
		}
		if avgDuration, ok := engagement["AvgVisitDuration"].(float64); ok {
			data.EngagementMetrics.AvgVisitDuration = &avgDuration
		}
	}

	return data
}
