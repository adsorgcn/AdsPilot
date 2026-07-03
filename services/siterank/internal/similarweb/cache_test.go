package similarweb

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestRedis(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	mr, err := miniredis.Run()
	require.NoError(t, err)

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return client, mr
}

func TestCachedClient_GetDomainData_CacheHit(t *testing.T) {
	redisClient, mr := setupTestRedis(t)
	defer mr.Close()

	ctx := context.Background()
	domain := "example.com"

	// Mock API server would be needed for full test
	// For now, we'll test cache logic only

	client := NewCachedClient("http://mock", redisClient)

	// Manually set cache
	cacheKey := "similarweb:example.com"
	testData := `{"GlobalRank":1000,"Category":"Test"}`
	err := redisClient.Set(ctx, cacheKey, testData, CacheTTLSuccess).Err()
	require.NoError(t, err)

	// Test cache hit
	result, err := client.GetDomainData(ctx, domain, false)
	require.NoError(t, err)
	assert.True(t, result.Cached, "Result should be from cache")
	assert.NotNil(t, result.Data)
	assert.Equal(t, "Test", result.Data.Category)
}

func TestCachedClient_GetDomainData_ForceRefresh(t *testing.T) {
	redisClient, mr := setupTestRedis(t)
	defer mr.Close()

	ctx := context.Background()
	domain := "example.com"

	client := NewCachedClient("http://mock", redisClient)

	// Set existing cache
	cacheKey := "similarweb:example.com"
	testData := `{"GlobalRank":1000}`
	err := redisClient.Set(ctx, cacheKey, testData, CacheTTLSuccess).Err()
	require.NoError(t, err)

	// forceRefresh=true should bypass cache
	// (Will fail without mock API, but demonstrates logic)
	_, err = client.GetDomainData(ctx, domain, true)
	// Expect error since we don't have real API
	assert.Error(t, err)
}

func TestCachedClient_ErrorCaching(t *testing.T) {
	redisClient, mr := setupTestRedis(t)
	defer mr.Close()

	ctx := context.Background()
	domain := "nonexistent.com"

	client := NewCachedClient("http://mock", redisClient)

	// Set error cache
	errorKey := "similarweb:nonexistent.com:error"
	err := redisClient.Set(ctx, errorKey, "API error", CacheTTLError).Err()
	require.NoError(t, err)

	// Should return cached error
	_, err = client.GetDomainData(ctx, domain, false)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cached")
}

func TestCachedClient_InvalidateCache(t *testing.T) {
	redisClient, mr := setupTestRedis(t)
	defer mr.Close()

	ctx := context.Background()
	domain := "example.com"

	client := NewCachedClient("http://mock", redisClient)

	// Set cache
	cacheKey := "similarweb:example.com"
	testData := `{"GlobalRank":1000}`
	err := redisClient.Set(ctx, cacheKey, testData, CacheTTLSuccess).Err()
	require.NoError(t, err)

	// Verify cache exists
	exists, err := redisClient.Exists(ctx, cacheKey).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(1), exists)

	// Invalidate cache
	err = client.InvalidateCache(ctx, domain)
	require.NoError(t, err)

	// Verify cache deleted
	exists, err = redisClient.Exists(ctx, cacheKey).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), exists)
}

func TestNormalizeDomain(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"example.com", "example.com"},
		{"www.example.com", "example.com"},
		{"https://example.com", "example.com"},
		{"http://www.example.com/path", "example.com"},
		{"EXAMPLE.COM", "example.com"},
		{"https://www.EXAMPLE.com/", "example.com"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := NormalizeDomain(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestCacheTTL(t *testing.T) {
	assert.Equal(t, 7*24*time.Hour, CacheTTLSuccess, "Success TTL should be 7 days")
	assert.Equal(t, 1*time.Hour, CacheTTLError, "Error TTL should be 1 hour")
}
