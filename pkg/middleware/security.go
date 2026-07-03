package middleware

import (
	"net/http"
	"os"
	"strings"
)

// SecurityHeaders returns a middleware that sets common security headers.
// HSTS 仅在 STACK=prod 时启用，避免预发环境误用。
func SecurityHeaders() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "no-referrer")
			// Basic CSP：仅限制为自源，可按需在各服务放宽
			if w.Header().Get("Content-Security-Policy") == "" {
				w.Header().Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; object-src 'none'")
			}
			// HSTS for prod only
			if strings.EqualFold(strings.TrimSpace(os.Getenv("STACK")), "prod") {
				w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
			}
			next.ServeHTTP(w, r)
		})
	}
}
