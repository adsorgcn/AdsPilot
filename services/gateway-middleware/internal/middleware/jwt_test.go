package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// NOTE: This test is deprecated. Use jwt_supabase_test.go for RS256 + JWKS tests
func TestJWTMiddleware_Handler(t *testing.T) {
	t.Skip("Deprecated: Use TestJWTMiddleware_WithSupabaseJWT in jwt_supabase_test.go")
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		setupAuth      func() string
		expectedStatus int
		expectAbort    bool
	}{
		{
			name: "valid token",
			setupAuth: func() string {
				token := createTestToken(t, "user123", "test@example.com", "user", time.Now().Add(time.Hour))
				return "Bearer " + token
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
		},
		{
			name: "missing authorization header",
			setupAuth: func() string {
				return ""
			},
			expectedStatus: http.StatusUnauthorized,
			expectAbort:    true,
		},
		{
			name: "invalid bearer format",
			setupAuth: func() string {
				return "InvalidFormat"
			},
			expectedStatus: http.StatusUnauthorized,
			expectAbort:    true,
		},
		{
			name: "expired token",
			setupAuth: func() string {
				token := createTestToken(t, "user123", "test@example.com", "user", time.Now().Add(-time.Hour))
				return "Bearer " + token
			},
			expectedStatus: http.StatusUnauthorized,
			expectAbort:    true,
		},
		{
			name: "malformed token",
			setupAuth: func() string {
				return "Bearer invalid.token.here"
			},
			expectedStatus: http.StatusUnauthorized,
			expectAbort:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest("GET", "/test", nil)

			if authHeader := tt.setupAuth(); authHeader != "" {
				c.Request.Header.Set("Authorization", authHeader)
			}

			// Create middleware (using mock Supabase URL for now)
			middleware := NewJWTMiddleware("https://test.supabase.co", "") // RS256 test, no secret needed

			// Execute
			middleware.Handler()(c)

			// Assert
			if tt.expectAbort && !c.IsAborted() {
				t.Errorf("Expected request to be aborted, but it wasn't")
			}

			if !tt.expectAbort && c.IsAborted() {
				t.Errorf("Expected request to continue, but it was aborted")
			}

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// Check context values for successful cases
			if !tt.expectAbort {
				userID, exists := c.Get("userID")
				if !exists {
					t.Error("Expected userID in context, but it wasn't set")
				}
				if userID != "user123" {
					t.Errorf("Expected userID 'user123', got '%v'", userID)
				}

				email, exists := c.Get("userEmail")
				if !exists {
					t.Error("Expected userEmail in context, but it wasn't set")
				}
				if email != "test@example.com" {
					t.Errorf("Expected email 'test@example.com', got '%v'", email)
				}

				role, exists := c.Get("userRole")
				if !exists {
					t.Error("Expected userRole in context, but it wasn't set")
				}
				if role != "user" {
					t.Errorf("Expected role 'user', got '%v'", role)
				}
			}
		})
	}
}

func TestGetUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name        string
		setupCtx    func(*gin.Context)
		expectError bool
		expectedID  string
	}{
		{
			name: "valid user ID",
			setupCtx: func(c *gin.Context) {
				c.Set("userID", "user123")
			},
			expectError: false,
			expectedID:  "user123",
		},
		{
			name: "missing user ID",
			setupCtx: func(c *gin.Context) {
				// Don't set userID
			},
			expectError: true,
		},
		{
			name: "invalid type",
			setupCtx: func(c *gin.Context) {
				c.Set("userID", 12345) // Wrong type
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			tt.setupCtx(c)

			userID, err := GetUserID(c)

			if tt.expectError && err == nil {
				t.Error("Expected error, got nil")
			}

			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if !tt.expectError && userID != tt.expectedID {
				t.Errorf("Expected userID '%s', got '%s'", tt.expectedID, userID)
			}
		})
	}
}

// Helper function to create test JWT tokens
func createTestToken(t *testing.T, sub, email, role string, exp time.Time) string {
	claims := jwt.MapClaims{
		"sub":   sub,
		"email": email,
		"role":  role,
		"exp":   exp.Unix(),
		"iss":   "test-issuer",
		"aud":   "test-audience",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	// Use the same default secret as in jwt.go
	tokenString, err := token.SignedString([]byte("your-256-bit-secret"))
	if err != nil {
		t.Fatalf("Failed to create test token: %v", err)
	}

	return tokenString
}
