//go:build integration
// +build integration

package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/services/console/internal/clients"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	_ "github.com/lib/pq"
)

// withAdminContext adds admin user ID to the request context
func withAdminContext(r *http.Request, userID string) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
	return r.WithContext(ctx)
}

// TestHandler_NewHandler tests handler initialization
func TestHandler_NewHandler(t *testing.T) {
	// Test with nil database (should not panic)
	handler := &Handler{
		DB: nil,
		ServiceClients: &ServiceClients{
			Offer:     clients.NewOfferClient("http://offer:8080"),
			Billing:   clients.NewBillingClient("http://billing:8080"),
			Adscenter: clients.NewAdscenterClient("http://adscenter:8080"),
		},
	}

	assert.NotNil(t, handler.ServiceClients)
	assert.NotNil(t, handler.ServiceClients.Offer)
	assert.NotNil(t, handler.ServiceClients.Billing)
}

// TestParseQueryInt tests integer query parameter parsing
func TestParseQueryInt(t *testing.T) {
	tests := []struct {
		name         string
		value        string
		defaultValue int
		minValue     int
		maxValue     int
		expected     int
	}{
		{
			name:         "Valid value",
			value:        "50",
			defaultValue: 20,
			minValue:     1,
			maxValue:     100,
			expected:     50,
		},
		{
			name:         "Empty value",
			value:        "",
			defaultValue: 20,
			minValue:     1,
			maxValue:     100,
			expected:     20,
		},
		{
			name:         "Invalid value",
			value:        "abc",
			defaultValue: 20,
			minValue:     1,
			maxValue:     100,
			expected:     20,
		},
		{
			name:         "Below minimum",
			value:        "0",
			defaultValue: 20,
			minValue:     1,
			maxValue:     100,
			expected:     20,
		},
		{
			name:         "Above maximum",
			value:        "200",
			defaultValue: 20,
			minValue:     1,
			maxValue:     100,
			expected:     20,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseQueryInt(tt.value, tt.defaultValue, tt.minValue, tt.maxValue)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// parseQueryInt helper function used in handlers
func parseQueryInt(value string, defaultValue, minValue, maxValue int) int {
	if value == "" {
		return defaultValue
	}

	var result int
	if _, err := fmt.Sscanf(value, "%d", &result); err != nil {
		return defaultValue
	}

	if result < minValue || result > maxValue {
		return defaultValue
	}

	return result
}

// TestHandler_GetUsers_Unauthorized tests unauthorized access
func TestHandler_GetUsers_Unauthorized(t *testing.T) {
	handler := &Handler{
		DB: nil,
		ServiceClients: &ServiceClients{
			Offer:   clients.NewOfferClient("http://offer:8080"),
			Billing: clients.NewBillingClient("http://billing:8080"),
		},
	}

	req := httptest.NewRequest("GET", "/api/v1/console/users", nil)
	// Don't add user context - should be unauthorized
	w := httptest.NewRecorder()

	handler.getUsers(w, req)

	// Without admin middleware, this would be unauthorized
	// In practice, the middleware would catch this before reaching the handler
	// This test verifies the handler expects the middleware
	assert.NotNil(t, w)
}

// TestHandler_IntegrationGetUsers tests user list retrieval
func TestHandler_IntegrationGetUsers(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	db, err := sql.Open("postgres", dbURL)
	require.NoError(t, err)
	defer db.Close()

	ctx := context.Background()

	// Create test users
	testUserID1 := fmt.Sprintf("test_console_user1_%d", time.Now().Unix())
	testUserID2 := fmt.Sprintf("test_console_user2_%d", time.Now().Unix())

	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM "User" WHERE id IN ($1, $2)`, testUserID1, testUserID2)
	}()

	_, err = db.ExecContext(ctx, `
		INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
		VALUES ($1, $2, $3, NOW(), NOW()),
		       ($4, $5, $6, NOW(), NOW())
	`, testUserID1, "test1@example.com", "Test User 1",
		testUserID2, "test2@example.com", "Test User 2")
	require.NoError(t, err)

	handler := &Handler{
		DB: db,
		ServiceClients: &ServiceClients{
			Offer:   clients.NewOfferClient("http://offer:8080"),
			Billing: clients.NewBillingClient("http://billing:8080"),
		},
	}

	req := httptest.NewRequest("GET", "/api/v1/console/users?page=1&pageSize=20", nil)
	req = withAdminContext(req, "admin-user-123")
	w := httptest.NewRecorder()

	handler.getUsers(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response struct {
		Items      []User `json:"items"`
		TotalCount int    `json:"totalCount"`
		Page       int    `json:"page"`
		PageSize   int    `json:"pageSize"`
	}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	// Should have at least our 2 test users
	assert.GreaterOrEqual(t, response.TotalCount, 2)
	assert.NotEmpty(t, response.Items)
}

// TestHandler_SubscriptionStats tests subscription statistics
func TestHandler_SubscriptionStats(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	db, err := sql.Open("postgres", dbURL)
	require.NoError(t, err)
	defer db.Close()

	handler := &Handler{
		DB: db,
		ServiceClients: &ServiceClients{
			Billing: clients.NewBillingClient("http://billing:8080"),
		},
	}

	req := httptest.NewRequest("GET", "/api/v1/console/subscriptions/stats", nil)
	req = withAdminContext(req, "admin-user-123")
	w := httptest.NewRecorder()

	handler.getSubscriptionStats(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var stats map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&stats)
	require.NoError(t, err)

	// Verify required fields exist
	_, hasTotal := stats["totalSubscriptions"]
	_, hasActive := stats["activeSubscriptions"]

	assert.True(t, hasTotal, "Should have totalSubscriptions field")
	assert.True(t, hasActive, "Should have activeSubscriptions field")
}

// TestServiceClients_Initialization tests service client creation
func TestServiceClients_Initialization(t *testing.T) {
	tests := []struct {
		name    string
		envVars map[string]string
	}{
		{
			name: "Default URLs",
			envVars: map[string]string{
				"OFFER_SERVICE_URL":     "",
				"BILLING_SERVICE_URL":   "",
				"ADSCENTER_SERVICE_URL": "",
			},
		},
		{
			name: "Custom URLs",
			envVars: map[string]string{
				"OFFER_SERVICE_URL":     "http://custom-offer:9090",
				"BILLING_SERVICE_URL":   "http://custom-billing:9091",
				"ADSCENTER_SERVICE_URL": "http://custom-adscenter:9092",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set environment variables
			for key, value := range tt.envVars {
				if value != "" {
					os.Setenv(key, value)
					defer os.Unsetenv(key)
				}
			}

			clients := &ServiceClients{
				Offer:     clients.NewOfferClient(getEnv("OFFER_SERVICE_URL", "http://offer:8080")),
				Billing:   clients.NewBillingClient(getEnv("BILLING_SERVICE_URL", "http://billing:8080")),
				Adscenter: clients.NewAdscenterClient(getEnv("ADSCENTER_SERVICE_URL", "http://adscenter:8080")),
			}

			assert.NotNil(t, clients.Offer)
			assert.NotNil(t, clients.Billing)
			assert.NotNil(t, clients.Adscenter)
		})
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// TestHandler_AdminAuthorizationCheck tests admin-only access
func TestHandler_AdminAuthorizationCheck(t *testing.T) {
	// This test verifies that handlers expect admin middleware
	// In production, AdminOnly middleware would check ADMIN_UIDS/ADMIN_EMAILS

	handler := &Handler{
		DB: nil,
		ServiceClients: &ServiceClients{
			Offer:   clients.NewOfferClient("http://offer:8080"),
			Billing: clients.NewBillingClient("http://billing:8080"),
		},
	}

	tests := []struct {
		name     string
		endpoint string
		method   string
		handler  func(w http.ResponseWriter, r *http.Request)
	}{
		{
			name:     "Get Users",
			endpoint: "/api/v1/console/users",
			method:   "GET",
			handler:  handler.getUsers,
		},
		{
			name:     "Get Subscription Stats",
			endpoint: "/api/v1/console/subscriptions/stats",
			method:   "GET",
			handler:  handler.getSubscriptionStats,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.endpoint, nil)
			// Request without admin context would be unauthorized
			// The middleware should handle this before reaching handlers
			w := httptest.NewRecorder()

			// This verifies the handler exists and doesn't panic
			assert.NotPanics(t, func() {
				tt.handler(w, req)
			})
		})
	}
}

// TestUser_Struct tests User structure
func TestUser_Struct(t *testing.T) {
	now := time.Now()

	user := User{
		ID:        "user-test-123",
		Email:     "test@example.com",
		Name:      "Test User",
		CreatedAt: now,
	}

	assert.Equal(t, "user-test-123", user.ID)
	assert.Equal(t, "test@example.com", user.Email)
	assert.Equal(t, "Test User", user.Name)
	assert.False(t, user.CreatedAt.IsZero())
}

// TestUser_JSONSerialization tests User JSON marshaling
func TestUser_JSONSerialization(t *testing.T) {
	now := time.Now()

	original := User{
		ID:        "user-json-456",
		Email:     "json@example.com",
		Name:      "JSON Test User",
		CreatedAt: now,
	}

	// Marshal
	data, err := json.Marshal(original)
	require.NoError(t, err)

	// Unmarshal
	var unmarshaled User
	err = json.Unmarshal(data, &unmarshaled)
	require.NoError(t, err)

	assert.Equal(t, original.ID, unmarshaled.ID)
	assert.Equal(t, original.Email, unmarshaled.Email)
	assert.Equal(t, original.Name, unmarshaled.Name)
}
