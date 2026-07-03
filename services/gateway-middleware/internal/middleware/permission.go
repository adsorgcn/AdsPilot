package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/clients"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/config"
	"github.com/gin-gonic/gin"
)

// PermissionCache defines the cache interface for permission operations
type PermissionCache interface {
	GetPermissions(ctx context.Context, tier string) ([]string, error)
	SetPermissions(ctx context.Context, tier string, permissions []string, ttl time.Duration) error
}

// PermissionService defines the billing service interface for permission operations
type PermissionService interface {
	GetPlanPermissions(ctx context.Context, tier string) (*clients.PermissionsResponse, error)
}

// PermissionMiddleware checks if user has required permissions
type PermissionMiddleware struct {
	config        *config.Config
	cache         PermissionCache
	billingClient PermissionService
	cacheTTL      time.Duration
}

// NewPermissionMiddleware creates a new permission middleware
func NewPermissionMiddleware(cfg *config.Config, c PermissionCache, billingClient PermissionService, cacheTTL time.Duration) *PermissionMiddleware {
	return &PermissionMiddleware{
		config:        cfg,
		cache:         c,
		billingClient: billingClient,
		cacheTTL:      cacheTTL,
	}
}

// Handler returns a Gin middleware function that checks permissions
func (m *PermissionMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Find the route configuration
		route := m.config.FindRoute(c.Request.URL.Path, c.Request.Method)
		if route == nil {
			// Route not found - let it pass to return 404 later
			c.Next()
			return
		}

		// Get user tier from context (set by SubscriptionMiddleware)
		userTier, err := GetUserTier(c)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "User tier not found in context",
			})
			c.Abort()
			return
		}

		// Check tier requirement
		if len(route.RequireTier) > 0 {
			if !containsTier(route.RequireTier, userTier) {
				c.JSON(http.StatusForbidden, gin.H{
					"error": fmt.Sprintf("This feature requires one of these tiers: %s. Your tier: %s",
						strings.Join(route.RequireTier, ", "), userTier),
					"code":         "INSUFFICIENT_TIER",
					"requiredTier": route.RequireTier,
					"userTier":     userTier,
				})
				c.Abort()
				return
			}
		}

		// Check specific permission requirement
		if route.RequirePermission != "" {
			hasPermission, err := m.checkPermission(c, userTier, route.RequirePermission)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": fmt.Sprintf("Failed to check permission: %v", err),
				})
				c.Abort()
				return
			}

			if !hasPermission {
				c.JSON(http.StatusForbidden, gin.H{
					"error":              fmt.Sprintf("Permission denied: %s", route.RequirePermission),
					"code":               "PERMISSION_DENIED",
					"requiredPermission": route.RequirePermission,
					"userTier":           userTier,
				})
				c.Abort()
				return
			}
		}

		// Permission check passed
		c.Next()
	}
}

// checkPermission verifies if the user's tier has the required permission
func (m *PermissionMiddleware) checkPermission(c *gin.Context, tier string, requiredPermission string) (bool, error) {
	// Try to get permissions from cache
	permissions, err := m.cache.GetPermissions(c.Request.Context(), tier)
	if err != nil {
		// Log error but continue
		fmt.Printf("Cache error (non-fatal): %v\n", err)
	}

	if permissions == nil {
		// Cache miss - try to fetch from Billing service
		resp, err := m.billingClient.GetPlanPermissions(c.Request.Context(), tier)
		if err != nil {
			// If billing service fails, fall back to default permissions from config
			if defaultPerms, ok := m.config.DefaultPermissions[tier]; ok {
				permissions = defaultPerms
			} else {
				return false, fmt.Errorf("failed to fetch permissions and no default found: %w", err)
			}
		} else {
			permissions = resp.Permissions

			// Cache the permissions
			if err := m.cache.SetPermissions(c.Request.Context(), tier, permissions, m.cacheTTL); err != nil {
				// Log error but continue
				fmt.Printf("Cache set error (non-fatal): %v\n", err)
			}
		}
	}

	// Check if required permission is in the list
	for _, perm := range permissions {
		if perm == requiredPermission {
			return true, nil
		}
	}

	return false, nil
}

// containsTier checks if a tier is in the allowed list
func containsTier(allowedTiers []string, userTier string) bool {
	for _, tier := range allowedTiers {
		if tier == userTier {
			return true
		}
	}
	return false
}
