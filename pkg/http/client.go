package http

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	base "github.com/ScientificInternet/Google-Monetize/pkg/httpclient"
	"github.com/ScientificInternet/Google-Monetize/pkg/idempotency"
)

// Error is a unified error shape for outbound HTTP calls.
// It intentionally keeps a minimal set of fields to avoid over-design.
type Error struct {
	Code       string                 `json:"code"`
	Message    string                 `json:"message"`
	StatusCode int                    `json:"status"`
	Details    map[string]interface{} `json:"details,omitempty"`
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	if e.Code != "" {
		return fmt.Sprintf("%s: %s", e.Code, e.Message)
	}
	if e.Message != "" {
		return e.Message
	}
	return fmt.Sprintf("http_error: %d", e.StatusCode)
}

// Client is a thin wrapper that delegates transport + resilience to pkg/httpclient
// and adds unified error decoding on top.
type Client struct {
	c *base.Client
}

// New returns a Client with default timeout (5s) unless overridden.
func New(timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	cli := base.New(timeout)
	// default: enable simple circuit breaker
	cli.EnableCircuitBreaker(5, 10*time.Second)
	return &Client{c: cli}
}

// DoJSON performs an HTTP request with JSON body and decodes JSON response into target.
// headers may be nil. retries<=0 means 1 attempt.
func (hc *Client) DoJSON(ctx context.Context, method, url string, body interface{}, headers map[string]string, retries int, target interface{}) error {
	if method == http.MethodGet {
		// route GET via httpclient helper with simple headers
		return hc.c.GetJSONWithHeaders(ctx, url, headersOrDefault(headers), normRetries(retries), target)
	}
	// Use underlying PostJSONWithRetry for non-GET
	return hc.c.PostJSONWithRetry(ctx, url, body, headersOrDefault(headers), normRetries(retries), target)
}

// DoRaw issues a request and returns the raw http.Response for advanced handling.
func (hc *Client) DoRaw(req *http.Request) (*http.Response, error) { return hc.c.Do(req) }

// DecodeError tries to parse a unified error body. If it fails, construct from status.
func DecodeError(resp *http.Response) *Error {
	if resp == nil {
		return &Error{Code: "no_response", Message: "no response", StatusCode: 0}
	}
	defer func() { _ = resp.Body.Close() }()
	// Try to decode both unified shape {"error":{...}} and flat shape {code,message,...}
	type inner struct {
		Code    string                 `json:"code"`
		Message string                 `json:"message"`
		Details map[string]interface{} `json:"details,omitempty"`
		TraceID *string                `json:"traceId,omitempty"`
	}
	var w struct {
		Error   *inner                 `json:"error,omitempty"`
		Code    string                 `json:"code,omitempty"`
		Message string                 `json:"message,omitempty"`
		Details map[string]interface{} `json:"details,omitempty"`
		TraceID *string                `json:"traceId,omitempty"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&w); err == nil {
		// Prefer nested error if present
		if w.Error != nil && (w.Error.Code != "" || w.Error.Message != "") {
			e := &Error{Code: w.Error.Code, Message: w.Error.Message, StatusCode: resp.StatusCode, Details: w.Error.Details}
			if w.Error.TraceID != nil && *w.Error.TraceID != "" {
				if e.Details == nil {
					e.Details = map[string]interface{}{}
				}
				e.Details["traceId"] = *w.Error.TraceID
			}
			return e
		}
		if w.Code != "" || w.Message != "" {
			e := &Error{Code: w.Code, Message: w.Message, StatusCode: resp.StatusCode, Details: w.Details}
			if w.TraceID != nil && *w.TraceID != "" {
				if e.Details == nil {
					e.Details = map[string]interface{}{}
				}
				e.Details["traceId"] = *w.TraceID
			}
			return e
		}
	}
	return &Error{Code: "http_error", Message: http.StatusText(resp.StatusCode), StatusCode: resp.StatusCode}
}

// WithIdempotency injects an X-Idempotency-Key into context for downstream propagation.
func WithIdempotency(ctx context.Context, key string) context.Context {
	if key == "" {
		return ctx
	}
	if !idempotency.Validate(key) {
		return ctx
	}
	return idempotency.WithContext(ctx, key)
}

func headersOrDefault(h map[string]string) map[string]string {
	if h == nil {
		h = map[string]string{}
	}
	if _, ok := h["Accept"]; !ok {
		h["Accept"] = "application/json"
	}
	if _, ok := h["Content-Type"]; !ok {
		h["Content-Type"] = "application/json"
	}
	if _, ok := h["User-Agent"]; !ok {
		h["User-Agent"] = "Google-Monetize-HTTP/1.0"
	}
	return h
}

func normRetries(n int) int {
	if n <= 0 {
		return 1
	}
	return n
}
