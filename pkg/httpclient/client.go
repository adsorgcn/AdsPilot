package httpclient

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/ScientificInternet/Google-Monetize/pkg/idempotency"
	"math"
	"net/http"
	"strings"
	"time"
)

// Client is a simple wrapper around http.Client.
type Client struct {
	httpClient *http.Client
	cb         *CircuitBreaker
}

// New creates a new Client with a default timeout.
func New(timeout time.Duration) *Client {
	return &Client{httpClient: &http.Client{Timeout: timeout}}
}

// Do exposes underlying http.Client.Do for advanced use-cases.
func (c *Client) Do(req *http.Request) (*http.Response, error) {
	if c.cb != nil && !c.cb.Allow() {
		return nil, fmt.Errorf("circuit_open")
	}
	resp, err := c.httpClient.Do(req)
	if c.cb != nil {
		c.cb.Record(err == nil)
	}
	return resp, err
}

// GetJSON performs a GET request and decodes the JSON response into the target interface.
func (c *Client) GetJSON(ctx context.Context, url string, target interface{}) error {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Google-Monetize-HTTP-Client/1.0")
	// propagate idempotency key if available
	if k, ok := idempotency.FromContext(ctx); ok && k != "" {
		req.Header.Set("X-Idempotency-Key", k)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status code: %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		return fmt.Errorf("failed to decode json response: %w", err)
	}

	return nil
}

// GetJSONWithHeaders performs GET and decodes JSON with custom headers and simple retries.
// retries includes the first attempt, e.g., retries=3 means 1 + 2 retries on failure.
func (c *Client) GetJSONWithHeaders(ctx context.Context, url string, headers map[string]string, retries int, target interface{}) error {
	if retries <= 0 {
		retries = 1
	}
	var lastErr error
	for attempt := 0; attempt < retries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return fmt.Errorf("failed to create request: %w", err)
		}
		// defaults
		req.Header.Set("Accept", "application/json")
		ua := "Google-Monetize-HTTP-Client/1.0"
		if hUA, ok := headers["User-Agent"]; ok && hUA != "" {
			ua = hUA
		}
		req.Header.Set("User-Agent", ua)
		// propagate idempotency key if available
		if k, ok := idempotency.FromContext(ctx); ok && k != "" {
			req.Header.Set("X-Idempotency-Key", k)
		}
		// apply extra headers
		for k, v := range headers {
			if k != "User-Agent" && v != "" {
				req.Header.Set(k, v)
			}
		}

		resp, err := c.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("request error: %w", err)
		} else {
			func() {
				defer resp.Body.Close()
				if resp.StatusCode != http.StatusOK {
					lastErr = fmt.Errorf("bad status code: %d", resp.StatusCode)
					return
				}
				if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
					lastErr = fmt.Errorf("failed to decode json response: %w", err)
					return
				}
				lastErr = nil
			}()
		}
		if lastErr == nil {
			return nil
		}
		if attempt+1 < retries {
			// exponential backoff with jitterless simple cap
			sleepMs := int(math.Min(1500, float64(200*int(math.Pow(2, float64(attempt))))))
			time.Sleep(time.Duration(sleepMs) * time.Millisecond)
		}
	}
	return lastErr
}

// PostJSONWithRetry posts JSON body, applies headers, decodes JSON response to target, with retries.
func (c *Client) PostJSONWithRetry(ctx context.Context, url string, body interface{}, headers map[string]string, retries int, target interface{}) error {
	if retries <= 0 {
		retries = 1
	}
	var lastErr error
	var payload []byte
	if body != nil {
		if b, err := json.Marshal(body); err == nil {
			payload = b
		}
	}
	for attempt := 0; attempt < retries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, strings.NewReader(string(payload)))
		if err != nil {
			return err
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("Content-Type", "application/json")
		if k, ok := idempotency.FromContext(ctx); ok && k != "" {
			req.Header.Set("X-Idempotency-Key", k)
		}
		for k, v := range headers {
			if v != "" {
				req.Header.Set(k, v)
			}
		}
		resp, err := c.Do(req)
		if err != nil {
			lastErr = err
		} else {
			func() {
				defer resp.Body.Close()
				if resp.StatusCode < 200 || resp.StatusCode >= 300 {
					lastErr = fmt.Errorf("bad status: %d", resp.StatusCode)
					return
				}
				if target != nil {
					if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
						lastErr = err
						return
					}
				}
				lastErr = nil
			}()
		}
		if lastErr == nil {
			return nil
		}
		if attempt+1 < retries {
			sleepMs := int(math.Min(1500, float64(200*int(math.Pow(2, float64(attempt))))))
			time.Sleep(time.Duration(sleepMs) * time.Millisecond)
		}
	}
	return lastErr
}

// EnableCircuitBreaker attaches a simple circuit breaker to the client.
func (c *Client) EnableCircuitBreaker(failThreshold int, cooldown time.Duration) {
	c.cb = &CircuitBreaker{failThreshold: failThreshold, cooldown: cooldown}
}
