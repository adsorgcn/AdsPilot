package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/cache"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/clients"
	"github.com/gin-gonic/gin"
)

// MockSubscriptionCache implements SubscriptionCache interface for testing
type MockSubscriptionCache struct {
	subscriptions map[string]*cache.Subscription
	getError      error
	setError      error
}

func NewMockSubscriptionCache() *MockSubscriptionCache {
	return &MockSubscriptionCache{
		subscriptions: make(map[string]*cache.Subscription),
	}
}

func (m *MockSubscriptionCache) GetSubscription(ctx context.Context, userID string) (*cache.Subscription, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	return m.subscriptions[userID], nil
}

func (m *MockSubscriptionCache) SetSubscription(ctx context.Context, sub *cache.Subscription, ttl time.Duration) error {
	if m.setError != nil {
		return m.setError
	}
	m.subscriptions[sub.UserID] = sub
	return nil
}

// MockBillingService implements BillingService interface for testing
type MockBillingService struct {
	subscriptions map[string]*clients.SubscriptionResponse
	getError      error
}

func NewMockBillingService() *MockBillingService {
	return &MockBillingService{
		subscriptions: make(map[string]*clients.SubscriptionResponse),
	}
}

func (m *MockBillingService) GetSubscription(ctx context.Context, authToken string) (*clients.SubscriptionResponse, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	// Return the first subscription (simplified for testing)
	for _, sub := range m.subscriptions {
		return sub, nil
	}
	return nil, errors.New("subscription not found")
}

