package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/metrics"
	"github.com/gin-gonic/gin"
)

// RateLimitCache defines the cache interface needed for rate limiting
type RateLimitCache interface {
	IncrementRateLimit(ctx context.Context, key string, ttl time.Duration) (int, error)
}

// RateLimitMiddleware implements rate limiting using Redis
type RateLimitMiddleware struct {
	cache  RateLimitCache
	config *config.RateLimitConfig
}

// NewRateLimitMiddleware creates a new rate limit middleware
func NewRateLimitMiddleware(c RateLimitCache, cfg *config.Config) *RateLimitMiddleware {
	return &RateLimitMiddleware{
		cache:  c,
		config: &cfg.RateLimit,
	}
}

// ReloadConfig updates the rate limit configuration
func (m *RateLimitMiddleware) ReloadConfig(newConfig config.RateLimitConfig) error {
	m.config = &newConfig
	return nil
}

// Handler returns a Gin middleware function that enforces rate limits
func (m *RateLimitMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip if rate limiting is disabled
		if !m.config.Enabled {
			c.Next()
			return
		}

		// Get user ID for authenticated users
		userID, err := GetUserID(c)
		if err != nil {
			// For unauthenticated requests, use IP-based rate limiting
			userID = c.ClientIP()
		}

		// Check rate limit with endpoint-specific limits
		allowed, remaining, resetTime, err := m.checkRateLimitForEndpoint(c.Request.Context(), userID, c.Request.URL.Path)
		if err != nil {
			// Log error but don't block request (fail open)
			fmt.Printf("Rate limit check error (non-fatal): %v\n", err)
			c.Next()
			return
		}

		// Add rate limit headers
		endpointLimit := m.getRateLimitForPath(c.Request.URL.Path)
		c.Header("X-RateLimit-Limit", strconv.Itoa(endpointLimit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime, 10))

		if !allowed {
			metrics.RateLimitExceededTotal.WithLabelValues(userID, "user").Inc()
			endpointLimit := m.getRateLimitForPath(c.Request.URL.Path)
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":     "Rate limit exceeded",
				"code":      "RATE_LIMIT_EXCEEDED",
				"limit":     endpointLimit,
				"remaining": 0,
				"resetAt":   resetTime,
				"message":   fmt.Sprintf("You have exceeded the rate limit of %d requests per minute for this endpoint. Please try again later.", endpointLimit),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// checkRateLimit checks if the user has exceeded their rate limit
// Returns: (allowed, remaining, resetTime, error)
func (m *RateLimitMiddleware) checkRateLimit(ctx context.Context, userID string) (bool, int, int64, error) {
	now := time.Now()
	windowStart := now.Truncate(time.Minute)
	resetTime := windowStart.Add(time.Minute).Unix()

	// Redis key: ratelimit:user:{userID}:{window}
	key := fmt.Sprintf("ratelimit:user:%s:%d", userID, windowStart.Unix())

	// Increment counter
	count, err := m.cache.IncrementRateLimit(ctx, key, time.Minute)
	if err != nil {
		return false, 0, resetTime, fmt.Errorf("failed to increment rate limit: %w", err)
	}

	limit := m.config.RequestsPerMinute
	remaining := limit - count
	if remaining < 0 {
		remaining = 0
	}

	allowed := count <= limit

	return allowed, remaining, resetTime, nil
}

// checkRateLimitForEndpoint checks if the user has exceeded their rate limit for a specific endpoint
// Returns: (allowed, remaining, resetTime, error)
func (m *RateLimitMiddleware) checkRateLimitForEndpoint(ctx context.Context, userID, path string) (bool, int, int64, error) {
	now := time.Now()
	windowStart := now.Truncate(time.Minute)
	resetTime := windowStart.Add(time.Minute).Unix()

	// Get rate limit for this specific endpoint
	limit := m.getRateLimitForPath(path)

	// Redis key: ratelimit:user:{userID}:{endpoint}:{window}
	key := fmt.Sprintf("ratelimit:user:%s:%s:%d", userID, path, windowStart.Unix())

	// Increment counter
	count, err := m.cache.IncrementRateLimit(ctx, key, time.Minute)
	if err != nil {
		return false, 0, resetTime, fmt.Errorf("failed to increment rate limit: %w", err)
	}

	remaining := limit - count
	if remaining < 0 {
		remaining = 0
	}

	allowed := count <= limit

	return allowed, remaining, resetTime, nil
}

// getRateLimitForPath returns the rate limit for a specific path
func (m *RateLimitMiddleware) getRateLimitForPath(path string) int {
	// Check for endpoint-specific limits
	for endpoint, limit := range m.config.EndpointLimits {
		if path == endpoint || (len(endpoint) > 1 && path[:len(endpoint)] == endpoint) {
			return limit
		}
	}

	// Return default rate limit
	return m.config.RequestsPerMinute
}

// isIPWhitelisted checks if an IP is in the whitelist
func (m *RateLimitMiddleware) isIPWhitelisted(ip string) bool {
	for _, whitelistedIP := range m.config.WhitelistIPs {
		if ip == whitelistedIP {
			return true
		}
	}
	return false
}

// isIPBlacklisted checks if an IP is in the blacklist
func (m *RateLimitMiddleware) isIPBlacklisted(ip string) bool {
	for _, blacklistedIP := range m.config.BlacklistIPs {
		if ip == blacklistedIP {
			return true
		}
	}
	return false
}
