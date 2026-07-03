package billing

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client 是 Billing 服务的客户端
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient 创建一个新的 Billing 客户端
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = os.Getenv("BILLING_SERVICE_URL")
		if baseURL == "" {
			baseURL = "http://billing:8080"
		}
	}

	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// NewClientFromEnv 从环境变量创建客户端
func NewClientFromEnv() *Client {
	return NewClient("")
}

// ConsumeTokensRequest 消费 Token 的请求
type ConsumeTokensRequest struct {
	Amount  int    `json:"amount"`
	Service string `json:"service"`
	Action  string `json:"action"`
	Reason  string `json:"reason"`
}

// ConsumeTokensResponse 消费 Token 的响应
type ConsumeTokensResponse struct {
	TransactionID string    `json:"transactionId"`
	UserID        string    `json:"userId"`
	Amount        int       `json:"amount"`
	Balance       int       `json:"balance"`
	ConsumedAt    time.Time `json:"consumedAt"`
}

// ErrorResponse 错误响应
type ErrorResponse struct {
	Error   string                 `json:"error"`
	Code    string                 `json:"code,omitempty"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// ConsumeTokens 直接消费用户的 Token
func (c *Client) ConsumeTokens(ctx context.Context, userID string, req ConsumeTokensRequest) (*ConsumeTokensResponse, error) {
	url := fmt.Sprintf("%s/api/v1/users/%s/tokens/consume", c.baseURL, userID)

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	// 添加服务间认证 token（如果有）
	if serviceToken := os.Getenv("SERVICE_TOKEN"); serviceToken != "" {
		httpReq.Header.Set("X-Service-Token", serviceToken)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// 处理错误响应
	if resp.StatusCode != http.StatusOK {
		var errResp ErrorResponse
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
			return nil, fmt.Errorf("request failed with status %d", resp.StatusCode)
		}

		// 特殊处理余额不足错误
		if resp.StatusCode == http.StatusPaymentRequired {
			return nil, &InsufficientTokensError{
				Message: errResp.Error,
				Details: errResp.Details,
			}
		}

		return nil, fmt.Errorf("billing service error: %s (status: %d)", errResp.Error, resp.StatusCode)
	}

	var result ConsumeTokensResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// InsufficientTokensError 余额不足错误
type InsufficientTokensError struct {
	Message string
	Details map[string]interface{}
}

func (e *InsufficientTokensError) Error() string {
	return e.Message
}

// IsInsufficientTokens 检查错误是否为余额不足
func IsInsufficientTokens(err error) bool {
	_, ok := err.(*InsufficientTokensError)
	return ok
}

// GetUserBalance 获取用户的 Token 余额
func (c *Client) GetUserBalance(ctx context.Context, userID string) (*TokenBalance, error) {
	url := fmt.Sprintf("%s/api/v1/users/%s/tokens/balance", c.baseURL, userID)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// 添加服务间认证 token（如果有）
	if serviceToken := os.Getenv("SERVICE_TOKEN"); serviceToken != "" {
		httpReq.Header.Set("X-Service-Token", serviceToken)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("request failed with status %d", resp.StatusCode)
	}

	var balance TokenBalance
	if err := json.NewDecoder(resp.Body).Decode(&balance); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &balance, nil
}

// TokenBalance Token 余额信息
type TokenBalance struct {
	UserID    string `json:"userId"`
	Available int    `json:"available"`
	Reserved  int    `json:"reserved"`
	Total     int    `json:"total"`
}
