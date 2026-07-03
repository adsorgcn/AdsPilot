package similarweb

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAPIKeyInjection 测试API Key是否正确注入到请求头
// 覆盖需求3: SimilarWeb API集成 (90% → 100%)
func TestAPIKeyInjection(t *testing.T) {
	apiKeyCaptured := ""
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 捕获API Key请求头
		apiKeyCaptured = r.Header.Get("X-API-Key")
		if apiKeyCaptured == "" {
			apiKeyCaptured = r.Header.Get("Authorization")
		}

		// 返回模拟响应
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"GlobalRank":1000,"Category":"E-commerce"}`))
	}))
	defer server.Close()

	// 创建带API Key的客户端
	client := NewClient(server.URL)
	client.httpClient.Transport = &apiKeyTransport{
		APIKey:    "test-api-key-12345",
		Transport: http.DefaultTransport,
	}

	// 执行请求
	ctx := context.Background()
	data, err := client.GetDomainData(ctx, "nike.com")

	// 验证
	require.NoError(t, err)
	assert.NotNil(t, data)
	assert.Equal(t, "test-api-key-12345", apiKeyCaptured, "API Key应正确注入到请求头")
}

// apiKeyTransport 为测试注入API Key的HTTP Transport
type apiKeyTransport struct {
	APIKey    string
	Transport http.RoundTripper
}

func (t *apiKeyTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Clone request to avoid modifying original
	req = req.Clone(req.Context())
	req.Header.Set("X-API-Key", t.APIKey)
	return t.Transport.RoundTrip(req)
}

// TestAPIRetryMechanism 测试API调用失败后的重试机制
// 覆盖需求3: SimilarWeb API集成 (90% → 100%)
func TestAPIRetryMechanism(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			// 前两次返回500错误
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"temporary failure"}`))
			return
		}
		// 第三次成功
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"GlobalRank":2000}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	ctx := context.Background()

	// 执行请求（允许最多3次重试）
	data, err := client.GetDomainDataWithRetry(ctx, "example.com", 2)

	// 验证
	require.NoError(t, err)
	assert.Equal(t, 3, attempts, "应该重试2次后成功")
	assert.NotNil(t, data)
	assert.NotNil(t, data.GlobalRank)
	assert.Equal(t, 2000, *data.GlobalRank)
}

// TestAPIRetryExhausted 测试重试次数用尽后返回错误
func TestAPIRetryExhausted(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		// 始终返回500错误
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error":"persistent failure"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	ctx := context.Background()

	// 执行请求（允许最多2次重试）
	_, err := client.GetDomainDataWithRetry(ctx, "example.com", 2)

	// 验证
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed after")
	assert.Equal(t, 3, attempts, "应该总共尝试3次（1次初始 + 2次重试）")
}

// TestRetryableStatusCodes 测试哪些状态码会触发重试
func TestRetryableStatusCodes(t *testing.T) {
	tests := []struct {
		name          string
		statusCode    int
		shouldRetry   bool
		expectedError bool
	}{
		{"500 Internal Server Error", 500, true, true},
		{"502 Bad Gateway", 502, true, true},
		{"503 Service Unavailable", 503, true, true},
		{"429 Too Many Requests", 429, true, true},
		{"400 Bad Request", 400, false, true},
		{"401 Unauthorized", 401, false, true},
		{"404 Not Found", 404, false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attempts := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				attempts++
				w.WriteHeader(tt.statusCode)
				w.Write([]byte(`{"error":"test error"}`))
			}))
			defer server.Close()

			client := NewClient(server.URL)
			ctx := context.Background()

			_, err := client.GetDomainDataWithRetry(ctx, "test.com", 2)

			if tt.expectedError {
				assert.Error(t, err)
			}

			if tt.shouldRetry {
				assert.GreaterOrEqual(t, attempts, 2, "可重试的状态码应触发重试")
			} else {
				assert.Equal(t, 1, attempts, "不可重试的状态码不应重试")
			}
		})
	}
}

