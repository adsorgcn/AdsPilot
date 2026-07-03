package similarweb

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/browserexec"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/metrics"
	"github.com/redis/go-redis/v9"
)

const (
	// Cache TTLs
	CacheTTLSuccess      = 7 * 24 * time.Hour // 7天
	CacheTTLError        = 1 * time.Hour      // 1小时（默认）
	CacheTTL404Error     = 24 * time.Hour     // 24小时（404错误）
	CacheTTL5xxError     = 5 * time.Minute    // 5分钟（5xx服务器错误）
	CacheTTLTimeoutError = 10 * time.Minute   // 10分钟（超时错误）
)

// CachedClient wraps SimilarWeb client with Redis caching
type CachedClient struct {
	client *Client
	redis  *redis.Client
}

// NewCachedClient creates a new cached SimilarWeb client
func NewCachedClient(baseURL string, redisClient *redis.Client) *CachedClient {
	return &CachedClient{
		client: NewClient(baseURL),
		redis:  redisClient,
	}
}

// NewCachedClientWithBrowserExec creates a cached SimilarWeb client that uses browser-exec
func NewCachedClientWithBrowserExec(browserExecClient *browserexec.Client, redisClient *redis.Client) *CachedClient {
	return &CachedClient{
		client: NewClientWithBrowserExec(browserExecClient),
		redis:  redisClient,
	}
}

// NewCachedClientWithClient creates a cached client from an existing Client
func NewCachedClientWithClient(client *Client, redisClient *redis.Client) *CachedClient {
	return &CachedClient{
		client: client,
		redis:  redisClient,
	}
}

// cacheKey generates Redis cache key for a domain
func cacheKey(domain string) string {
	return fmt.Sprintf("similarweb:%s", NormalizeDomain(domain))
}

// errorCacheKey generates Redis cache key for error state
func errorCacheKey(domain string) string {
	return fmt.Sprintf("similarweb:%s:error", NormalizeDomain(domain))
}

// CachedResult contains data and cache metadata
type CachedResult struct {
	Data      *SimilarWebData
	Cached    bool
	CachedAt  *time.Time
	FromError bool // true if this is from error cache
}

// GetDomainData fetches SimilarWeb data with caching
func (c *CachedClient) GetDomainData(ctx context.Context, domain string, forceRefresh bool) (*CachedResult, error) {
	normalizedDomain := NormalizeDomain(domain)
	if normalizedDomain == "" {
		return nil, fmt.Errorf("invalid domain")
	}

	// Check error cache first
	if !forceRefresh {
		errorKey := errorCacheKey(normalizedDomain)
		errorMsg, err := c.redis.Get(ctx, errorKey).Result()
		if err == nil && errorMsg != "" {
			// Error is cached, return error
			return nil, fmt.Errorf("similarweb API error (cached): %s", errorMsg)
		}
	}

	// Check success cache
	if !forceRefresh {
		cacheKeyStr := cacheKey(normalizedDomain)
		cachedData, err := c.redis.Get(ctx, cacheKeyStr).Result()
		if err == nil {
			// Cache hit
			metrics.SimilarWebCacheHits.WithLabelValues("hit").Inc()
			var data SimilarWebData
			if err := json.Unmarshal([]byte(cachedData), &data); err == nil {
				// Get cache timestamp
				cacheTTL, _ := c.redis.TTL(ctx, cacheKeyStr).Result()
				cachedAt := time.Now().Add(-CacheTTLSuccess + cacheTTL)

				return &CachedResult{
					Data:     &data,
					Cached:   true,
					CachedAt: &cachedAt,
				}, nil
			}
		}
	}

	// Cache miss or force refresh, fetch from API
	metrics.SimilarWebCacheHits.WithLabelValues("miss").Inc()
	apiStart := time.Now()
	data, err := c.client.GetDomainData(ctx, normalizedDomain)
	metrics.SimilarWebAPILatency.Observe(time.Since(apiStart).Seconds())
	if err != nil {
		// API call failed, cache the error with appropriate TTL
		errorKey := errorCacheKey(normalizedDomain)
		ttl := c.getErrorCacheTTL(err)
		c.redis.Set(ctx, errorKey, err.Error(), ttl)
		return nil, fmt.Errorf("failed to fetch similarweb data: %w", err)
	}

	// Success, cache the data
	dataJSON, err := json.Marshal(data)
	if err != nil {
		// Failed to marshal, but return data anyway
		return &CachedResult{
			Data:   data,
			Cached: false,
		}, nil
	}

	cacheKeyStr := cacheKey(normalizedDomain)
	if err := c.redis.Set(ctx, cacheKeyStr, dataJSON, CacheTTLSuccess).Err(); err != nil {
		// Failed to cache, but return data anyway
		return &CachedResult{
			Data:   data,
			Cached: false,
		}, nil
	}

	// Clear any error cache
	errorKey := errorCacheKey(normalizedDomain)
	c.redis.Del(ctx, errorKey)

	now := time.Now()
	return &CachedResult{
		Data:     data,
		Cached:   false,
		CachedAt: &now,
	}, nil
}

