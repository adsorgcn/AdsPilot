package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/config"
)

// setupTestRedis creates a miniredis instance for testing
func setupTestRedis(t *testing.T) *redis.Client {
	t.Helper()

	mr, err := miniredis.Run()
	require.NoError(t, err, "Failed to start miniredis")

	t.Cleanup(func() {
		mr.Close()
	})

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return client
}

// setupMockBillingServer creates a mock billing service
func setupMockBillingServer(t *testing.T) *httptest.Server {
	t.Helper()

	// Default balance for tests
	balance := 10000

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/api/v1/billing/subscriptions/me":
			// Subscription query endpoint
			tier := r.Header.Get("X-User-Tier")
			if tier == "" {
				tier = "professional"
			}
			response := map[string]interface{}{
				"tier":   tier,
				"status": "active",
			}
			json.NewEncoder(w).Encode(response)

		case "/api/v1/billing/tokens/balance":
			// Token balance endpoint
			response := map[string]interface{}{
				"balance": balance,
			}
			json.NewEncoder(w).Encode(response)

		case "/api/v1/billing/tokens/reserve":
			// Token reserve endpoint
			var req map[string]interface{}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			amount := int(req["amount"].(float64))
			if balance < amount {
				w.WriteHeader(http.StatusPaymentRequired)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error": "INSUFFICIENT_TOKENS",
					"code":  "INSUFFICIENT_TOKENS",
				})
				return
			}

			response := map[string]interface{}{
				"reservation_id": req["idempotency_key"],
				"amount":         amount,
				"balance":        balance - amount,
			}
			json.NewEncoder(w).Encode(response)

		case "/api/v1/billing/tokens/commit":
			// Token commit endpoint
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
			})

		case "/api/v1/billing/tokens/release":
			// Token release endpoint
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
			})

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))

	return server
}

// setBillingMockBalance updates the mock billing server balance
func setBillingMockBalance(t *testing.T, server *httptest.Server, newBalance int) {
	t.Helper()
	// This is a simplified version - in real implementation,
	// you'd need to expose a way to update server state
	// For now, this is just a placeholder
}

// setupMockBackendServer creates a mock backend service
func setupMockBackendServer(t *testing.T) *httptest.Server {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// Echo back headers for verification
		response := map[string]interface{}{
			"success":          true,
			"received_user_id": r.Header.Get("X-User-ID"),
			"received_tier":    r.Header.Get("X-User-Tier"),
			"received_email":   r.Header.Get("X-User-Email"),
			"method":           r.Method,
			"path":             r.URL.Path,
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}))

	return server
}

// loadTestConfig creates a test configuration
func loadTestConfig(t *testing.T, billingURL string) *config.Config {
	t.Helper()

	return &config.Config{
		Environment: "test",
		JWT: config.JWTConfig{
			ProjectURL: "https://test.supabase.co",
			Issuer:     "https://test.supabase.co/auth/v1",
			Audience:   "authenticated",
		},
		RateLimit: config.RateLimitConfig{
			Enabled:           true,
			RequestsPerMinute: 100,
		},
		Redis: config.RedisConfig{
			Address:  "localhost:6379",
			Password: "",
			DB:       0,
			CacheExpiry: config.CacheExpiry{
				Subscription: 5 * time.Minute,
				Permissions:  5 * time.Minute,
				TokenBalance: 1 * time.Minute,
			},
		},
		Backends: map[string]string{
			"billing": billingURL,
		},
		Routes: []config.RouteConfig{
			{
				Prefix:      "/api/v1/billing/subscription",
				Backend:     "billing",
				Methods:     []string{"GET", "POST"},
				RequireTier: []string{"starter", "professional", "pro", "max", "elite"},
				TokenCost:   0,
			},
			{
				Prefix:      "/api/v1/offers",
				Backend:     "offer",
				Methods:     []string{"POST"},
				RequireTier: []string{"professional", "pro", "max", "elite"},
				TokenCost:   10,
			},
		},
	}
}

// createTestJWT creates a JWT token for testing
func createTestJWT(t *testing.T, userID, email, tier string, expiry time.Duration) string {
	t.Helper()

	// Use HS256 for testing (in production, use RS256 or ES256)
	secret := []byte("test-secret-key-for-testing-only")

	claims := jwt.MapClaims{
		"sub":       userID,
		"email":     email,
		"user_tier": tier,
		"iat":       time.Now().Unix(),
		"exp":       time.Now().Add(expiry).Unix(),
		"iss":       "test-issuer",
		"aud":       []string{"test-audience"},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(secret)
	require.NoError(t, err, "Failed to create test JWT")

	return tokenString
}

// assertJSONField checks if a JSON response contains expected field
func assertJSONField(t *testing.T, body []byte, field string, expected interface{}) {
	t.Helper()

	var response map[string]interface{}
	err := json.Unmarshal(body, &response)
	require.NoError(t, err, "Failed to parse JSON response")

	actual, ok := response[field]
	require.True(t, ok, fmt.Sprintf("Field %q not found in response", field))
	require.Equal(t, expected, actual, fmt.Sprintf("Field %q mismatch", field))
}

// waitForCache is a helper to wait for cache operations to complete
func waitForCache(duration time.Duration) {
	time.Sleep(duration)
}
