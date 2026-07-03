package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/config"
	"github.com/gin-gonic/gin"
)

// MockRateLimitCache implements RateLimitCache interface for testing
type MockRateLimitCache struct {
	counters map[string]int
}

func NewMockRateLimitCache() *MockRateLimitCache {
	return &MockRateLimitCache{
		counters: make(map[string]int),
	}
}

func (m *MockRateLimitCache) IncrementRateLimit(ctx context.Context, key string, ttl time.Duration) (int, error) {
	m.counters[key]++
	return m.counters[key], nil
}

func TestRateLimitMiddleware_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		enabled        bool
		limit          int
		requests       int
		setupContext   func(*gin.Context)
		expectedStatus int
		expectAbort    bool
	}{
		{
			name:     "disabled rate limiting",
			enabled:  false,
			limit:    10,
			requests: 100,
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
		{
			name:     "within rate limit",
			enabled:  true,
			limit:    10,
			requests: 5,
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
		{
			name:     "at rate limit",
			enabled:  true,
			limit:    10,
			requests: 10,
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
		{
			name:     "exceeds rate limit",
			enabled:  true,
			limit:    10,
			requests: 11,
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
			},
			expectedStatus: http.StatusTooManyRequests,
			expectAbort:    true,
		},
		{
			name:     "unauthenticated user uses IP",
			enabled:  true,
			limit:    10,
			requests: 5,
			setupContext: func(c *gin.Context) {
				// No userID set, will use IP
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockCache := NewMockRateLimitCache()
			cfg := &config.Config{
				RateLimit: config.RateLimitConfig{
					Enabled:           tt.enabled,
					RequestsPerMinute: tt.limit,
					BurstSize:         tt.limit,
				},
			}

			middleware := NewRateLimitMiddleware(mockCache, cfg)

			// Execute multiple requests
			var lastResponse *httptest.ResponseRecorder
			var lastContext *gin.Context

			for i := 0; i < tt.requests; i++ {
				w := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(w)
				c.Request = httptest.NewRequest("GET", "/test", nil)
				tt.setupContext(c)

				middleware.Handler()(c)

				lastResponse = w
				lastContext = c
			}

			// Assert last request
			if tt.expectAbort && !lastContext.IsAborted() {
				t.Errorf("Request %d: expected abort, but wasn't aborted", tt.requests)
			}

			if !tt.expectAbort && lastContext.IsAborted() {
				t.Errorf("Request %d: expected to continue, but was aborted", tt.requests)
			}

			if lastResponse.Code != tt.expectedStatus {
				t.Errorf("Request %d: expected status %d, got %d", tt.requests, tt.expectedStatus, lastResponse.Code)
			}

			// Check rate limit headers
			if tt.enabled {
				limit := lastResponse.Header().Get("X-RateLimit-Limit")
				if limit == "" {
					t.Error("Expected X-RateLimit-Limit header, but it wasn't set")
				}

				remaining := lastResponse.Header().Get("X-RateLimit-Remaining")
				if remaining == "" {
					t.Error("Expected X-RateLimit-Remaining header, but it wasn't set")
				}

				reset := lastResponse.Header().Get("X-RateLimit-Reset")
				if reset == "" {
					t.Error("Expected X-RateLimit-Reset header, but it wasn't set")
				}
			}
		})
	}
}

func TestRateLimitMiddleware_MultipleUsers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockCache := NewMockRateLimitCache()
	cfg := &config.Config{
		RateLimit: config.RateLimitConfig{
			Enabled:           true,
			RequestsPerMinute: 5,
			BurstSize:         5,
		},
	}

	middleware := NewRateLimitMiddleware(mockCache, cfg)

	// User1 makes 5 requests (at limit)
	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Set("userID", "user1")

		middleware.Handler()(c)

		if c.IsAborted() {
			t.Errorf("User1 request %d: unexpected abort", i+1)
		}
	}

	// User2 makes 3 requests (within limit)
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Set("userID", "user2")

		middleware.Handler()(c)

		if c.IsAborted() {
			t.Errorf("User2 request %d: unexpected abort", i+1)
		}
	}

	// User1 makes one more request (exceeds limit)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/test", nil)
	c.Set("userID", "user1")

	middleware.Handler()(c)

	if !c.IsAborted() {
		t.Error("User1 request 6: expected abort, but wasn't aborted")
	}

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("User1 request 6: expected status 429, got %d", w.Code)
	}

	// User2 can still make requests
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/test", nil)
	c.Set("userID", "user2")

	middleware.Handler()(c)

	if c.IsAborted() {
		t.Error("User2 request 4: unexpected abort")
	}
}
