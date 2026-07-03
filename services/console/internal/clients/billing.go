package clients

import (
	"context"
	"fmt"
	"net/http"
	"time"

	httpclient "github.com/ScientificInternet/Google-Monetize/pkg/http"
)

// BillingClient is a client for the Billing service
type BillingClient struct {
	baseURL string
	client  *httpclient.Client
}

// NewBillingClient creates a new Billing service client
func NewBillingClient(baseURL string) *BillingClient {
	return &BillingClient{
		baseURL: baseURL,
		client:  httpclient.New(10 * time.Second),
	}
}

// TokenBalance represents a user's token balance
type TokenBalance struct {
	UserID    string    `json:"userId"`
	Available int       `json:"available"`
	Reserved  int       `json:"reserved"`
	Total     int       `json:"total"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// GetTokenBalance retrieves the token balance for a user
func (c *BillingClient) GetTokenBalance(ctx context.Context, userID string) (*TokenBalance, error) {
	url := fmt.Sprintf("%s/api/v1/tokens/%s/balance", c.baseURL, userID)

	var balance TokenBalance
	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 3, &balance); err != nil {
		return nil, fmt.Errorf("failed to get token balance: %w", err)
	}

	return &balance, nil
}

// TokenTransaction represents a token transaction
type TokenTransaction struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Amount      int       `json:"amount"`
	Type        string    `json:"type"` // topup, consume, reserve, release
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

// ListTokenTransactionsRequest represents the request for listing transactions
type ListTokenTransactionsRequest struct {
	UserID    string
	Type      string
	Limit     int
	Offset    int
	StartDate *time.Time
	EndDate   *time.Time
}

// ListTokenTransactionsResponse represents the response from listing transactions
type ListTokenTransactionsResponse struct {
	Items      []TokenTransaction `json:"items"`
	TotalCount int                `json:"totalCount"`
}

// ListTokenTransactions retrieves token transactions for a user
func (c *BillingClient) ListTokenTransactions(ctx context.Context, req ListTokenTransactionsRequest) (*ListTokenTransactionsResponse, error) {
	url := fmt.Sprintf("%s/api/v1/tokens/%s/transactions", c.baseURL, req.UserID)

	first := true
	addParam := func(key, value string) {
		if value == "" {
			return
		}
		if first {
			url += "?"
			first = false
		} else {
			url += "&"
		}
		url += fmt.Sprintf("%s=%s", key, value)
	}

	addParam("type", req.Type)
	if req.Limit > 0 {
		addParam("limit", fmt.Sprintf("%d", req.Limit))
	}
	if req.Offset > 0 {
		addParam("offset", fmt.Sprintf("%d", req.Offset))
	}
	if req.StartDate != nil {
		addParam("startDate", req.StartDate.Format(time.RFC3339))
	}
	if req.EndDate != nil {
		addParam("endDate", req.EndDate.Format(time.RFC3339))
	}

	var resp ListTokenTransactionsResponse
	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 3, &resp); err != nil {
		return nil, fmt.Errorf("failed to list transactions: %w", err)
	}

	return &resp, nil
}

// TopUpTokensRequest represents a request to top up tokens
type TopUpTokensRequest struct {
	UserID         string `json:"userId"`
	Amount         int    `json:"amount"`
	Description    string `json:"description,omitempty"`
	IdempotencyKey string `json:"-"` // Used in header
}

// TopUpTokensResponse represents the response from topping up tokens
type TopUpTokensResponse struct {
	TransactionID string       `json:"transactionId"`
	Balance       TokenBalance `json:"balance"`
}

// TopUpTokens adds tokens to a user's account
func (c *BillingClient) TopUpTokens(ctx context.Context, req TopUpTokensRequest) (*TopUpTokensResponse, error) {
	url := fmt.Sprintf("%s/api/v1/tokens/%s/topup", c.baseURL, req.UserID)
	var resp TopUpTokensResponse
	headers := map[string]string{}
	if req.IdempotencyKey != "" {
		headers["X-Idempotency-Key"] = req.IdempotencyKey
	}
	if err := c.client.DoJSON(ctx, http.MethodPost, url, req, headers, 3, &resp); err != nil {
		return nil, fmt.Errorf("failed to top up tokens: %w", err)
	}

	return &resp, nil
}

// TokenUsageSummary represents token usage summary for a user
type TokenUsageSummary struct {
	UserID        string         `json:"userId"`
	TotalConsumed int            `json:"totalConsumed"`
	TotalTopUp    int            `json:"totalTopUp"`
	ByService     map[string]int `json:"byService"` // service -> amount
	StartDate     time.Time      `json:"startDate"`
	EndDate       time.Time      `json:"endDate"`
}

// GetTokenUsageSummary retrieves token usage summary for a user
func (c *BillingClient) GetTokenUsageSummary(ctx context.Context, userID string, startDate, endDate time.Time) (*TokenUsageSummary, error) {
	url := fmt.Sprintf("%s/api/v1/tokens/%s/usage?startDate=%s&endDate=%s",
		c.baseURL, userID,
		startDate.Format(time.RFC3339),
		endDate.Format(time.RFC3339))

	var summary TokenUsageSummary
	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 3, &summary); err != nil {
		return nil, fmt.Errorf("failed to get usage summary: %w", err)
	}

	return &summary, nil
}

// Health checks the health of the Billing service
func (c *BillingClient) Health(ctx context.Context) error {
	url := fmt.Sprintf("%s/health", c.baseURL)

	if err := c.client.DoJSON(ctx, http.MethodGet, url, nil, nil, 1, &struct{}{}); err != nil {
		return fmt.Errorf("billing service unhealthy: %w", err)
	}

	return nil
}
