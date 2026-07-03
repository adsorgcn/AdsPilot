package middleware

import (
	"github.com/ScientificInternet/Google-Monetize/pkg/idempotency"
	"net/http"
)

// IdempotencyMiddleware extracts X-Idempotency-Key and stores it into context for downstream handlers.
func IdempotencyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		k := idempotency.FromHeader(r)
		if k != "" && !idempotency.Validate(k) {
			// Silently drop invalid keys to avoid rejection at middleware layer
			k = ""
		}
		if k != "" {
			r = r.WithContext(idempotency.WithContext(r.Context(), k))
		}
		next.ServeHTTP(w, r)
	})
}
