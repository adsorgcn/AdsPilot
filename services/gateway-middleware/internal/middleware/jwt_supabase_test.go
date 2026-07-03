package middleware

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Test RSA key pair for JWT signing
var (
	testPrivateKey *rsa.PrivateKey
	testPublicKey  *rsa.PublicKey
	testKID        = "test-key-id-1"
)

func init() {
	// Generate test RSA key pair (2048 bits)
	var err error
	testPrivateKey, err = rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic(fmt.Sprintf("failed to generate test RSA key: %v", err))
	}
	testPublicKey = &testPrivateKey.PublicKey
}

// mockJWKSServer creates a test HTTP server that serves JWKS
func mockJWKSServer(t *testing.T) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Supabase JWKS endpoint path
		if r.URL.Path != "/auth/v1/.well-known/jwks.json" {
			http.NotFound(w, r)
			return
		}

		// Convert RSA public key to JWK format
		n := testPublicKey.N.Bytes()
		e := big.NewInt(int64(testPublicKey.E)).Bytes()

		jwks := map[string]interface{}{
			"keys": []map[string]interface{}{
				{
					"kid": testKID,
					"kty": "RSA",
					"alg": "RS256",
					"use": "sig",
					"n":   base64.RawURLEncoding.EncodeToString(n),
					"e":   base64.RawURLEncoding.EncodeToString(e),
				},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(jwks)
	}))
}

// createSupabaseTestToken creates a valid RS256-signed JWT token
func createSupabaseTestToken(t *testing.T, sub, email, role string, exp time.Time, issuer, audience string) string {
	claims := jwt.MapClaims{
		"sub":   sub,
		"email": email,
		"role":  role,
		"exp":   exp.Unix(),
		"iat":   time.Now().Unix(),
		"iss":   issuer,
		"aud":   audience,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = testKID

	tokenString, err := token.SignedString(testPrivateKey)
	if err != nil {
		t.Fatalf("Failed to create test token: %v", err)
	}

	return tokenString
}

// TestSupabaseTokenVerifier_Verify tests the Supabase token verifier
func TestSupabaseTokenVerifier_Verify(t *testing.T) {
	// Start mock JWKS server
	mockServer := mockJWKSServer(t)
	defer mockServer.Close()

	projectURL := mockServer.URL
	issuer := fmt.Sprintf("%s/auth/v1", projectURL)
	audience := "authenticated"

	verifier := NewSupabaseTokenVerifier(projectURL, "") // RS256 doesn't need jwtSecret

	tests := []struct {
		name        string
		tokenFunc   func() string
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid token",
			tokenFunc: func() string {
				return createSupabaseTestToken(t, "user-123", "test@example.com", "authenticated",
					time.Now().Add(time.Hour), issuer, audience)
			},
			expectError: false,
		},
		{
			name: "expired token",
			tokenFunc: func() string {
				return createSupabaseTestToken(t, "user-123", "test@example.com", "authenticated",
					time.Now().Add(-time.Hour), issuer, audience)
			},
			expectError: true,
			errorMsg:    "expired",
		},
		{
			name: "wrong issuer",
			tokenFunc: func() string {
				return createSupabaseTestToken(t, "user-123", "test@example.com", "authenticated",
					time.Now().Add(time.Hour), "https://wrong-issuer.com", audience)
			},
			expectError: true,
			errorMsg:    "issuer",
		},
		{
			name: "wrong audience",
			tokenFunc: func() string {
				return createSupabaseTestToken(t, "user-123", "test@example.com", "authenticated",
					time.Now().Add(time.Hour), issuer, "wrong-audience")
			},
			expectError: true,
			errorMsg:    "audience",
		},
		{
			name: "malformed token",
			tokenFunc: func() string {
				return "invalid.token.format"
			},
			expectError: true,
		},
		{
			name: "token with wrong signing method (HS256)",
			tokenFunc: func() string {
				claims := jwt.MapClaims{
					"sub": "user-123",
					"exp": time.Now().Add(time.Hour).Unix(),
					"iss": issuer,
					"aud": audience,
				}
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
				tokenString, _ := token.SignedString([]byte("secret"))
				return tokenString
			},
			expectError: true,
			errorMsg:    "JWT secret not configured", // Updated: we pass empty jwtSecret, so HS256 fails with this error
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			tokenString := tt.tokenFunc()
			claims, err := verifier.Verify(ctx, tokenString)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				} else if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Errorf("Expected error containing '%s', got: %v", tt.errorMsg, err)
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if claims == nil {
					t.Error("Expected claims but got nil")
				}
				if claims != nil && claims.Subject != "user-123" {
					t.Errorf("Expected subject 'user-123', got '%s'", claims.Subject)
				}
			}
		})
	}
}

