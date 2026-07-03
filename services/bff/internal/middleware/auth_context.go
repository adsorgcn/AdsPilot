package middleware

import (
	"context"
	"net/http"
)

// AuthContextMiddleware preserves the Authorization header in context for downstream service calls
func AuthContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			// Store in context for downstream use
			ctx := context.WithValue(r.Context(), "authorization", authHeader)
			r = r.WithContext(ctx)
		}

		next.ServeHTTP(w, r)
	})
}
