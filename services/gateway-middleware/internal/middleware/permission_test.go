package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/clients"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/config"
	"github.com/gin-gonic/gin"
)

// MockPermissionCache implements PermissionCache interface for testing
type MockPermissionCache struct {
	permissions map[string][]string
	getError    error
	setError    error
}

func NewMockPermissionCache() *MockPermissionCache {
	return &MockPermissionCache{
		permissions: make(map[string][]string),
	}
}

func (m *MockPermissionCache) GetPermissions(ctx context.Context, tier string) ([]string, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	return m.permissions[tier], nil
}

func (m *MockPermissionCache) SetPermissions(ctx context.Context, tier string, permissions []string, ttl time.Duration) error {
	if m.setError != nil {
		return m.setError
	}
	m.permissions[tier] = permissions
	return nil
}

// MockPermissionService implements PermissionService interface for testing
type MockPermissionService struct {
	permissions map[string][]string
	getError    error
}

func NewMockPermissionService() *MockPermissionService {
	return &MockPermissionService{
		permissions: make(map[string][]string),
	}
}

func (m *MockPermissionService) GetPlanPermissions(ctx context.Context, tier string) (*clients.PermissionsResponse, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	perms, ok := m.permissions[tier]
	if !ok {
		return nil, errors.New("tier not found")
	}
	return &clients.PermissionsResponse{
		Permissions: perms,
	}, nil
}

