package supabaseauth

import "github.com/golang-jwt/jwt/v5"

// Claims represents identity attributes extracted from a Supabase JWT.
type Claims struct {
	UserID string
	Email  string
	Role   string
	Raw    jwt.MapClaims
}

func (c Claims) HasEmail() bool {
	return c.Email != ""
}

func (c Claims) HasRole(role string) bool {
	if role == "" || c.Role == "" {
		return false
	}
	return c.Role == role
}
