package middleware

import (
	"context"
	"net/http"
	"strings"
)

// GatewayAuthMiddleware reads user information from Gateway-injected headers.
// This middleware trusts that Gateway has already validated the JWT token.
//
// Gateway injects these headers after JWT validation:
// - X-User-ID: The authenticated user's ID (required)
// - X-User-Email: The user's email address (optional)
// - X-User-Tier: The user's subscription tier (optional)
//
// All external requests MUST go through Gateway. Direct service-to-service calls
// should use internal endpoints that don't require authentication.
func GatewayAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Read user ID from Gateway-injected header
		userID := strings.TrimSpace(r.Header.Get("X-User-ID"))
		if userID == "" {
			// Missing X-User-ID means request did not come through Gateway
			http.Error(w, `{"error":"Unauthorized: Missing user authentication. Requests must go through API Gateway.","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
			return
		}

		// Store user information in context
		ctx := context.WithValue(r.Context(), UserIDKey, userID)

		// Optional: Store email if provided
		if email := strings.TrimSpace(r.Header.Get("X-User-Email")); email != "" {
			ctx = context.WithValue(ctx, UserEmailKey, email)
		}

		// Continue with authenticated context
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GatewayAuthMiddlewareOptional allows requests without authentication
// but extracts user info if present (for optional auth scenarios)
func GatewayAuthMiddlewareOptional(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := strings.TrimSpace(r.Header.Get("X-User-ID"))
		if userID == "" {
			// No user authentication - continue without context
			next.ServeHTTP(w, r)
			return
		}

		// Store user information in context
		ctx := context.WithValue(r.Context(), UserIDKey, userID)

		if email := strings.TrimSpace(r.Header.Get("X-User-Email")); email != "" {
			ctx = context.WithValue(ctx, UserEmailKey, email)
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
