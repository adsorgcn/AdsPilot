package clients

import (
	"context"
	"fmt"
	"net/http"
	"time"

	httpclient "github.com/ScientificInternet/Google-Monetize/pkg/http"
)

// AdscenterClient is a client for the Adscenter service
type AdscenterClient struct {
	baseURL string
	client  *httpclient.Client
}

// NewAdscenterClient creates a new Adscenter service client
func NewAdscenterClient(baseURL string) *AdscenterClient {
	return &AdscenterClient{
		baseURL: baseURL,
		client:  httpclient.New(10 * time.Second),
	}
}

// Account represents an ads account
type Account struct {
	ID          string                 `json:"id"`
	UserID      string                 `json:"userId"`
	Platform    string                 `json:"platform"`
	Status      string                 `json:"status"`
	Credentials map[string]interface{} `json:"credentials,omitempty"`
	CreatedAt   time.Time              `json:"createdAt"`
	UpdatedAt   time.Time              `json:"updatedAt"`
}

// ListAccountsRequest represents the request for listing accounts
type ListAccountsRequest struct {
	UserID   string
	Platform string
	Status   string
	Limit    int
	Offset   int
}

// ListAccountsResponse represents the response from listing accounts
type ListAccountsResponse struct {
	Items      []Account `json:"items"`
	TotalCount int       `json:"totalCount"`
}

// ListAccounts retrieves ads accounts for a user
func (c *AdscenterClient) ListAccounts(ctx context.Context, req ListAccountsRequest) (*ListAccountsResponse, error) {
	url := fmt.Sprintf("%s/api/v1/accounts?userId=%s", c.baseURL, req.UserID)
	if req.Platform != "" {
		url += fmt.Sprintf("&platform=%s", req.Platform)
	}
	if req.Status != "" {
		url += fmt.Sprintf("&status=%s", req.Status)
	}
	if req.Limit > 0 {
		url += fmt.Sprintf("&limit=%d", req.Limit)
	}
	if req.Offset > 0 {
		url += fmt.Sprintf("&offset=%d", req.Offset)
	}

	var resp ListAccountsResponse
	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 3, &resp); err != nil {
		return nil, fmt.Errorf("failed to list accounts: %w", err)
	}

	return &resp, nil
}

// GetAccount retrieves a single account by ID
func (c *AdscenterClient) GetAccount(ctx context.Context, accountID string) (*Account, error) {
	url := fmt.Sprintf("%s/api/v1/accounts/%s", c.baseURL, accountID)

	var account Account
	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 3, &account); err != nil {
		return nil, fmt.Errorf("failed to get account: %w", err)
	}

	return &account, nil
}

// BulkOperation represents a bulk operation in adscenter
type BulkOperation struct {
	ID               string                 `json:"id"`
	UserID           string                 `json:"userId"`
	Status           string                 `json:"status"`
	TotalActions     int                    `json:"totalActions"`
	CompletedActions int                    `json:"completedActions"`
	FailedActions    int                    `json:"failedActions"`
	Plan             map[string]interface{} `json:"plan"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

// ListBulkOperationsRequest represents the request for listing bulk operations
type ListBulkOperationsRequest struct {
	UserID string
	Status string
	Limit  int
	Offset int
}

// ListBulkOperationsResponse represents the response from listing bulk operations
type ListBulkOperationsResponse struct {
	Items      []BulkOperation `json:"items"`
	TotalCount int             `json:"totalCount"`
}

// ListBulkOperations retrieves bulk operations for a user
func (c *AdscenterClient) ListBulkOperations(ctx context.Context, req ListBulkOperationsRequest) (*ListBulkOperationsResponse, error) {
	url := fmt.Sprintf("%s/api/v1/bulk-actions?userId=%s", c.baseURL, req.UserID)
	if req.Status != "" {
		url += fmt.Sprintf("&status=%s", req.Status)
	}
	if req.Limit > 0 {
		url += fmt.Sprintf("&limit=%d", req.Limit)
	}
	if req.Offset > 0 {
		url += fmt.Sprintf("&offset=%d", req.Offset)
	}

	var resp ListBulkOperationsResponse
	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 3, &resp); err != nil {
		return nil, fmt.Errorf("failed to list bulk operations: %w", err)
	}

	return &resp, nil
}

// Health checks the health of the Adscenter service
func (c *AdscenterClient) Health(ctx context.Context) error {
	url := fmt.Sprintf("%s/health", c.baseURL)

	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 1, &struct{}{}); err != nil {
		return fmt.Errorf("adscenter service unhealthy: %w", err)
	}

	return nil
}
