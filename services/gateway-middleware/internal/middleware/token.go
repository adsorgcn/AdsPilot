package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/cache"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/clients"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/metrics"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TokenCache defines the cache interface for token reservation operations
type TokenCache interface {
	GetTokenReservation(ctx context.Context, idempotencyKey string) (*cache.TokenReservation, error)
	SetTokenReservation(ctx context.Context, reservation *cache.TokenReservation, ttl time.Duration) error
}

// TokenService defines the billing service interface for token operations
type TokenService interface {
	ReserveTokens(ctx context.Context, authToken string, userID string, req *clients.ReserveTokensRequest) (*clients.ReserveTokensResponse, error)
}

// TokenMiddleware handles token reservation for requests
type TokenMiddleware struct {
	config        *config.Config
	cache         TokenCache
	billingClient TokenService
}

// NewTokenMiddleware creates a new token middleware
func NewTokenMiddleware(cfg *config.Config, c TokenCache, billingClient TokenService) *TokenMiddleware {
	return &TokenMiddleware{
		config:        cfg,
		cache:         c,
		billingClient: billingClient,
	}
}

// Handler returns a Gin middleware function that reserves tokens
func (m *TokenMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Find the route configuration
		route := m.config.FindRoute(c.Request.URL.Path, c.Request.Method)
		if route == nil || route.TokenCost <= 0 {
			// No token cost for this route
			c.Next()
			return
		}

		// Get user ID from context (set by JWTMiddleware)
		userID, err := GetUserID(c)
		if err != nil {
			metrics.TokenReservationsTotal.WithLabelValues("error").Inc()
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "User ID not found in context",
			})
			c.Abort()
			return
		}

		// Get or generate idempotency key
		idempotencyKey := c.GetHeader("X-Idempotency-Key")
		if idempotencyKey == "" {
			// Generate a unique key for this request
			idempotencyKey = uuid.New().String()
		}

		// Check if we already have a reservation for this idempotency key
		cachedReservation, err := m.cache.GetTokenReservation(c.Request.Context(), idempotencyKey)
		if err != nil {
			// Log but continue (cache error should not block)
			fmt.Printf("Cache error checking reservation (non-fatal): %v\n", err)
		}

		var reservationID string
		if cachedReservation != nil {
			// Use cached reservation (idempotent retry)
			reservationID = cachedReservation.ReservationID
			fmt.Printf("Using cached reservation: %s for idempotency key: %s\n", reservationID, idempotencyKey)
		} else {
			// Reserve tokens from Billing service
			authToken := c.GetHeader("Authorization")
			reservation, err := m.billingClient.ReserveTokens(
				c.Request.Context(),
				authToken,
				userID,
				&clients.ReserveTokensRequest{
					Amount:  route.TokenCost,
					Service: "gateway-middleware",
					Action:  fmt.Sprintf("%s %s", c.Request.Method, c.Request.URL.Path),
					Reason:  fmt.Sprintf("API request to %s", route.Backend),
				},
			)

			duration := time.Since(start).Seconds()
			metrics.TokenReservationDuration.Observe(duration)

			if err != nil {
				if err.Error() == "insufficient tokens" {
					metrics.TokenReservationsTotal.WithLabelValues("insufficient").Inc()
					c.JSON(http.StatusPaymentRequired, gin.H{
						"error":      "Insufficient token balance",
						"code":       "INSUFFICIENT_TOKENS",
						"required":   route.TokenCost,
						"upgrade_to": "higher tier plan",
					})
					c.Abort()
					return
				}

				metrics.TokenReservationsTotal.WithLabelValues("error").Inc()
				c.JSON(http.StatusBadGateway, gin.H{
					"error": fmt.Sprintf("Failed to reserve tokens: %v", err),
				})
				c.Abort()
				return
			}

			reservationID = reservation.ReservationID
			metrics.TokenReservationsTotal.WithLabelValues("success").Inc()

			// Cache the reservation for idempotency
			cacheReservation := &cache.TokenReservation{
				ReservationID:  reservationID,
				UserID:         userID,
				Amount:         route.TokenCost,
				IdempotencyKey: idempotencyKey,
				ExpiresAt:      reservation.ExpiresAt,
			}
			if err := m.cache.SetTokenReservation(c.Request.Context(), cacheReservation, 30*time.Minute); err != nil {
				// Log but continue
				fmt.Printf("Cache set error (non-fatal): %v\n", err)
			}
		}

		// Store reservation info in context for downstream middleware
		c.Set("tokenReservationID", reservationID)
		c.Set("tokenCost", route.TokenCost)
		c.Set("idempotencyKey", idempotencyKey)

		// Add to request headers for backend services
		c.Request.Header.Set("X-Token-Reservation-ID", reservationID)
		c.Request.Header.Set("X-Token-Cost", fmt.Sprintf("%d", route.TokenCost))
		c.Request.Header.Set("X-Idempotency-Key", idempotencyKey)

		c.Next()
	}
}

// GetTokenReservationID retrieves the token reservation ID from Gin context
func GetTokenReservationID(c *gin.Context) (string, error) {
	reservationID, exists := c.Get("tokenReservationID")
	if !exists {
		return "", fmt.Errorf("token reservation ID not found in context")
	}

	rid, ok := reservationID.(string)
	if !ok {
		return "", fmt.Errorf("invalid token reservation ID type")
	}

	return rid, nil
}
