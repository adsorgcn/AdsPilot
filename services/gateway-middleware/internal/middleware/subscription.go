package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/cache"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/clients"
	"github.com/gin-gonic/gin"
)

// SubscriptionCache defines the cache interface for subscription operations
type SubscriptionCache interface {
	GetSubscription(ctx context.Context, userID string) (*cache.Subscription, error)
	SetSubscription(ctx context.Context, sub *cache.Subscription, ttl time.Duration) error
}

// BillingService defines the billing service interface for subscription operations
type BillingService interface {
	GetSubscription(ctx context.Context, authToken string) (*clients.SubscriptionResponse, error)
}

// SubscriptionMiddleware loads user subscription information
type SubscriptionMiddleware struct {
	cache         SubscriptionCache
	billingClient BillingService
	cacheTTL      time.Duration
}

// NewSubscriptionMiddleware creates a new subscription middleware
func NewSubscriptionMiddleware(c SubscriptionCache, billingClient BillingService, cacheTTL time.Duration) *SubscriptionMiddleware {
	return &SubscriptionMiddleware{
		cache:         c,
		billingClient: billingClient,
		cacheTTL:      cacheTTL,
	}
}

// Handler returns a Gin middleware function that loads subscription info
func (m *SubscriptionMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from auth context
		userID, err := GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "User ID not found in context",
			})
			c.Abort()
			return
		}

		// Try to get subscription from cache
		cachedSub, err := m.cache.GetSubscription(c.Request.Context(), userID)
		if err != nil {
			// Log error but continue (cache failure should not block requests)
			fmt.Printf("Cache error (non-fatal): %v\n", err)
		}

		var tier string
		var planID string

		if cachedSub != nil {
			// Cache hit
			tier = cachedSub.Tier
			planID = cachedSub.PlanID
		} else {
			// Cache miss - fetch from Billing service
			authToken := c.GetHeader("Authorization")
			subscription, err := m.billingClient.GetSubscription(c.Request.Context(), authToken)
			if err != nil {
				// If user has no subscription, default to "starter" tier
				if err.Error() == "subscription not found" {
					tier = "starter"
					planID = "starter"
				} else {
					c.JSON(http.StatusBadGateway, gin.H{
						"error": fmt.Sprintf("Failed to fetch subscription: %v", err),
					})
					c.Abort()
					return
				}
			} else {
				tier = subscription.Tier
				planID = subscription.PlanID

				// Cache the subscription
				cachedSub = &cache.Subscription{
					UserID:           subscription.UserID,
					Tier:             subscription.Tier,
					Status:           subscription.Status,
					PlanID:           subscription.PlanID,
					CurrentPeriodEnd: subscription.CurrentPeriodEnd,
				}

				if err := m.cache.SetSubscription(c.Request.Context(), cachedSub, m.cacheTTL); err != nil {
					// Log error but continue (cache set failure should not block requests)
					fmt.Printf("Cache set error (non-fatal): %v\n", err)
				}
			}
		}

		// Store in Gin context for downstream middleware
		c.Set("userTier", tier)
		c.Set("userPlanID", planID)

		// Add to request headers for backend services
		c.Request.Header.Set("X-User-Tier", tier)
		c.Request.Header.Set("X-Plan-ID", planID)

		c.Next()
	}
}

// GetUserTier retrieves the user tier from Gin context
func GetUserTier(c *gin.Context) (string, error) {
	tier, exists := c.Get("userTier")
	if !exists {
		return "", fmt.Errorf("user tier not found in context")
	}

	t, ok := tier.(string)
	if !ok {
		return "", fmt.Errorf("invalid user tier type")
	}

	return t, nil
}
