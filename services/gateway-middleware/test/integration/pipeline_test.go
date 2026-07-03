package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/cache"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/clients"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/middleware"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/proxy"
)

// TestMiddlewarePipeline_E2E tests the complete middleware pipeline
// TODO: Rewrite integration tests for Supabase JWT verification
func TestMiddlewarePipeline_E2E(t *testing.T) {
	t.Skip("Skipping until Supabase JWT integration tests are implemented")
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	// Setup
	gin.SetMode(gin.TestMode)
	ctx := context.Background()

	// Create test Redis client (use miniredis for isolated testing)
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	// Create test Billing client (mock server)
	billingServer := setupMockBillingServer(t)
	defer billingServer.Close()

	// Load test configuration
	cfg := loadTestConfig(t, billingServer.URL)

	// Initialize middleware components
	redisCache := cache.NewCache(redisClient, &cache.CacheConfig{
		SubscriptionTTL: 5 * time.Minute,
		PermissionsTTL:  5 * time.Minute,
		TokenBalanceTTL: 1 * time.Minute,
	})

	// Create service registry for testing
	registry := serviceclient.NewRegistry()
	t.Setenv("BILLING_SERVICE_URL", billingServer.URL) // Set test billing URL
	registry.Register(serviceclient.ServiceConfig{
		Name:           "billing",
		URL:            billingServer.URL,
		Timeout:        5 * time.Second,
		MaxRetries:     2,
		CircuitBreaker: serviceclient.DefaultCircuitBreakerConfig(),
	})

	billingClient := clients.NewBillingClient(registry)

	jwtMiddleware := middleware.NewJWTMiddleware(cfg.JWT.ProjectURL, "")
	rateLimitMiddleware := middleware.NewRateLimitMiddleware(redisCache, cfg)
	subscriptionMiddleware := middleware.NewSubscriptionMiddleware(redisCache, billingClient, 5*time.Minute)
	permissionMiddleware := middleware.NewPermissionMiddleware(cfg, redisCache, billingClient, 5*time.Minute)
	tokenMiddleware := middleware.NewTokenMiddleware(cfg, redisCache, billingClient)

	// Create mock backend server
	backendServer := setupMockBackendServer(t)
	defer backendServer.Close()

	// Update config with backend URL
	cfg.Backends = map[string]string{
		"billing": backendServer.URL,
	}

	reverseProxy := proxy.NewReverseProxy(cfg, redisCache, billingClient)

	// Setup router with complete middleware pipeline
	router := gin.New()
	apiRoutes := router.Group("/api")
	{
		apiRoutes.Use(jwtMiddleware.Handler())
		apiRoutes.Use(rateLimitMiddleware.Handler())
		apiRoutes.Use(subscriptionMiddleware.Handler())
		apiRoutes.Use(permissionMiddleware.Handler())
		apiRoutes.Use(tokenMiddleware.Handler())
		apiRoutes.Use(reverseProxy.ProxyMiddleware())
	}

	// Test scenarios
	t.Run("Success - Complete Pipeline", func(t *testing.T) {
		// Create valid JWT
		token := createTestJWT(t, "user-123", "test@example.com", "professional", time.Hour)

		// Make request
		req := httptest.NewRequest("POST", "/api/v1/billing/subscription", strings.NewReader(`{"plan":"pro"}`))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Idempotency-Key", "test-key-1")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Verify response
		assert.Equal(t, http.StatusOK, w.Code)

		// Verify headers injected by middleware
		assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"))

		// Verify backend received correct headers
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "user-123", response["received_user_id"])
		assert.Equal(t, "professional", response["received_tier"])
	})

	t.Run("Failure - Missing JWT", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/billing/subscription", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "UNAUTHORIZED", response["code"])
	})

	t.Run("Failure - Insufficient Permissions", func(t *testing.T) {
		// Create JWT with starter tier (no access to premium features)
		token := createTestJWT(t, "user-456", "starter@example.com", "starter", time.Hour)

		req := httptest.NewRequest("POST", "/api/v1/billing/subscription", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "FORBIDDEN", response["code"])
	})

	t.Run("Failure - Insufficient Tokens", func(t *testing.T) {
		// Clear cache to force fresh lookup
		redisClient.FlushDB(ctx)

		// Setup billing server to return 0 balance
		setBillingMockBalance(t, billingServer, 0)

		token := createTestJWT(t, "user-789", "broke@example.com", "professional", time.Hour)

		req := httptest.NewRequest("POST", "/api/v1/offers", strings.NewReader(`{"name":"test"}`))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Idempotency-Key", "test-key-2")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusPaymentRequired, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "INSUFFICIENT_TOKENS", response["code"])
	})

	t.Run("Rate Limit", func(t *testing.T) {
		// Clear rate limit cache
		redisClient.FlushDB(ctx)

		token := createTestJWT(t, "user-rate-limit", "ratelimit@example.com", "starter", time.Hour)

		// Make requests up to limit
		limit := cfg.RateLimit.RequestsPerMinute
		for i := 0; i < limit; i++ {
			req := httptest.NewRequest("GET", "/api/v1/billing/subscription", nil)
			req.Header.Set("Authorization", "Bearer "+token)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if i < limit {
				assert.NotEqual(t, http.StatusTooManyRequests, w.Code, "Request %d should not be rate limited", i+1)
			}
		}

		// Next request should be rate limited
		req := httptest.NewRequest("GET", "/api/v1/billing/subscription", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusTooManyRequests, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "RATE_LIMIT_EXCEEDED", response["code"])
	})
}

