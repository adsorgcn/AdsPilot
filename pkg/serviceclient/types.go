// Package serviceclient provides a unified way to call internal services
// with circuit breakers, retries, and service discovery.
//
// Usage:
//
//	registry := serviceclient.NewRegistry()
//	result, err := registry.Call(ctx, "billing", serviceclient.Request{
//	    Method: "POST",
//	    Path: "/api/v1/tokens/reserve",
//	    Body: map[string]interface{}{"amount": 10},
//	})
package serviceclient

import (
	"time"
)

// Request represents an HTTP request to an internal service
type Request struct {
	Method  string            // HTTP method: GET, POST, PUT, PATCH, DELETE
	Path    string            // API path (e.g., "/api/v1/tokens/reserve")
	Body    interface{}       // Request body (will be JSON encoded)
	Headers map[string]string // Optional custom headers
	Timeout time.Duration     // Optional timeout (overrides default)
}

// Response represents the HTTP response from an internal service
type Response struct {
	StatusCode int                 // HTTP status code
	Body       []byte              // Raw response body
	Headers    map[string][]string // Response headers
}

// ServiceConfig configures a single service endpoint
type ServiceConfig struct {
	Name           string        // Service name (e.g., "billing", "offer")
	URL            string        // Base URL (e.g., "http://billing:8080")
	Timeout        time.Duration // Default timeout for requests
	MaxRetries     int           // Maximum number of retries
	CircuitBreaker CircuitBreakerConfig
}

// CircuitBreakerConfig configures circuit breaker behavior
type CircuitBreakerConfig struct {
	Enabled     bool                     // Enable circuit breaker
	MaxRequests uint32                   // Max requests allowed when half-open
	Interval    time.Duration            // Interval to clear internal counters
	Timeout     time.Duration            // Time to wait before attempting to recover
	ReadyToTrip func(counts Counts) bool // Custom function to determine when to trip
}

// Counts holds the numbers of requests and their successes/failures
type Counts struct {
	Requests             uint32
	TotalSuccesses       uint32
	TotalFailures        uint32
	ConsecutiveSuccesses uint32
	ConsecutiveFailures  uint32
}

// DefaultCircuitBreakerConfig returns sensible defaults for circuit breaker
func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		Enabled:     true,
		MaxRequests: 3,
		Interval:    60 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts Counts) bool {
			// Trip after 5 consecutive failures
			return counts.ConsecutiveFailures >= 5
		},
	}
}
