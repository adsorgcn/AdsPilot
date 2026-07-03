package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth"
)

// SupabaseAuth is a middleware that validates Supabase JWT tokens
// and sets the user ID in the request context
func SupabaseAuth() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"Missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				http.Error(w, `{"error":"Invalid authorization header format"}`, http.StatusUnauthorized)
				return
			}

			tokenString := parts[1]
			verifier := supabaseauth.DefaultVerifier()

			claims, err := verifier.Verify(r.Context(), tokenString)
			if err != nil {
				http.Error(w, `{"error":"Invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			ctx := supabaseauth.ContextWithClaims(r.Context(), claims)
			ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
			if strings.TrimSpace(claims.Email) != "" {
				ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// SupabaseAuthOptional is a middleware that validates Supabase JWT tokens if present
// but allows requests without authentication to proceed
func SupabaseAuthOptional() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				next.ServeHTTP(w, r)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				next.ServeHTTP(w, r)
				return
			}

			tokenString := parts[1]
			verifier := supabaseauth.DefaultVerifier()

			claims, err := verifier.Verify(r.Context(), tokenString)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			ctx := supabaseauth.ContextWithClaims(r.Context(), claims)
			ctx = context.WithValue(ctx, UserIDKey, claims.UserID)
			if strings.TrimSpace(claims.Email) != "" {
				ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserIDFromContext extracts the user ID from the request context
func GetUserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(UserIDKey).(string)
	return userID, ok
}

// GetUserEmailFromContext returns email stored by Supabase middleware.
func GetUserEmailFromContext(ctx context.Context) (string, bool) {
	email, ok := ctx.Value(UserEmailKey).(string)
	return email, ok
}
