package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRateLimiterStore_GetLimiter(t *testing.T) {
	store := NewRateLimiterStore(10, 5) // 10 req/min, burst 5

	userID := "test-user-123"
	limiter1 := store.GetLimiter(userID)
	limiter2 := store.GetLimiter(userID)

	// Should return same instance
	assert.Equal(t, limiter1, limiter2, "Should return same limiter instance for same user")
}

func TestRateLimitMiddleware_AllowsUnderLimit(t *testing.T) {
	store := NewRateLimiterStore(60, 10) // 60 req/min = 1 req/sec, burst 10

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	middleware := RateLimitMiddleware(store)
	wrappedHandler := middleware(handler)

	// Create test request
	req := httptest.NewRequest("GET", "/api/v1/test", nil)
	req.Header.Set("X-User-ID", "test-user")

	// First 10 requests should succeed (burst)
	for i := 0; i < 10; i++ {
		w := httptest.NewRecorder()
		wrappedHandler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "Request %d should succeed", i+1)
		assert.Contains(t, w.Header().Get("X-RateLimit-Limit"), "10")
	}
}

func TestRateLimitMiddleware_BlocksOverLimit(t *testing.T) {
	store := NewRateLimiterStore(6, 2) // 6 req/min = 0.1 req/sec, burst 2

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := RateLimitMiddleware(store)
	wrappedHandler := middleware(handler)

	req := httptest.NewRequest("GET", "/api/v1/test", nil)
	req = req.WithContext(context.WithValue(req.Context(), "userID", "test-user-blocked"))

	// First 2 requests succeed (burst)
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		wrappedHandler.ServeHTTP(w, req)
		require.Equal(t, http.StatusOK, w.Code)
	}

	// 3rd request should be rate limited
	w := httptest.NewRecorder()
	wrappedHandler.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.Contains(t, w.Header().Get("Retry-After"), "")
	assert.Equal(t, "0", w.Header().Get("X-RateLimit-Remaining"))
}

func TestRateLimitMiddleware_DifferentUsers(t *testing.T) {
	store := NewRateLimiterStore(60, 2) // 60 req/min, burst 2

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := RateLimitMiddleware(store)
	wrappedHandler := middleware(handler)

	// User A exhausts limit
	reqA := httptest.NewRequest("GET", "/api/v1/test", nil)
	reqA = reqA.WithContext(context.WithValue(reqA.Context(), "userID", "user-a"))

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		wrappedHandler.ServeHTTP(w, reqA)
		require.Equal(t, http.StatusOK, w.Code)
	}

	wA := httptest.NewRecorder()
	wrappedHandler.ServeHTTP(wA, reqA)
	assert.Equal(t, http.StatusTooManyRequests, wA.Code)

	// User B should still have quota
	reqB := httptest.NewRequest("GET", "/api/v1/test", nil)
	reqB = reqB.WithContext(context.WithValue(reqB.Context(), "userID", "user-b"))

	wB := httptest.NewRecorder()
	wrappedHandler.ServeHTTP(wB, reqB)
	assert.Equal(t, http.StatusOK, wB.Code, "User B should not be affected by User A's limit")
}

func TestGetClientIP(t *testing.T) {
	tests := []struct {
		name     string
		setupReq func(*http.Request)
		expected string
	}{
		{
			name: "X-Forwarded-For header",
			setupReq: func(r *http.Request) {
				r.Header.Set("X-Forwarded-For", "1.2.3.4, 5.6.7.8")
			},
			expected: "1.2.3.4, 5.6.7.8",
		},
		{
			name: "X-Real-IP header",
			setupReq: func(r *http.Request) {
				r.Header.Set("X-Real-IP", "9.10.11.12")
			},
			expected: "9.10.11.12",
		},
		{
			name: "RemoteAddr fallback",
			setupReq: func(r *http.Request) {
				r.RemoteAddr = "13.14.15.16:12345"
			},
			expected: "13.14.15.16:12345",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			tt.setupReq(req)
			result := getClientIP(req)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRateLimiterStore_ConcurrentAccess(t *testing.T) {
	store := NewRateLimiterStore(100, 10)

	done := make(chan bool)
	users := []string{"user1", "user2", "user3"}

	// Concurrent access from multiple goroutines
	for _, user := range users {
		go func(u string) {
			for i := 0; i < 100; i++ {
				limiter := store.GetLimiter(u)
				_ = limiter.Allow()
			}
			done <- true
		}(user)
	}

	// Wait for all goroutines
	for i := 0; i < len(users); i++ {
		<-done
	}

	// Should have 3 limiters
	store.mu.RLock()
	assert.Equal(t, 3, len(store.limiters))
	store.mu.RUnlock()
}