// TestTokenTwoPhaseCommit tests the token reserve/commit/release flow
func TestTokenTwoPhaseCommit(t *testing.T) {
	t.Skip("Skipping until Supabase JWT integration tests are implemented")
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	gin.SetMode(gin.TestMode)
	ctx := context.Background()

	// Setup components
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	billingServer := setupMockBillingServer(t)
	defer billingServer.Close()

	cfg := loadTestConfig(t, billingServer.URL)
	redisCache := cache.NewCache(redisClient, &cache.CacheConfig{
		SubscriptionTTL: 5 * time.Minute,
		PermissionsTTL:  5 * time.Minute,
		TokenBalanceTTL: 1 * time.Minute,
	})

	// Create service registry for testing
	registry := serviceclient.NewRegistry()
	t.Setenv("BILLING_SERVICE_URL", billingServer.URL)
	registry.Register(serviceclient.ServiceConfig{
		Name:           "billing",
		URL:            billingServer.URL,
		Timeout:        5 * time.Second,
		MaxRetries:     2,
		CircuitBreaker: serviceclient.DefaultCircuitBreakerConfig(),
	})

	billingClient := clients.NewBillingClient(registry)

	t.Run("Success - Reserve and Auto-Commit", func(t *testing.T) {
		redisClient.FlushDB(ctx)
		setBillingMockBalance(t, billingServer, 1000)

		// Setup minimal pipeline
		router := gin.New()
		tokenMiddleware := middleware.NewTokenMiddleware(cfg, redisCache, billingClient)

		backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Backend commits token
			w.Header().Set("X-Token-Committed", "true")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"success":true}`))
		}))
		defer backendServer.Close()

		cfg.Backends["offer"] = backendServer.URL
		reverseProxy := proxy.NewReverseProxy(cfg, redisCache, billingClient)

		router.Use(func(c *gin.Context) {
			c.Set("user_id", "user-123")
			c.Set("user_tier", "professional")
			c.Next()
		})
		router.Use(tokenMiddleware.Handler())
		router.Use(reverseProxy.ProxyMiddleware())
		router.POST("/api/v1/offers", func(c *gin.Context) {})

		req := httptest.NewRequest("POST", "/api/v1/offers", strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Idempotency-Key", "commit-key-1")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		// Verify token was reserved in cache
		// (In real scenario, check billing service was called)
	})

	t.Run("Success - Reserve and Auto-Release on Error", func(t *testing.T) {
		redisClient.FlushDB(ctx)
		setBillingMockBalance(t, billingServer, 1000)

		router := gin.New()
		tokenMiddleware := middleware.NewTokenMiddleware(cfg, redisCache, billingClient)

		// Backend returns error
		backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"backend error"}`))
		}))
		defer backendServer.Close()

		cfg.Backends["offer"] = backendServer.URL
		reverseProxy := proxy.NewReverseProxy(cfg, redisCache, billingClient)

		router.Use(func(c *gin.Context) {
			c.Set("user_id", "user-456")
			c.Set("user_tier", "professional")
			c.Next()
		})
		router.Use(tokenMiddleware.Handler())
		router.Use(reverseProxy.ProxyMiddleware())
		router.POST("/api/v1/offers", func(c *gin.Context) {})

		req := httptest.NewRequest("POST", "/api/v1/offers", strings.NewReader(`{}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Idempotency-Key", "release-key-1")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)

		// Verify token was released
		// (In real scenario, check billing service release was called)
	})

	t.Run("Idempotency - Retry Uses Same Reservation", func(t *testing.T) {
		redisClient.FlushDB(ctx)
		setBillingMockBalance(t, billingServer, 100)

		router := gin.New()
		tokenMiddleware := middleware.NewTokenMiddleware(cfg, redisCache, billingClient)

		backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"success":true}`))
		}))
		defer backendServer.Close()

		cfg.Backends["offer"] = backendServer.URL
		reverseProxy := proxy.NewReverseProxy(cfg, redisCache, billingClient)

		router.Use(func(c *gin.Context) {
			c.Set("user_id", "user-idem")
			c.Set("user_tier", "professional")
			c.Next()
		})
		router.Use(tokenMiddleware.Handler())
		router.Use(reverseProxy.ProxyMiddleware())
		router.POST("/api/v1/offers", func(c *gin.Context) {})

		idempotencyKey := "idem-key-123"

		// First request
		req1 := httptest.NewRequest("POST", "/api/v1/offers", strings.NewReader(`{}`))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("X-Idempotency-Key", idempotencyKey)

		w1 := httptest.NewRecorder()
		router.ServeHTTP(w1, req1)
		assert.Equal(t, http.StatusOK, w1.Code)

		// Retry request with same idempotency key
		req2 := httptest.NewRequest("POST", "/api/v1/offers", strings.NewReader(`{}`))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("X-Idempotency-Key", idempotencyKey)

		w2 := httptest.NewRecorder()
		router.ServeHTTP(w2, req2)
		assert.Equal(t, http.StatusOK, w2.Code)

		// Should not reserve tokens twice
		// (In real scenario, verify only one reservation was made)
	})
}

