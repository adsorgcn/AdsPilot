package proxy

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/cache"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/clients"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/config"
	"github.com/gin-gonic/gin"
)

// ReverseProxy handles proxying requests to backend services
type ReverseProxy struct {
	config        *config.Config
	httpClient    *http.Client
	cache         *cache.Cache
	billingClient *clients.BillingClient
}

// NewReverseProxy creates a new reverse proxy
func NewReverseProxy(cfg *config.Config, c *cache.Cache, billingClient *clients.BillingClient) *ReverseProxy {
	return &ReverseProxy{
		config:        cfg,
		cache:         c,
		billingClient: billingClient,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

// ProxyMiddleware returns a Gin middleware that proxies requests to backend services
func (p *ReverseProxy) ProxyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Find matching route
		route := p.config.FindRoute(c.Request.URL.Path, c.Request.Method)
		if route == nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Route not found",
			})
			c.Abort()
			return
		}

		// Get backend URL
		backendURL := p.config.GetBackendURL(route.Backend)
		if backendURL == "" {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Backend URL not configured",
			})
			c.Abort()
			return
		}

		// Proxy the request
		if err := p.proxyRequest(c, backendURL, route); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{
				"error": fmt.Sprintf("Failed to proxy request: %v", err),
			})
			c.Abort()
			return
		}
	}
}

// proxyRequest forwards the request to the backend service
func (p *ReverseProxy) proxyRequest(c *gin.Context, backendURL string, route *config.RouteConfig) error {
	// Build target URL
	targetURL, err := url.Parse(backendURL)
	if err != nil {
		return fmt.Errorf("invalid backend URL: %w", err)
	}

	// Preserve the original path
	targetURL.Path = c.Request.URL.Path
	targetURL.RawQuery = c.Request.URL.RawQuery

	// Create new request
	req, err := http.NewRequestWithContext(
		c.Request.Context(),
		c.Request.Method,
		targetURL.String(),
		c.Request.Body,
	)
	if err != nil {
		return fmt.Errorf("failed to create proxy request: %w", err)
	}

	// Copy headers from original request
	for key, values := range c.Request.Header {
		// Skip hop-by-hop headers
		if isHopByHopHeader(key) {
			continue
		}
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	// Inject auth context headers for backend services
	if userID, exists := c.Get("userID"); exists {
		req.Header.Set("X-User-ID", userID.(string))
	}
	if userEmail, exists := c.Get("userEmail"); exists {
		req.Header.Set("X-User-Email", userEmail.(string))
	}
	if userTier, exists := c.Get("userTier"); exists {
		req.Header.Set("X-User-Tier", userTier.(string))
	}
	if tokenReservation, exists := c.Get("tokenReservation"); exists {
		req.Header.Set("X-Token-Reservation-ID", tokenReservation.(string))
	}

	// Forward the request to backend
	resp, err := p.httpClient.Do(req)
	if err != nil {
		// Release token on backend request failure
		p.handleTokenRelease(c, nil)
		return fmt.Errorf("backend request failed: %w", err)
	}
	defer resp.Body.Close()

	// Handle token release based on response status
	p.handleTokenRelease(c, resp)

	// Copy response headers
	for key, values := range resp.Header {
		if isHopByHopHeader(key) {
			continue
		}
		for _, value := range values {
			c.Header(key, value)
		}
	}

	// Copy response status and body
	c.Status(resp.StatusCode)
	_, err = io.Copy(c.Writer, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to copy response body: %w", err)
	}

	return nil
}

// handleTokenRelease releases token reservation on errors
func (p *ReverseProxy) handleTokenRelease(c *gin.Context, resp *http.Response) {
	// Check if there's a token reservation
	reservationID, exists := c.Get("tokenReservationID")
	if !exists {
		return // No token reservation
	}

	// Check if we should release the token
	shouldRelease := false
	if resp == nil {
		// Backend request failed completely
		shouldRelease = true
		fmt.Println("Releasing token: backend request failed")
	} else if resp.StatusCode >= 400 {
		// Backend returned error status
		shouldRelease = true
		fmt.Printf("Releasing token: backend returned error status %d\n", resp.StatusCode)
	}

	if !shouldRelease {
		return
	}

	// Release the token reservation
	authToken := c.GetHeader("Authorization")
	err := p.billingClient.ReleaseReservation(
		c.Request.Context(),
		authToken,
		reservationID.(string),
	)
	if err != nil {
		// Log error but don't block the response
		fmt.Printf("Failed to release token reservation %s: %v\n", reservationID, err)
	} else {
		fmt.Printf("Successfully released token reservation: %s\n", reservationID)
	}

	// Invalidate the reservation from cache
	if idempotencyKey, exists := c.Get("idempotencyKey"); exists {
		err := p.cache.InvalidateTokenReservation(c.Request.Context(), idempotencyKey.(string))
		if err != nil {
			fmt.Printf("Failed to invalidate token reservation cache: %v\n", err)
		}
	}
}

// isHopByHopHeader checks if a header is hop-by-hop
// These headers should not be forwarded
func isHopByHopHeader(header string) bool {
	hopByHopHeaders := []string{
		"Connection",
		"Keep-Alive",
		"Proxy-Authenticate",
		"Proxy-Authorization",
		"Te",
		"Trailers",
		"Transfer-Encoding",
		"Upgrade",
	}

	headerLower := strings.ToLower(header)
	for _, h := range hopByHopHeaders {
		if strings.ToLower(h) == headerLower {
			return true
		}
	}
	return false
}
