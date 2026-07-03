package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/cache"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/clients"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/config"
	"github.com/gin-gonic/gin"
)

// MockTokenCache implements TokenCache interface for testing
type MockTokenCache struct {
	reservations map[string]*cache.TokenReservation
	getError     error
	setError     error
}

func NewMockTokenCache() *MockTokenCache {
	return &MockTokenCache{
		reservations: make(map[string]*cache.TokenReservation),
	}
}

func (m *MockTokenCache) GetTokenReservation(ctx context.Context, idempotencyKey string) (*cache.TokenReservation, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	return m.reservations[idempotencyKey], nil
}

func (m *MockTokenCache) SetTokenReservation(ctx context.Context, reservation *cache.TokenReservation, ttl time.Duration) error {
	if m.setError != nil {
		return m.setError
	}
	m.reservations[reservation.IdempotencyKey] = reservation
	return nil
}

// MockTokenService implements TokenService interface for testing
type MockTokenService struct {
	reservations map[string]string // userID -> reservationID
	getError     error
	tokenBalance int
	nextReservID int
}

func NewMockTokenService(balance int) *MockTokenService {
	return &MockTokenService{
		reservations: make(map[string]string),
		tokenBalance: balance,
		nextReservID: 1,
	}
}

func (m *MockTokenService) ReserveTokens(ctx context.Context, authToken string, userID string, req *clients.ReserveTokensRequest) (*clients.ReserveTokensResponse, error) {
	if m.getError != nil {
		return nil, m.getError
	}

	if req.Amount > m.tokenBalance {
		return nil, errors.New("insufficient tokens")
	}

	reservationID := fmt.Sprintf("reserv-%d", m.nextReservID)
	m.nextReservID++
	m.reservations[userID] = reservationID
	m.tokenBalance -= req.Amount

	return &clients.ReserveTokensResponse{
		ReservationID: reservationID,
		UserID:        userID,
		Amount:        req.Amount,
		ExpiresAt:     time.Now().Add(30 * time.Minute),
	}, nil
}