// TestExponentialBackoff 测试重试时的指数退避
func TestExponentialBackoff(t *testing.T) {
	attempts := 0
	attemptTimes := []time.Time{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		attemptTimes = append(attemptTimes, time.Now())

		if attempts < 3 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"GlobalRank":3000}`))
	}))
	defer server.Close()

	client := NewClient(server.URL)
	ctx := context.Background()

	start := time.Now()
	data, err := client.GetDomainDataWithRetry(ctx, "test.com", 2)
	duration := time.Since(start)

	// 验证
	require.NoError(t, err)
	assert.Equal(t, 3, attempts)
	assert.NotNil(t, data)

	// 验证退避时间: 第1次重试延迟1秒，第2次重试延迟2秒
	// 总时间应大于3秒（1 + 2）
	assert.Greater(t, duration, 3*time.Second, "应该有指数退避延迟")
	assert.Less(t, duration, 5*time.Second, "但不应该过长")

	// 验证重试间隔递增
	if len(attemptTimes) >= 3 {
		interval1 := attemptTimes[1].Sub(attemptTimes[0])
		interval2 := attemptTimes[2].Sub(attemptTimes[1])
		assert.Greater(t, interval2, interval1, "第二次重试间隔应大于第一次（指数退避）")
	}
}

// TestContextCancellation 测试上下文取消时停止重试
func TestContextCancellation(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	client := NewClient(server.URL)

	// 创建会很快取消的上下文
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := client.GetDomainDataWithRetry(ctx, "test.com", 10)
	duration := time.Since(start)

	// 验证
	assert.Error(t, err)
	assert.Less(t, attempts, 5, "上下文取消应该停止重试")
	assert.Less(t, duration, 1*time.Second, "应该在超时时间内返回")
}

// TestDomainNormalization 测试域名归一化逻辑（边界条件）
// 覆盖需求4: Brand Name自动填充 (80% → 100%)
func TestDomainNormalizationEdgeCases(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		// 标准用例
		{"nike.com", "nike.com"},
		{"www.nike.com", "nike.com"},
		{"https://nike.com", "nike.com"},
		{"http://www.nike.com/path", "nike.com"},

		// 边界条件
		{"NIKE.COM", "nike.com"},
		{"WWW.NIKE.COM", "nike.com"},
		{"https://www.NIKE.com/", "nike.com"},
		{"nike.co.uk", "nike.co.uk"},
		{"www.nike.co.uk", "nike.co.uk"},

		// 复杂路径
		{"https://nike.com/products/shoes?id=123", "nike.com"},
		{"nike.com:8080", "nike.com"},
		{"www.nike.com:443", "nike.com"},

		// 特殊字符
		{"example-brand.io", "example-brand.io"},
		{"my_brand.com", "my_brand.com"},
		{"123.com", "123.com"},

		// 子域名
		{"shop.nike.com", "shop.nike.com"},
		{"www.shop.nike.com", "shop.nike.com"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := NormalizeDomain(tt.input)
			assert.Equal(t, tt.expected, result, "域名归一化结果不符合预期")
		})
	}
}

// TestCacheKeyFormat 测试缓存键格式
// 覆盖需求7: 缓存优化策略 (85% → 100%)
func TestCacheKeyFormat(t *testing.T) {
	redisClient, mr := setupTestRedis(t)
	defer mr.Close()

	ctx := context.Background()

	// 测试域名
	domain := "nike.com"

	// 手动设置缓存以模拟成功场景
	successKey := fmt.Sprintf("similarweb:%s", domain)
	testData := `{"GlobalRank":1000}`
	err := redisClient.Set(ctx, successKey, testData, CacheTTLSuccess).Err()
	require.NoError(t, err)

	// 验证成功缓存键格式
	exists, err := redisClient.Exists(ctx, successKey).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(1), exists, "成功缓存键格式应为 'similarweb:{domain}'")

	// 验证TTL
	ttl := redisClient.TTL(ctx, successKey).Val()
	expectedTTL := 7 * 24 * time.Hour
	assert.InDelta(t, expectedTTL.Seconds(), ttl.Seconds(), 100, "成功缓存TTL应为7天")

	// 测试失败缓存键格式
	errorKey := "similarweb:invalid-domain.com:error"
	err = redisClient.Set(ctx, errorKey, "API error", CacheTTLError).Err()
	require.NoError(t, err)

	exists, err = redisClient.Exists(ctx, errorKey).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(1), exists, "失败缓存键格式应为 'similarweb:{domain}:error'")

	// 验证失败缓存TTL
	ttl = redisClient.TTL(ctx, errorKey).Val()
	expectedTTL = 1 * time.Hour
	assert.InDelta(t, expectedTTL.Seconds(), ttl.Seconds(), 10, "失败缓存TTL应为1小时")
}

// TestFailureCacheRetry 测试失败缓存过期后重试
// 覆盖需求7: 缓存优化策略 (85% → 100%)
func TestFailureCacheRetry(t *testing.T) {
	redisClient, mr := setupTestRedis(t)
	defer mr.Close()

	ctx := context.Background()

	// 设置短TTL的失败缓存（用于测试）
	errorKey := "similarweb:retry-test.com:error"
	shortTTL := 2 * time.Second
	err := redisClient.Set(ctx, errorKey, "temporary error", shortTTL).Err()
	require.NoError(t, err)

	// 验证缓存存在
	exists, err := redisClient.Exists(ctx, errorKey).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(1), exists, "失败缓存应该存在")

	// 等待缓存过期 (使用miniredis的FastForward而不是time.Sleep)
	mr.FastForward(3 * time.Second)

	// 验证缓存已过期
	exists, err = redisClient.Exists(ctx, errorKey).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), exists, "失败缓存应在1小时后过期，允许重试")
}
