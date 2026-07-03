package serviceclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client handles HTTP communication with internal services
type Client struct {
	httpClient *http.Client
	config     ServiceConfig
}

// NewClient creates a new service client with the given configuration
func NewClient(config ServiceConfig) *Client {
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 10 * time.Second // Default timeout
	}

	return &Client{
		httpClient: &http.Client{
			Timeout: timeout,
		},
		config: config,
	}
}

// Do executes an HTTP request to the service
func (c *Client) Do(ctx context.Context, req Request) (*Response, error) {
	// Apply default timeout if not specified
	if req.Timeout == 0 {
		req.Timeout = c.config.Timeout
	}

	// Create context with timeout
	if req.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, req.Timeout)
		defer cancel()
	}

	// Build full URL
	url := c.config.URL + req.Path

	// Encode request body
	var bodyReader io.Reader
	if req.Body != nil {
		bodyBytes, err := json.Marshal(req.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, req.Method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	// Set default headers
	if req.Body != nil {
		httpReq.Header.Set("Content-Type", "application/json")
	}
	httpReq.Header.Set("Accept", "application/json")

	// Set custom headers
	for key, value := range req.Headers {
		httpReq.Header.Set(key, value)
	}

	// Execute request
	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer httpResp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Build response
	response := &Response{
		StatusCode: httpResp.StatusCode,
		Body:       respBody,
		Headers:    httpResp.Header,
	}

	// Check for HTTP errors
	if httpResp.StatusCode >= 400 {
		return response, fmt.Errorf("HTTP %d: %s", httpResp.StatusCode, string(respBody))
	}

	return response, nil
}

// DoJSON is a convenience method that unmarshals the response body into a result
func (c *Client) DoJSON(ctx context.Context, req Request, result interface{}) error {
	resp, err := c.Do(ctx, req)
	if err != nil {
		return err
	}

	if result != nil && len(resp.Body) > 0 {
		if err := json.Unmarshal(resp.Body, result); err != nil {
			return fmt.Errorf("failed to unmarshal response: %w", err)
		}
	}

	return nil
}

// DoWithRetry executes a request with automatic retries on failure
func (c *Client) DoWithRetry(ctx context.Context, req Request) (*Response, error) {
	maxRetries := c.config.MaxRetries
	if maxRetries == 0 {
		maxRetries = 3 // Default
	}

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 100ms, 200ms, 400ms, ...
			backoff := time.Duration(100*(1<<uint(attempt-1))) * time.Millisecond
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		resp, err := c.Do(ctx, req)
		if err == nil {
			return resp, nil
		}

		lastErr = err

		// Don't retry on client errors (4xx)
		if resp != nil && resp.StatusCode >= 400 && resp.StatusCode < 500 {
			break
		}
	}

	return nil, fmt.Errorf("all retries failed (attempted %d times): %w", maxRetries+1, lastErr)
}