func TestSubscriptionMiddleware_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		setupContext   func(*gin.Context)
		setupCache     func(*MockSubscriptionCache)
		setupClient    func(*MockBillingService)
		expectedStatus int
		expectAbort    bool
		expectedTier   string
		expectedPlanID string
	}{
		{
			name: "cache hit - subscription found",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user123")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
			},
			setupCache: func(mockCache *MockSubscriptionCache) {
				mockCache.subscriptions["user123"] = &cache.Subscription{
					UserID:           "user123",
					Tier:             "professional",
					Status:           "active",
					PlanID:           "pro-monthly",
					CurrentPeriodEnd: time.Now().Add(30 * 24 * time.Hour),
				}
			},
			setupClient: func(mockClient *MockBillingService) {
				// Not called in cache hit scenario
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
			expectedTier:   "professional",
			expectedPlanID: "pro-monthly",
		},
		{
			name: "cache miss - fetch from billing API",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user456")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
			},
			setupCache: func(mockCache *MockSubscriptionCache) {
				// Cache is empty
			},
			setupClient: func(mockClient *MockBillingService) {
				mockClient.subscriptions["user456"] = &clients.SubscriptionResponse{
					UserID:           "user456",
					Tier:             "enterprise",
					Status:           "active",
					PlanID:           "enterprise-yearly",
					CurrentPeriodEnd: time.Now().Add(365 * 24 * time.Hour),
				}
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
			expectedTier:   "enterprise",
			expectedPlanID: "enterprise-yearly",
		},
		{
			name: "no subscription - default to starter",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user789")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
			},
			setupCache: func(mockCache *MockSubscriptionCache) {
				// Cache is empty
			},
			setupClient: func(mockClient *MockBillingService) {
				mockClient.getError = errors.New("subscription not found")
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
			expectedTier:   "starter",
			expectedPlanID: "starter",
		},
		{
			name: "missing user ID",
			setupContext: func(c *gin.Context) {
				// Don't set userID
			},
			setupCache: func(mockCache *MockSubscriptionCache) {
				// Not called
			},
			setupClient: func(mockClient *MockBillingService) {
				// Not called
			},
			expectedStatus: http.StatusUnauthorized,
			expectAbort:    true,
		},
		{
			name: "billing API error",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user999")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
			},
			setupCache: func(mockCache *MockSubscriptionCache) {
				// Cache is empty
			},
			setupClient: func(mockClient *MockBillingService) {
				mockClient.getError = errors.New("internal server error")
			},
			expectedStatus: http.StatusBadGateway,
			expectAbort:    true,
		},
		{
			name: "cache read error - graceful degradation",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user111")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
			},
			setupCache: func(mockCache *MockSubscriptionCache) {
				mockCache.getError = errors.New("redis connection failed")
			},
			setupClient: func(mockClient *MockBillingService) {
				mockClient.subscriptions["user111"] = &clients.SubscriptionResponse{
					UserID:           "user111",
					Tier:             "professional",
					Status:           "active",
					PlanID:           "pro-monthly",
					CurrentPeriodEnd: time.Now().Add(30 * 24 * time.Hour),
				}
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
			expectedTier:   "professional",
			expectedPlanID: "pro-monthly",
		},
		{
			name: "cache write error - graceful degradation",
			setupContext: func(c *gin.Context) {
				c.Set("userID", "user222")
				c.Request.Header.Set("Authorization", "Bearer valid-token")
			},
			setupCache: func(mockCache *MockSubscriptionCache) {
				mockCache.setError = errors.New("redis write failed")
			},
			setupClient: func(mockClient *MockBillingService) {
				mockClient.subscriptions["user222"] = &clients.SubscriptionResponse{
					UserID:           "user222",
					Tier:             "professional",
					Status:           "active",
					PlanID:           "pro-monthly",
					CurrentPeriodEnd: time.Now().Add(30 * 24 * time.Hour),
				}
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
			expectedTier:   "professional",
			expectedPlanID: "pro-monthly",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			mockCache := NewMockSubscriptionCache()
			mockClient := NewMockBillingService()
			tt.setupCache(mockCache)
			tt.setupClient(mockClient)

			middleware := NewSubscriptionMiddleware(mockCache, mockClient, 5*time.Minute)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/test", nil)
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

			// Check context values for successful cases
			if !tt.expectAbort {
				tier, exists := c.Get("userTier")
				if !exists {
					t.Error("Expected userTier in context, but it wasn't set")
				}
				if tier != tt.expectedTier {
					t.Errorf("Expected tier '%s', got '%v'", tt.expectedTier, tier)
				}

				planID, exists := c.Get("userPlanID")
				if !exists {
					t.Error("Expected userPlanID in context, but it wasn't set")
				}
				if planID != tt.expectedPlanID {
					t.Errorf("Expected planID '%s', got '%v'", tt.expectedPlanID, planID)
				}

				// Check request headers
				if c.Request.Header.Get("X-User-Tier") != tt.expectedTier {
					t.Errorf("Expected X-User-Tier header '%s', got '%s'", tt.expectedTier, c.Request.Header.Get("X-User-Tier"))
				}

				if c.Request.Header.Get("X-Plan-ID") != tt.expectedPlanID {
					t.Errorf("Expected X-Plan-ID header '%s', got '%s'", tt.expectedPlanID, c.Request.Header.Get("X-Plan-ID"))
				}
			}
		})
	}
}

func TestGetUserTier(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		setupCtx     func(*gin.Context)
		expectError  bool
		expectedTier string
	}{
		{
			name: "valid tier",
			setupCtx: func(c *gin.Context) {
				c.Set("userTier", "professional")
			},
			expectError:  false,
			expectedTier: "professional",
		},
		{
			name: "missing tier",
			setupCtx: func(c *gin.Context) {
				// Don't set userTier
			},
			expectError: true,
		},
		{
			name: "invalid type",
			setupCtx: func(c *gin.Context) {
				c.Set("userTier", 12345) // Wrong type
			},
			expectError: true,
		},
		{
			name: "starter tier",
			setupCtx: func(c *gin.Context) {
				c.Set("userTier", "starter")
			},
			expectError:  false,
			expectedTier: "starter",
		},
		{
			name: "enterprise tier",
			setupCtx: func(c *gin.Context) {
				c.Set("userTier", "enterprise")
			},
			expectError:  false,
			expectedTier: "enterprise",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			tt.setupCtx(c)

			tier, err := GetUserTier(c)

			if tt.expectError && err == nil {
				t.Error("Expected error, got nil")
			}

			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if !tt.expectError && tier != tt.expectedTier {
				t.Errorf("Expected tier '%s', got '%s'", tt.expectedTier, tier)
			}
		})
	}
}