// TestCacheBehavior tests Redis caching behavior
func TestCacheBehavior(t *testing.T) {
	t.Skip("Skipping until Supabase JWT integration tests are implemented")
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	ctx := context.Background()
	redisClient := setupTestRedis(t)
	defer redisClient.Close()

	redisCache := cache.NewCache(redisClient, &cache.CacheConfig{
		SubscriptionTTL: 5 * time.Minute,
		PermissionsTTL:  5 * time.Minute,
		TokenBalanceTTL: 1 * time.Minute,
	})

	t.Run("Subscription Cache Hit", func(t *testing.T) {
		redisClient.FlushDB(ctx)

		userID := "user-cache-test"
		sub := &cache.Subscription{
			UserID: userID,
			Tier:   "professional",
			Status: "active",
		}

		// Set cache
		err := redisCache.SetSubscription(ctx, sub, 5*time.Minute)
		require.NoError(t, err)

		// Get from cache
		cachedSub, err := redisCache.GetSubscription(ctx, userID)
		require.NoError(t, err)
		assert.NotNil(t, cachedSub)
		assert.Equal(t, sub.Tier, cachedSub.Tier)
	})

	t.Run("Subscription Cache Miss", func(t *testing.T) {
		redisClient.FlushDB(ctx)

		userID := "user-no-cache"

		// Get from cache (should miss)
		cachedSub, err := redisCache.GetSubscription(ctx, userID)
		require.NoError(t, err)
		assert.Nil(t, cachedSub)
	})

	t.Run("Token Balance Cache Expiry", func(t *testing.T) {
		redisClient.FlushDB(ctx)

		userID := "user-expiry"
		tokenBal := &cache.TokenBalance{
			UserID:    userID,
			Available: 500,
			Total:     500,
			UpdatedAt: time.Now(),
		}

		// Set cache with short TTL
		shortTTLCache := cache.NewCache(redisClient, &cache.CacheConfig{
			TokenBalanceTTL: 1 * time.Second,
		})

		err := shortTTLCache.SetTokenBalance(ctx, tokenBal, 1*time.Second)
		require.NoError(t, err)

		// Immediately get - should hit
		cachedBalance, err := shortTTLCache.GetTokenBalance(ctx, userID)
		require.NoError(t, err)
		assert.NotNil(t, cachedBalance)
		assert.Equal(t, tokenBal.Available, cachedBalance.Available)

		// Wait for expiry
		time.Sleep(2 * time.Second)

		// Get again - should miss
		cachedBalance, err = shortTTLCache.GetTokenBalance(ctx, userID)
		require.NoError(t, err)
		assert.Nil(t, cachedBalance)
	})
}
