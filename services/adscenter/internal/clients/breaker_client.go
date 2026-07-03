package clients

import (
	"context"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/circuitbreaker"
	httpx "github.com/ScientificInternet/Google-Monetize/pkg/http"
)

// BreakerClient wraps an HTTP client with circuit breaker protection and monitoring
// Note: pkg/http already has a built-in circuit breaker, this adds an additional
// layer for monitoring and service-specific configuration
type BreakerClient struct {
	client  *httpx.Client
	baseURL string
	breaker *circuitbreaker.Breaker
}

// Config holds configuration for the breaker client
type Config struct {
	Name    string        // Service name for monitoring
	BaseURL string        // Base URL of the service
	Timeout time.Duration // HTTP timeout
}

// NewBreakerClient creates a new HTTP client with circuit breaker monitoring
func NewBreakerClient(cfg Config) *BreakerClient {
	if cfg.Timeout <= 0 {
		cfg.Timeout = 5 * time.Second
	}

	// pkg/http.Client already has a built-in circuit breaker (5 failures, 10s timeout)
	httpClient := httpx.New(cfg.Timeout)

	// Add additional circuit breaker for monitoring and service-specific config
	breakerCfg := circuitbreaker.DefaultConfig(cfg.Name)
	breaker := circuitbreaker.NewBreaker(breakerCfg)

	return &BreakerClient{
		client:  httpClient,
		baseURL: cfg.BaseURL,
		breaker: breaker,
	}
}

// DoJSON performs a JSON request with circuit breaker protection
func (c *BreakerClient) DoJSON(
	ctx context.Context,
	method string,
	url string,
	body interface{},
	headers map[string]string,
	retries int,
	result interface{},
) error {
	_, err := c.breaker.Execute(func() (any, error) {
		err := c.client.DoJSON(ctx, method, url, body, headers, retries, result)
		if err != nil {
			return nil, err
		}
		return result, nil
	})
	return err
}

// BaseURL returns the base URL of the service
func (c *BreakerClient) BaseURL() string {
	return c.baseURL
}

// State returns the current circuit breaker state
func (c *BreakerClient) State() string {
	return c.breaker.State().String()
}

// Counts returns circuit breaker statistics
func (c *BreakerClient) Counts() map[string]uint32 {
	counts := c.breaker.Counts()
	return map[string]uint32{
		"requests":             counts.Requests,
		"totalSuccesses":       counts.TotalSuccesses,
		"totalFailures":        counts.TotalFailures,
		"consecutiveSuccesses": counts.ConsecutiveSuccesses,
		"consecutiveFailures":  counts.ConsecutiveFailures,
	}
}
