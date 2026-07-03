package supabaseauth

import "context"

type contextKey string

const (
	claimsContextKey contextKey = "supabase.claims"
)

// ContextWithClaims returns a new context containing Supabase claims.
func ContextWithClaims(ctx context.Context, claims Claims) context.Context {
	return context.WithValue(ctx, claimsContextKey, claims)
}

// ClaimsFromContext extracts Supabase claims from context.
func ClaimsFromContext(ctx context.Context) (Claims, bool) {
	value := ctx.Value(claimsContextKey)
	if value == nil {
		return Claims{}, false
	}
	claims, ok := value.(Claims)
	return claims, ok
}

// UserIDFromContext is a convenience helper returning the user id.
func UserIDFromContext(ctx context.Context) (string, bool) {
	claims, ok := ClaimsFromContext(ctx)
	if !ok {
		return "", false
	}
	if claims.UserID == "" {
		return "", false
	}
	return claims.UserID, true
}

// EmailFromContext returns the email claim if present.
func EmailFromContext(ctx context.Context) (string, bool) {
	claims, ok := ClaimsFromContext(ctx)
	if !ok || claims.Email == "" {
		return "", false
	}
	return claims.Email, true
}