// TestJWTMiddleware_WithSupabaseJWT tests the JWT middleware with Supabase tokens
func TestJWTMiddleware_WithSupabaseJWT(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Start mock JWKS server
	mockServer := mockJWKSServer(t)
	defer mockServer.Close()

	projectURL := mockServer.URL
	issuer := fmt.Sprintf("%s/auth/v1", projectURL)
	audience := "authenticated"

	middleware := NewJWTMiddleware(projectURL, "") // RS256 doesn't need jwtSecret

	tests := []struct {
		name           string
		setupAuth      func() string
		expectedStatus int
		expectAbort    bool
		expectedUserID string
		expectedEmail  string
	}{
		{
			name: "valid Supabase token",
			setupAuth: func() string {
				token := createSupabaseTestToken(t, "user-456", "user@example.com", "authenticated",
					time.Now().Add(time.Hour), issuer, audience)
				return "Bearer " + token
			},
			expectedStatus: http.StatusOK,
			expectAbort:    false,
			expectedUserID: "user-456",
			expectedEmail:  "user@example.com",
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
			name: "expired Supabase token",
			setupAuth: func() string {
				token := createSupabaseTestToken(t, "user-789", "expired@example.com", "authenticated",
					time.Now().Add(-time.Hour), issuer, audience)
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
		{
			name: "token with wrong issuer",
			setupAuth: func() string {
				token := createSupabaseTestToken(t, "user-999", "test@example.com", "authenticated",
					time.Now().Add(time.Hour), "https://wrong-issuer.com", audience)
				return "Bearer " + token
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

			// Execute middleware
			middleware.Handler()(c)

			// Assert status code
			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d. Response: %s",
					tt.expectedStatus, w.Code, w.Body.String())
			}

			// Assert abort status
			if tt.expectAbort && !c.IsAborted() {
				t.Error("Expected request to be aborted, but it wasn't")
			}

			if !tt.expectAbort && c.IsAborted() {
				t.Error("Expected request to continue, but it was aborted")
			}

			// Check context values for successful cases
			if !tt.expectAbort {
				userID, exists := c.Get("userID")
				if !exists {
					t.Error("Expected userID in context, but it wasn't set")
				} else if userID != tt.expectedUserID {
					t.Errorf("Expected userID '%s', got '%v'", tt.expectedUserID, userID)
				}

				email, exists := c.Get("userEmail")
				if !exists {
					t.Error("Expected userEmail in context, but it wasn't set")
				} else if email != tt.expectedEmail {
					t.Errorf("Expected email '%s', got '%v'", tt.expectedEmail, email)
				}

				auth, exists := c.Get("auth")
				if !exists {
					t.Error("Expected auth context, but it wasn't set")
				}
				authCtx, ok := auth.(*AuthContext)
				if !ok {
					t.Error("Auth context has wrong type")
				} else {
					if authCtx.UserID != tt.expectedUserID {
						t.Errorf("AuthContext UserID: expected '%s', got '%s'",
							tt.expectedUserID, authCtx.UserID)
					}
					if authCtx.Email != tt.expectedEmail {
						t.Errorf("AuthContext Email: expected '%s', got '%s'",
							tt.expectedEmail, authCtx.Email)
					}
				}
			}
		})
	}
}

// TestJWTMiddleware_JWKSCaching tests that JWKS is cached correctly
func TestJWTMiddleware_JWKSCaching(t *testing.T) {
	gin.SetMode(gin.TestMode)

	requestCount := 0
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Supabase JWKS endpoint path
		if r.URL.Path != "/auth/v1/.well-known/jwks.json" {
			http.NotFound(w, r)
			return
		}

		requestCount++

		// Serve JWKS
		n := testPublicKey.N.Bytes()
		e := big.NewInt(int64(testPublicKey.E)).Bytes()

		jwks := map[string]interface{}{
			"keys": []map[string]interface{}{
				{
					"kid": testKID,
					"kty": "RSA",
					"alg": "RS256",
					"use": "sig",
					"n":   base64.RawURLEncoding.EncodeToString(n),
					"e":   base64.RawURLEncoding.EncodeToString(e),
				},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(jwks)
	}))
	defer mockServer.Close()

	projectURL := mockServer.URL
	issuer := fmt.Sprintf("%s/auth/v1", projectURL)
	audience := "authenticated"

	middleware := NewJWTMiddleware(projectURL, "") // RS256 doesn't need jwtSecret

	// Create valid token
	token := createSupabaseTestToken(t, "cache-test-user", "cache@example.com", "authenticated",
		time.Now().Add(time.Hour), issuer, audience)

	// Make 3 requests with the same token
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("Authorization", "Bearer "+token)

		middleware.Handler()(c)

		if w.Code != http.StatusOK {
			t.Errorf("Request %d: Expected status 200, got %d", i+1, w.Code)
		}
	}

	// JWKS should only be fetched once due to caching
	if requestCount != 1 {
		t.Errorf("Expected JWKS to be fetched once, but it was fetched %d times", requestCount)
	}
}

// TestJWTMiddleware_GetAuthContext tests the GetAuthContext helper
func TestJWTMiddleware_GetAuthContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name          string
		setupCtx      func(*gin.Context)
		expectError   bool
		expectedID    string
		expectedEmail string
	}{
		{
			name: "valid auth context",
			setupCtx: func(c *gin.Context) {
				c.Set("auth", &AuthContext{
					UserID: "test-user-id",
					Email:  "test@example.com",
					Role:   "authenticated",
				})
			},
			expectError:   false,
			expectedID:    "test-user-id",
			expectedEmail: "test@example.com",
		},
		{
			name: "missing auth context",
			setupCtx: func(c *gin.Context) {
				// Don't set auth
			},
			expectError: true,
		},
		{
			name: "invalid auth context type",
			setupCtx: func(c *gin.Context) {
				c.Set("auth", "invalid-type")
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			tt.setupCtx(c)

			authCtx, err := GetAuthContext(c)

			if tt.expectError {
				if err == nil {
					t.Error("Expected error, got nil")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if authCtx == nil {
					t.Error("Expected auth context, got nil")
				}
				if authCtx != nil {
					if authCtx.UserID != tt.expectedID {
						t.Errorf("Expected UserID '%s', got '%s'", tt.expectedID, authCtx.UserID)
					}
					if authCtx.Email != tt.expectedEmail {
						t.Errorf("Expected Email '%s', got '%s'", tt.expectedEmail, authCtx.Email)
					}
				}
			}
		})
	}
}
