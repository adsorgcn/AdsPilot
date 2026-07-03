package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AuthContext holds the authenticated user information
type AuthContext struct {
	UserID string
	Email  string
	Role   string
}

// JWTMiddleware validates JWT tokens and extracts user information
type JWTMiddleware struct {
	verifier *SupabaseTokenVerifier
}

// NewJWTMiddleware creates a new JWT validation middleware for Supabase auth
func NewJWTMiddleware(projectURL, jwtSecret string) *JWTMiddleware {
	return &JWTMiddleware{
		verifier: NewSupabaseTokenVerifier(projectURL, jwtSecret),
	}
}

// Handler returns a Gin middleware function that validates JWT
func (m *JWTMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract JWT from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Missing authorization header",
			})
			c.Abort()
			return
		}

		// Expected format: "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Parse and validate JWT
		authCtx, err := m.validateToken(c.Request.Context(), tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": fmt.Sprintf("Invalid token: %v", err),
			})
			c.Abort()
			return
		}

		// Store auth context in Gin context
		c.Set("auth", authCtx)
		c.Set("userID", authCtx.UserID)
		c.Set("userEmail", authCtx.Email)
		c.Set("userRole", authCtx.Role)

		c.Next()
	}
}

// validateToken parses and validates the Supabase JWT token
func (m *JWTMiddleware) validateToken(ctx context.Context, tokenString string) (*AuthContext, error) {
	// Verify token using Supabase verifier (RS256 + JWKS)
	claims, err := m.verifier.Verify(ctx, tokenString)
	if err != nil {
		return nil, fmt.Errorf("failed to verify token: %w", err)
	}

	// Extract user information from registered claims
	authCtx := &AuthContext{
		UserID: claims.Subject,
	}

	// Parse additional claims for email and role
	// Note: Supabase stores additional user metadata in the token
	// We'll need to parse the raw token again to get custom claims
	if err := m.extractUserMetadata(tokenString, authCtx); err != nil {
		// Log but don't fail - email and role are optional
		_ = err
	}

	return authCtx, nil
}

// extractUserMetadata extracts email and role from Supabase JWT custom claims
func (m *JWTMiddleware) extractUserMetadata(tokenString string, authCtx *AuthContext) error {
	// Parse token without verification (already verified above)
	parser := jwt.NewParser()
	token, _, err := parser.ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		return err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return fmt.Errorf("invalid claims type")
	}

	// Extract email from standard claim
	if email, ok := claims["email"].(string); ok {
		authCtx.Email = email
	}

	// Extract role from user metadata or app metadata
	if role, ok := claims["role"].(string); ok {
		authCtx.Role = role
	} else if userMetadata, ok := claims["user_metadata"].(map[string]interface{}); ok {
		if role, ok := userMetadata["role"].(string); ok {
			authCtx.Role = role
		}
	} else if appMetadata, ok := claims["app_metadata"].(map[string]interface{}); ok {
		if role, ok := appMetadata["role"].(string); ok {
			authCtx.Role = role
		}
	}

	return nil
}

// GetAuthContext retrieves the auth context from Gin context
func GetAuthContext(c *gin.Context) (*AuthContext, error) {
	authValue, exists := c.Get("auth")
	if !exists {
		return nil, fmt.Errorf("auth context not found")
	}

	authCtx, ok := authValue.(*AuthContext)
	if !ok {
		return nil, fmt.Errorf("invalid auth context type")
	}

	return authCtx, nil
}

// GetUserID retrieves the user ID from Gin context
func GetUserID(c *gin.Context) (string, error) {
	userID, exists := c.Get("userID")
	if !exists {
		return "", fmt.Errorf("user ID not found in context")
	}

	uid, ok := userID.(string)
	if !ok {
		return "", fmt.Errorf("invalid user ID type")
	}

	return uid, nil
}