func TestPermissionMiddleware_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		path           string
		method         string
		setupContext   func(*gin.Context)
		setupConfig    func() *config.Config
		setupCache     func(*MockPermissionCache)
		setupService   func(*MockPermissionService)
		expectedStatus int
		expectAbort    bool
	}{
		{
			name:   "route not found - pass through",
			path:   "/api/v1/unknown",
			method: "GET",
			setupContext: func(c *gin.Context) {
				c.Set("userTier", "professional")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:  "/api/v1/offers",
							Backend: "offer",
							Methods: []string{"GET"},
						},
					},
				}
			},
			setupCache:     func(cache *MockPermissionCache) {},
			setupService:   func(svc *MockPermissionService) {},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
		{
			name:   "missing user tier",
			path:   "/api/v1/offers",
			method: "GET",
			setupContext: func(c *gin.Context) {
				// Don't set userTier
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:  "/api/v1/offers",
							Backend: "offer",
							Methods: []string{"GET"},
						},
					},
				}
			},
			setupCache:     func(cache *MockPermissionCache) {},
			setupService:   func(svc *MockPermissionService) {},
			expectedStatus: http.StatusInternalServerError,
			expectAbort:    true,
		},
		{
			name:   "tier requirement satisfied",
			path:   "/api/v1/offers",
			method: "GET",
			setupContext: func(c *gin.Context) {
				c.Set("userTier", "professional")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:      "/api/v1/offers",
							Backend:     "offer",
							Methods:     []string{"GET"},
							RequireTier: []string{"professional", "enterprise"},
						},
					},
				}
			},
			setupCache:     func(cache *MockPermissionCache) {},
			setupService:   func(svc *MockPermissionService) {},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
		{
			name:   "tier requirement not satisfied",
			path:   "/api/v1/offers",
			method: "GET",
			setupContext: func(c *gin.Context) {
				c.Set("userTier", "starter")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:      "/api/v1/offers",
							Backend:     "offer",
							Methods:     []string{"GET"},
							RequireTier: []string{"professional", "enterprise"},
						},
					},
				}
			},
			setupCache:     func(cache *MockPermissionCache) {},
			setupService:   func(svc *MockPermissionService) {},
			expectedStatus: http.StatusForbidden,
			expectAbort:    true,
		},
		{
			name:   "permission check passes - cache hit",
			path:   "/api/v1/offers/create",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userTier", "professional")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:            "/api/v1/offers",
							Backend:           "offer",
							Methods:           []string{"POST"},
							RequirePermission: "offer:create",
						},
					},
				}
			},
			setupCache: func(cache *MockPermissionCache) {
				cache.permissions["professional"] = []string{"offer:read", "offer:create", "offer:update"}
			},
			setupService:   func(svc *MockPermissionService) {},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
		{
			name:   "permission check fails",
			path:   "/api/v1/offers/delete",
			method: "DELETE",
			setupContext: func(c *gin.Context) {
				c.Set("userTier", "professional")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:            "/api/v1/offers",
							Backend:           "offer",
							Methods:           []string{"DELETE"},
							RequirePermission: "offer:delete",
						},
					},
				}
			},
			setupCache: func(cache *MockPermissionCache) {
				cache.permissions["professional"] = []string{"offer:read", "offer:create"}
			},
			setupService:   func(svc *MockPermissionService) {},
			expectedStatus: http.StatusForbidden,
			expectAbort:    true,
		},
		{
			name:   "cache miss - fetch from API",
			path:   "/api/v1/offers/create",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userTier", "enterprise")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:            "/api/v1/offers",
							Backend:           "offer",
							Methods:           []string{"POST"},
							RequirePermission: "offer:create",
						},
					},
				}
			},
			setupCache: func(cache *MockPermissionCache) {
				// Cache is empty
			},
			setupService: func(svc *MockPermissionService) {
				svc.permissions["enterprise"] = []string{"offer:read", "offer:create", "offer:update", "offer:delete"}
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
		{
			name:   "cache error - graceful degradation to API",
			path:   "/api/v1/offers/create",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userTier", "professional")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:            "/api/v1/offers",
							Backend:           "offer",
							Methods:           []string{"POST"},
							RequirePermission: "offer:create",
						},
					},
				}
			},
			setupCache: func(cache *MockPermissionCache) {
				cache.getError = errors.New("redis connection failed")
			},
			setupService: func(svc *MockPermissionService) {
				svc.permissions["professional"] = []string{"offer:read", "offer:create"}
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
		{
			name:   "API error - fallback to config defaults",
			path:   "/api/v1/offers/read",
			method: "GET",
			setupContext: func(c *gin.Context) {
				c.Set("userTier", "starter")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:            "/api/v1/offers",
							Backend:           "offer",
							Methods:           []string{"GET"},
							RequirePermission: "offer:read",
						},
					},
					DefaultPermissions: map[string][]string{
						"starter": {"offer:read"},
					},
				}
			},
			setupCache: func(cache *MockPermissionCache) {
				// Cache is empty
			},
			setupService: func(svc *MockPermissionService) {
				svc.getError = errors.New("billing service unavailable")
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
		{
			name:   "API error - no config default - fail",
			path:   "/api/v1/offers/create",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userTier", "custom_tier")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:            "/api/v1/offers",
							Backend:           "offer",
							Methods:           []string{"POST"},
							RequirePermission: "offer:create",
						},
					},
					DefaultPermissions: map[string][]string{
						"starter": {"offer:read"},
					},
				}
			},
			setupCache: func(cache *MockPermissionCache) {
				// Cache is empty
			},
			setupService: func(svc *MockPermissionService) {
				svc.getError = errors.New("billing service unavailable")
			},
			expectedStatus: http.StatusInternalServerError,
			expectAbort:    true,
		},
		{
			name:   "cache write error - graceful degradation",
			path:   "/api/v1/offers/create",
			method: "POST",
			setupContext: func(c *gin.Context) {
				c.Set("userTier", "professional")
			},
			setupConfig: func() *config.Config {
				return &config.Config{
					Routes: []config.RouteConfig{
						{
							Prefix:            "/api/v1/offers",
							Backend:           "offer",
							Methods:           []string{"POST"},
							RequirePermission: "offer:create",
						},
					},
				}
			},
			setupCache: func(cache *MockPermissionCache) {
				cache.setError = errors.New("redis write failed")
			},
			setupService: func(svc *MockPermissionService) {
				svc.permissions["professional"] = []string{"offer:read", "offer:create"}
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			cfg := tt.setupConfig()
			mockCache := NewMockPermissionCache()
			mockService := NewMockPermissionService()
			tt.setupCache(mockCache)
			tt.setupService(mockService)

			middleware := NewPermissionMiddleware(cfg, mockCache, mockService, 5*time.Minute)

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
		})
	}
}

func TestContainsTier(t *testing.T) {
	tests := []struct {
		name         string
		allowedTiers []string
		userTier     string
		expected     bool
	}{
		{
			name:         "tier found",
			allowedTiers: []string{"starter", "professional", "enterprise"},
			userTier:     "professional",
			expected:     true,
		},
		{
			name:         "tier not found",
			allowedTiers: []string{"professional", "enterprise"},
			userTier:     "starter",
			expected:     false,
		},
		{
			name:         "empty allowed list",
			allowedTiers: []string{},
			userTier:     "professional",
			expected:     false,
		},
		{
			name:         "exact match",
			allowedTiers: []string{"starter"},
			userTier:     "starter",
			expected:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := containsTier(tt.allowedTiers, tt.userTier)
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}