// InvalidateCache removes cached data for a domain
func (c *CachedClient) InvalidateCache(ctx context.Context, domain string) error {
	normalizedDomain := NormalizeDomain(domain)
	cacheKeyStr := cacheKey(normalizedDomain)
	errorKey := errorCacheKey(normalizedDomain)

	pipe := c.redis.Pipeline()
	pipe.Del(ctx, cacheKeyStr)
	pipe.Del(ctx, errorKey)
	_, err := pipe.Exec(ctx)

	return err
}

// GetCacheStatus checks if domain data is cached
func (c *CachedClient) GetCacheStatus(ctx context.Context, domain string) (bool, *time.Time, error) {
	normalizedDomain := NormalizeDomain(domain)
	cacheKeyStr := cacheKey(normalizedDomain)

	exists, err := c.redis.Exists(ctx, cacheKeyStr).Result()
	if err != nil {
		return false, nil, err
	}

	if exists == 0 {
		return false, nil, nil
	}

	// Get TTL to calculate cached time
	ttl, err := c.redis.TTL(ctx, cacheKeyStr).Result()
	if err != nil {
		return true, nil, nil
	}

	cachedAt := time.Now().Add(-CacheTTLSuccess + ttl)
	return true, &cachedAt, nil
}

// getErrorCacheTTL determines the appropriate TTL based on error type
func (c *CachedClient) getErrorCacheTTL(err error) time.Duration {
	if err == nil {
		return CacheTTLError
	}

	errStr := err.Error()

	// 404 errors - domain not found, cache longer
	if contains(errStr, "404") || contains(errStr, "not found") {
		return CacheTTL404Error
	}

	// 5xx server errors - temporary issues, cache shorter
	if contains(errStr, "500") || contains(errStr, "502") ||
		contains(errStr, "503") || contains(errStr, "504") ||
		contains(errStr, "internal server error") {
		return CacheTTL5xxError
	}

	// Timeout errors - temporary network issues, cache shorter
	if contains(errStr, "timeout") || contains(errStr, "deadline exceeded") {
		return CacheTTLTimeoutError
	}

	// Default error cache TTL
	return CacheTTLError
}

// contains checks if a string contains a substring (case-insensitive)
func contains(s, substr string) bool {
	sLower := ""
	substrLower := ""
	for _, c := range s {
		if c >= 'A' && c <= 'Z' {
			sLower += string(c + 32)
		} else {
			sLower += string(c)
		}
	}
	for _, c := range substr {
		if c >= 'A' && c <= 'Z' {
			substrLower += string(c + 32)
		} else {
			substrLower += string(c)
		}
	}

	for i := 0; i <= len(sLower)-len(substrLower); i++ {
		if i+len(substrLower) <= len(sLower) && sLower[i:i+len(substrLower)] == substrLower {
			return true
		}
	}
	return false
}
