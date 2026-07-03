package clients

import (
	"context"
	"fmt"
	"net/http"
	"time"

	httpclient "github.com/ScientificInternet/Google-Monetize/pkg/http"
)

// SiterankClient is a client for the Siterank service
type SiterankClient struct {
	baseURL string
	client  *httpclient.Client
}

// NewSiterankClient creates a new Siterank service client
func NewSiterankClient(baseURL string) *SiterankClient {
	return &SiterankClient{
		baseURL: baseURL,
		client:  httpclient.New(15 * time.Second),
	}
}

// DomainRank represents a domain ranking result
type DomainRank struct {
	Domain    string    `json:"domain"`
	Rank      int       `json:"rank"`
	Score     float64   `json:"score"`
	Category  string    `json:"category"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// GetDomainRank retrieves the ranking for a domain
func (c *SiterankClient) GetDomainRank(ctx context.Context, domain string) (*DomainRank, error) {
	url := fmt.Sprintf("%s/api/v1/rank/%s", c.baseURL, domain)

	var rank DomainRank
	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 3, &rank); err != nil {
		return nil, fmt.Errorf("failed to get domain rank: %w", err)
	}

	return &rank, nil
}

// BatchDomainRanksRequest represents a request to get multiple domain ranks
type BatchDomainRanksRequest struct {
	Domains []string `json:"domains"`
}

// BatchDomainRanksResponse represents the response from batch domain ranking
type BatchDomainRanksResponse struct {
	Results []DomainRank      `json:"results"`
	Errors  map[string]string `json:"errors,omitempty"` // domain -> error message
}

// GetBatchDomainRanks retrieves rankings for multiple domains
func (c *SiterankClient) GetBatchDomainRanks(ctx context.Context, domains []string) (*BatchDomainRanksResponse, error) {
	url := fmt.Sprintf("%s/api/v1/rank/batch", c.baseURL)

	req := BatchDomainRanksRequest{Domains: domains}

	var resp BatchDomainRanksResponse
	if err := c.client.DoJSON(ctx, http.MethodPost, url, req, nil, 3, &resp); err != nil {
		return nil, fmt.Errorf("failed to get batch domain ranks: %w", err)
	}

	return &resp, nil
}

// RankingJob represents a ranking job
type RankingJob struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Domains   []string  `json:"domains"`
	Status    string    `json:"status"`
	Progress  int       `json:"progress"` // 0-100
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ListRankingJobsRequest represents the request for listing ranking jobs
type ListRankingJobsRequest struct {
	UserID string
	Status string
	Limit  int
	Offset int
}

// ListRankingJobsResponse represents the response from listing ranking jobs
type ListRankingJobsResponse struct {
	Items      []RankingJob `json:"items"`
	TotalCount int          `json:"totalCount"`
}

// ListRankingJobs retrieves ranking jobs for a user
func (c *SiterankClient) ListRankingJobs(ctx context.Context, req ListRankingJobsRequest) (*ListRankingJobsResponse, error) {
	url := fmt.Sprintf("%s/api/v1/jobs?userId=%s", c.baseURL, req.UserID)
	if req.Status != "" {
		url += fmt.Sprintf("&status=%s", req.Status)
	}
	if req.Limit > 0 {
		url += fmt.Sprintf("&limit=%d", req.Limit)
	}
	if req.Offset > 0 {
		url += fmt.Sprintf("&offset=%d", req.Offset)
	}

	var resp ListRankingJobsResponse
	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 3, &resp); err != nil {
		return nil, fmt.Errorf("failed to list ranking jobs: %w", err)
	}

	return &resp, nil
}

// Health checks the health of the Siterank service
func (c *SiterankClient) Health(ctx context.Context) error {
	url := fmt.Sprintf("%s/health", c.baseURL)

	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 1, &struct{}{}); err != nil {
		return fmt.Errorf("siterank service unhealthy: %w", err)
	}

	return nil
}
