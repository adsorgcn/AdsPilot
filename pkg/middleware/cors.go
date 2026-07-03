package middleware

import (
	"fmt"
	"net/http"
	"strings"
)

// CORSConfig holds CORS configuration
type CORSConfig struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	ExposedHeaders   []string
	AllowCredentials bool
	MaxAge           int
}

// DefaultCORSConfig returns a default CORS configuration for Google-Monetize
// Updated: 2025-10-13 - Trigger rebuild for console and offer services
func DefaultCORSConfig() CORSConfig {
	return CORSConfig{
		AllowedOrigins: []string{
			"https://www.urlchecker.dev", // Preview environment
			"https://www.autoads.dev",    // Production environment
			"http://localhost:3000",      // Local development
			"http://localhost:3001",      // Local development (alternative port)
		},
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowedHeaders: []string{
			"Authorization",
			"Content-Type",
			"X-Requested-With",
			"Accept",
			"Origin",
			"X-Supabase-Access-Token",
		},
		ExposedHeaders: []string{
			"X-RateLimit-Limit",
			"X-RateLimit-Remaining",
			"X-RateLimit-Reset",
			"Content-Length",
			"Content-Type",
		},
		AllowCredentials: true,
		MaxAge:           3600, // 1 hour
	}
}

// CORS returns a middleware that handles CORS headers
func CORS(config CORSConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Check if origin is allowed
			allowed := false
			for _, allowedOrigin := range config.AllowedOrigins {
				if allowedOrigin == "*" || allowedOrigin == origin {
					allowed = true
					break
				}
			}

			if allowed {
				// Set CORS headers
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", strings.Join(config.AllowedMethods, ", "))
				w.Header().Set("Access-Control-Allow-Headers", strings.Join(config.AllowedHeaders, ", "))

				if len(config.ExposedHeaders) > 0 {
					w.Header().Set("Access-Control-Expose-Headers", strings.Join(config.ExposedHeaders, ", "))
				}

				if config.AllowCredentials {
					w.Header().Set("Access-Control-Allow-Credentials", "true")
				}

				if config.MaxAge > 0 {
					w.Header().Set("Access-Control-Max-Age", fmt.Sprintf("%d", config.MaxAge))
				}
			}

			// Handle preflight OPTIONS request
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}

			// Continue to next handler
			next.ServeHTTP(w, r)
		})
	}
}

// CORSWithDefaults returns a CORS middleware with default Google-Monetize configuration
func CORSWithDefaults() func(http.Handler) http.Handler {
	return CORS(DefaultCORSConfig())
}
