package middleware

import "net/http"

type contextKey string

const (
	UserIDKey    contextKey = "user_id"
	UserEmailKey contextKey = "user_email"
)

// AuthMiddleware reads user context from Gateway-injected headers.
//
// IMPORTANT: This middleware expects requests to come through API Gateway.
// Gateway validates JWT tokens and injects X-User-ID and X-User-Email headers.
//
// For direct service-to-service calls, use internal endpoints that don't require auth,
// or use SupabaseAuth() for services that need to validate JWTs independently.
func AuthMiddleware(next http.Handler) http.Handler {
	return GatewayAuthMiddleware(next)
}

// LegacyJWTAuthMiddleware provides backward compatibility for services
// that still need direct JWT validation (not recommended - use Gateway instead)
//
// Deprecated: Use AuthMiddleware which trusts Gateway headers.
func LegacyJWTAuthMiddleware(next http.Handler) http.Handler {
	return SupabaseAuth()(next)
}