func TestTokenMiddleware_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name                 string
		path                 string
		method               string
		setupContext         func(*gin.Context)
		setupConfig          func() *config.Config
		setupCache           func(*MockTokenCache)
		setupService         func(*MockTokenService)
		expectedStatus       int
		expectAbort          bool
		expectReservationID  bool
		expectIdempotencyKey string
	}{
		{
			name:   "route without token cost - pass through",
			path:   "/api/v1/public",
			method: "GET",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:    "/api/v1/public",
							Backend:   "offer",
							Methods:   []string{"GET"},
							TokenCost: 0, // No token cost
						},
					},
				}
			},
			setupCache:          func(cache *MockTokenCache) {},
			setupService:        func(svc *MockTokenService) {},
			expectedStatus:      http.StatusOK,
			expectAbort:         false,
			expectReservationID: false,
		},
		{
			name:   "missing user ID",
			path:   "/api/v1/offers",
			method: "GET",
			setupContext: func(c *gin.Context) {
				// Don't set userID
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:    "/api/v1/offers",
							Backend:   "offer",
							Methods:   []string{"GET"},
							TokenCost: 10,
						},
					},
				}
			},
			setupCache:          func(cache *MockTokenCache) {},
			setupService:        func(svc *MockTokenService) {},
			expectedStatus:      http.StatusInternalServerError,
			expectAbort:         true,
			expectReservationID: false,
		},
		{
			name:   "successful token reservation",
			path:   "/api/v1/offers",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
				c.Request.Header.Set("X-Idempotency-Key", "test-key-123")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:    "/api/v1/offers",
							Backend:   "offer",
							Methods:   []string{"POST"},
							TokenCost: 10,
						},
					},
				}
			},
			setupCache:           func(cache *MockTokenCache) {},
			setupService:         func(svc *MockTokenService) {},
			expectedStatus:       http.StatusOK,
			expectAbort:          false,
			expectReservationID:  true,
			expectIdempotencyKey: "test-key-123",
		},
		{
			name:   "idempotency key reuse - cached reservation",
			path:   "/api/v1/offers",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
				c.Request.Header.Set("X-Idempotency-Key", "cached-key")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:    "/api/v1/offers",
							Backend:   "offer",
							Methods:   []string{"POST"},
							TokenCost: 10,
						},
					},
				}
			},
			setupCache: func(mockCache *MockTokenCache) {
				mockCache.reservations["cached-key"] = &cache.TokenReservation{
					ReservationID:  "existing-reserv-id",
					UserID:         "user123",
					Amount:         10,
					IdempotencyKey: "cached-key",
					ExpiresAt:      time.Now().Add(30 * time.Minute),
				}
			},
			setupService:         func(svc *MockTokenService) {},
			expectedStatus:       http.StatusOK,
			expectAbort:          false,
			expectReservationID:  true,
			expectIdempotencyKey: "cached-key",
		},
		{
			name:   "auto-generated idempotency key",
			path:   "/api/v1/offers",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
				// Don't set X-Idempotency-Key
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:    "/api/v1/offers",
							Backend:   "offer",
							Methods:   []string{"POST"},
							TokenCost: 10,
						},
					},
				}
			},
			setupCache:          func(cache *MockTokenCache) {},
			setupService:        func(svc *MockTokenService) {},
			expectedStatus:      http.StatusOK,
			expectAbort:         false,
			expectReservationID: true,
			// Idempotency key will be auto-generated UUID
		},
		{
			name:   "insufficient tokens",
			path:   "/api/v1/offers",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:    "/api/v1/offers",
							Backend:   "offer",
							Methods:   []string{"POST"},
							TokenCost: 100, // More than balance
						},
					},
				}
			},
			setupCache: func(cache *MockTokenCache) {},
			setupService: func(svc *MockTokenService) {
				svc.tokenBalance = 50 // Not enough
			},
			expectedStatus:      http.StatusPaymentRequired,
			expectAbort:         true,
			expectReservationID: false,
		},
		{
			name:   "billing service error",
			path:   "/api/v1/offers",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:    "/api/v1/offers",
							Backend:   "offer",
							Methods:   []string{"POST"},
							TokenCost: 10,
						},
					},
				}
			},
			setupCache: func(cache *MockTokenCache) {},
			setupService: func(svc *MockTokenService) {
				svc.getError = errors.New("billing service unavailable")
			},
			expectedStatus:      http.StatusBadGateway,
			expectAbort:         true,
			expectReservationID: false,
		},
		{
			name:   "cache read error - graceful degradation",
			path:   "/api/v1/offers",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
				c.Request.Header.Set("X-Idempotency-Key", "test-key")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:    "/api/v1/offers",
							Backend:   "offer",
							Methods:   []string{"POST"},
							TokenCost: 10,
						},
					},
				}
			},
			setupCache: func(cache *MockTokenCache) {
				cache.getError = errors.New("redis connection failed")
			},
			setupService:         func(svc *MockTokenService) {},
			expectedStatus:       http.StatusOK,
			expectAbort:          false,
			expectReservationID:  true,
			expectIdempotencyKey: "test-key",
		},
		{
			name:   "cache write error - graceful degradation",
			path:   "/api/v1/offers",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
				c.Request.Header.Set("X-Idempotency-Key", "test-key")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:    "/api/v1/offers",
							Backend:   "offer",
							Methods:   []string{"POST"},
							TokenCost: 10,
						},
					},
				}
			},
			setupCache: func(cache *MockTokenCache) {
				cache.setError = errors.New("redis write failed")
			},
			setupService:         func(svc *MockTokenService) {},
			expectedStatus:       http.StatusOK,
			expectAbort:          false,
			expectReservationID:  true,
			expectIdempotencyKey: "test-key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			cfg := tt.setupConfig()
			mockCache := NewMockTokenCache()
			mockService := NewMockTokenService(1000) // Default balance
			tt.setupCache(mockCache)
			tt.setupService(mockService)

			middleware := NewTokenMiddleware(cfg, mockCache, mockService)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(tt.method, tt.path, nil)
			tt.setupContext(c)

			// Execute
			middleware.Handler()(c)

			// Assert
			if tt.expectAbort && !c.IsAborted() {
				t.Errorf("Expected request to be aborted, but it wasn't")
			}

			if !tt.expectAbort && c.IsAborted() {
				t.Errorf("Expected request to continue, but it was aborted")
			}

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// Check context values for successful reservations
			if tt.expectReservationID {
				reservationID, exists := c.Get("tokenReservationID")
				if !exists {
					t.Error("Expected tokenReservationID in context, but it wasn't set")
				}
				if reservationID == "" {
					t.Error("Expected non-empty reservation ID")
				}

				tokenCost, exists := c.Get("tokenCost")
				if !exists {
					t.Error("Expected tokenCost in context, but it wasn't set")
				}
				if tokenCost == 0 {
					t.Error("Expected non-zero token cost")
				}

				// Check headers
				if c.Request.Header.Get("X-Token-Reservation-ID") == "" {
					t.Error("Expected X-Token-Reservation-ID header, but it wasn't set")
				}
			}

			// Check idempotency key if specified
			if tt.expectIdempotencyKey != "" {
				idempKey, exists := c.Get("idempotencyKey")
				if !exists {
					t.Error("Expected idempotencyKey in context, but it wasn't set")
				}
				if idempKey != tt.expectIdempotencyKey {
					t.Errorf("Expected idempotency key '%s', got '%v'", tt.expectIdempotencyKey, idempKey)
				}
			}
		})
	}
}

func TestGetTokenReservationID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name        string
		setupCtx    func(*gin.Context)
		expectError bool
		expectedID  string
	}{
		{
			name: "valid reservation ID",
			setupCtx: func(c *gin.Context) {
				c.Set("tokenReservationID", "reserv-12345")
			},
			expectError: false,
			expectedID:  "reserv-12345",
		},
		{
			name: "missing reservation ID",
			setupCtx: func(c *gin.Context) {
				// Don't set tokenReservationID
			},
			expectError: true,
		},
		{
			name: "invalid type",
			setupCtx: func(c *gin.Context) {
				c.Set("tokenReservationID", 12345) // Wrong type
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			tt.setupCtx(c)

			reservationID, err := GetTokenReservationID(c)

			if tt.expectError && err == nil {
				t.Error("Expected error, got nil")
			}

			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if !tt.expectError && reservationID != tt.expectedID {
				t.Errorf("Expected reservation ID '%s', got '%s'", tt.expectedID, reservationID)
			}
		})
	}
}
