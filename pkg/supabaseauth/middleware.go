package supabaseauth

import (
	"net/http"
)

// Middleware returns a standard HTTP middleware that enforces Supabase authentication.
func Middleware(verifier *Verifier) func(http.Handler) http.Handler {
	if verifier == nil {
		verifier = DefaultVerifier()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := verifier.VerifyRequest(r.Context(), r)
			if err != nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			ctx := ContextWithClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalMiddleware verifies tokens if present but does not enforce authentication.
func OptionalMiddleware(verifier *Verifier) func(http.Handler) http.Handler {
	if verifier == nil {
		verifier = DefaultVerifier()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := verifier.VerifyRequest(r.Context(), r)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			ctx := ContextWithClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
