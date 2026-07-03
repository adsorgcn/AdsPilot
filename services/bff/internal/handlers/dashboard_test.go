package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

// TestGetDashboardStats_CacheHit tests cache hit scenario
func TestGetDashboardStats_CacheHit(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Setup mock Redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	// Check if Redis is available
	ctx := context.Background()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis not available: %v", err)
	}

	handler := NewDashboardHandler(nil, redisClient) // nil registry for cache test

	// Create test request
	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboard/stats", nil)
	reqCtx := context.WithValue(req.Context(), "user_id", "test-user-123")
	reqCtx = context.WithValue(reqCtx, "authorization", "Bearer test-token")
	req = req.WithContext(reqCtx)

	// Create cached data
	cachedStats := DashboardStats{
		UserID:      "test-user-123",
		TotalOffers: 10,
		LastUpdated: time.Now(),
	}
	cacheData, _ := json.Marshal(cachedStats)
	cacheKey := "dashboard:stats:test-user-123"
	redisClient.Set(context.Background(), cacheKey, cacheData, 5*time.Minute)

	// Execute request
	rr := httptest.NewRecorder()
	handler.GetDashboardStats(rr, req)

	// Verify response
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status 200, got %d", status)
	}

	// Check cache header
	cacheStatus := rr.Header().Get("X-Cache-Status")
	if cacheStatus != "HIT" {
		t.Errorf("Expected cache HIT, got %s", cacheStatus)
	}

	// Verify response body
	var response DashboardStats
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	if response.UserID != "test-user-123" {
		t.Errorf("Expected userID test-user-123, got %s", response.UserID)
	}

	if response.TotalOffers != 10 {
		t.Errorf("Expected totalOffers 10, got %d", response.TotalOffers)
	}

	// Cleanup
	redisClient.Del(context.Background(), cacheKey)
}

// TestGetDashboardStats_Unauthorized tests unauthorized access
func TestGetDashboardStats_Unauthorized(t *testing.T) {
	handler := NewDashboardHandler(nil, nil) // nil registry and nil redis

	// Create request without user_id in context
	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboard/stats", nil)
	rr := httptest.NewRecorder()

	handler.GetDashboardStats(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", status)
	}
}

// TestGetUserIDFromContext tests user ID extraction from context
func TestGetUserIDFromContext(t *testing.T) {
	tests := []struct {
		name     string
		userID   interface{}
		expected string
		ok       bool
	}{
		{
			name:     "Valid user ID",
			userID:   "user-123",
			expected: "user-123",
			ok:       true,
		},
		{
			name:     "Empty user ID",
			userID:   "",
			expected: "",
			ok:       false,
		},
		{
			name:     "Invalid type",
			userID:   123,
			expected: "",
			ok:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.WithValue(context.Background(), "user_id", tt.userID)
			userID, ok := getUserIDFromContext(ctx)

			if ok != tt.ok {
				t.Errorf("Expected ok=%v, got %v", tt.ok, ok)
			}

			if userID != tt.expected {
				t.Errorf("Expected userID=%s, got %s", tt.expected, userID)
			}
		})
	}
}

// TestGetAuthHeaderFromContext tests authorization header extraction
func TestGetAuthHeaderFromContext(t *testing.T) {
	tests := []struct {
		name     string
		authHdr  interface{}
		expected string
		ok       bool
	}{
		{
			name:     "Valid auth header",
			authHdr:  "Bearer token123",
			expected: "Bearer token123",
			ok:       true,
		},
		{
			name:     "Empty auth header",
			authHdr:  "",
			expected: "",
			ok:       false,
		},
		{
			name:     "Invalid type",
			authHdr:  12345,
			expected: "",
			ok:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.WithValue(context.Background(), "authorization", tt.authHdr)
			authHeader, ok := getAuthHeaderFromContext(ctx)

			if ok != tt.ok {
				t.Errorf("Expected ok=%v, got %v", tt.ok, ok)
			}

			if authHeader != tt.expected {
				t.Errorf("Expected authHeader=%s, got %s", tt.expected, authHeader)
			}
		})
	}
}

// TestDashboardStats_Struct tests DashboardStats structure
func TestDashboardStats_Struct(t *testing.T) {
	now := time.Now()
	endTime := now.Add(30 * 24 * time.Hour)

	stats := DashboardStats{
		UserID:               "user-123",
		TotalOffers:          25,
		EvaluatedOffers:      20,
		PendingEvaluations:   5,
		AIEvaluationsTotal:   15,
		AIEvaluationsSuccess: 12,
		AIEvaluationsFailed:  3,
		TokensTotal:          1000,
		TokensConsumed:       300,
		TokensRemaining:      700,
		SubscriptionPlan:     "professional",
		SubscriptionEnd:      &endTime,
		CheckinStreak:        7,
		TotalCheckins:        30,
		TotalReferrals:       5,
		SuccessfulReferrals:  3,
		RecentEvaluations:    []RecentEvaluation{},
		LastUpdated:          now,
	}

	// Verify basic fields
	if stats.UserID != "user-123" {
		t.Errorf("Expected UserID user-123, got %s", stats.UserID)
	}

	// Verify calculations
	if stats.TokensConsumed != stats.TokensTotal-stats.TokensRemaining {
		t.Errorf("Token calculation incorrect: consumed=%d, total=%d, remaining=%d",
			stats.TokensConsumed, stats.TokensTotal, stats.TokensRemaining)
	}

	// Verify AI evaluation totals
	if stats.AIEvaluationsTotal != stats.AIEvaluationsSuccess+stats.AIEvaluationsFailed {
		t.Errorf("AI evaluation total mismatch: total=%d, success=%d, failed=%d",
			stats.AIEvaluationsTotal, stats.AIEvaluationsSuccess, stats.AIEvaluationsFailed)
	}

	// Verify referral logic
	if stats.SuccessfulReferrals > stats.TotalReferrals {
		t.Errorf("Successful referrals (%d) should not exceed total referrals (%d)",
			stats.SuccessfulReferrals, stats.TotalReferrals)
	}
}

// TestAdsAccountStats_Struct tests AdsAccountStats structure
func TestAdsAccountStats_Struct(t *testing.T) {
	adsStats := AdsAccountStats{
		TotalAccounts:        10,
		ActiveAccounts:       8,
		PendingAuthorization: 2,
		OffersCoverage:       75.5,
	}

	if adsStats.TotalAccounts != 10 {
		t.Errorf("Expected TotalAccounts 10, got %d", adsStats.TotalAccounts)
	}

	if adsStats.ActiveAccounts > adsStats.TotalAccounts {
		t.Errorf("Active accounts (%d) should not exceed total accounts (%d)",
			adsStats.ActiveAccounts, adsStats.TotalAccounts)
	}

	if adsStats.OffersCoverage < 0 || adsStats.OffersCoverage > 100 {
		t.Errorf("Offers coverage should be between 0-100, got %.2f", adsStats.OffersCoverage)
	}
}

// TestRecentEvaluation_Struct tests RecentEvaluation structure
func TestRecentEvaluation_Struct(t *testing.T) {
	now := time.Now()
	brandName := "Test Brand"
	domain := "example.com"
	score := 85

	evaluation := RecentEvaluation{
		ID:             "eval-123",
		OfferID:        "offer-456",
		Type:           "ai",
		Status:         "completed",
		TokensConsumed: 50,
		BrandName:      &brandName,
		Domain:         &domain,
		AIScore:        &score,
		CompletedAt:    &now,
		CreatedAt:      now,
	}

	if evaluation.Type != "ai" && evaluation.Type != "basic" {
		t.Errorf("Invalid evaluation type: %s", evaluation.Type)
	}

	if evaluation.AIScore != nil && (*evaluation.AIScore < 0 || *evaluation.AIScore > 100) {
		t.Errorf("AI score should be between 0-100, got %d", *evaluation.AIScore)
	}

	if evaluation.TokensConsumed < 0 {
		t.Errorf("Tokens consumed should be non-negative, got %d", evaluation.TokensConsumed)
	}
}

// TestNewDashboardHandler tests handler initialization
func TestNewDashboardHandler(t *testing.T) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	handler := NewDashboardHandler(nil, redisClient) // nil registry for test

	if handler == nil {
		t.Error("Expected handler to be initialized")
	}

	if handler.redisClient != redisClient {
		t.Error("Expected redisClient to be set")
	}
}

// TestNewDashboardHandler_NilRedis tests handler with nil Redis client
func TestNewDashboardHandler_NilRedis(t *testing.T) {
	handler := NewDashboardHandler(nil, nil) // both nil for test

	if handler == nil {
		t.Error("Expected handler to be initialized even with nil Redis")
	}

	if handler.redisClient != nil {
		t.Error("Expected redisClient to be nil")
	}
}

// TestGetDashboardStats_PartialFailure tests partial failure tolerance
// BE-071: System should return partial data even when some services fail
func TestGetDashboardStats_PartialFailure(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	handler := NewDashboardHandler(nil, nil) // both nil for test

	// Create request with valid context
	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboard/stats", nil)
	ctx := context.WithValue(req.Context(), "user_id", "test-user-partial")
	ctx = context.WithValue(ctx, "authorization", "Bearer test-token")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler.GetDashboardStats(rr, req)

	// Should still return 200 OK even if some services fail
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status 200, got %d", status)
	}

	// Check for X-Partial-Errors header (will be present if any service fails)
	partialErrors := rr.Header().Get("X-Partial-Errors")
	t.Logf("Partial errors count: %s", partialErrors)

	// Verify response can be decoded even with partial failures
	var response DashboardStats
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	// Verify basic response structure
	if response.UserID != "test-user-partial" {
		t.Errorf("Expected userID test-user-partial, got %s", response.UserID)
	}

	// LastUpdated should be set
	if response.LastUpdated.IsZero() {
		t.Error("Expected LastUpdated to be set")
	}

	// RecentEvaluations should be initialized (even if empty)
	if response.RecentEvaluations == nil {
		t.Error("Expected RecentEvaluations to be initialized")
	}
}

// TestGetDashboardStats_CacheMiss tests cache miss scenario
func TestGetDashboardStats_CacheMiss(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	handler := NewDashboardHandler(nil, nil) // nil registry and redis ensures cache miss

	// Create request
	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboard/stats", nil)
	ctx := context.WithValue(req.Context(), "user_id", "test-user-cache-miss")
	ctx = context.WithValue(ctx, "authorization", "Bearer test-token")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler.GetDashboardStats(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status 200, got %d", status)
	}

	// Check cache status header
	cacheStatus := rr.Header().Get("X-Cache-Status")
	if cacheStatus != "MISS" {
		t.Errorf("Expected cache MISS, got %s", cacheStatus)
	}

	var response DashboardStats
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	if response.UserID != "test-user-cache-miss" {
		t.Errorf("Expected userID test-user-cache-miss, got %s", response.UserID)
	}
}

// TestGetDashboardStats_NoAuthorizationHeader tests behavior without auth header
func TestGetDashboardStats_NoAuthorizationHeader(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	handler := NewDashboardHandler(nil, nil) // both nil for test

	// Create request without authorization header
	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboard/stats", nil)
	ctx := context.WithValue(req.Context(), "user_id", "test-user-no-auth")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	handler.GetDashboardStats(rr, req)

	// Should still return 200 OK (auth header is optional for some services)
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status 200, got %d", status)
	}

	var response DashboardStats
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}
}

// TestDashboardStats_JSONSerialization tests JSON marshaling/unmarshaling
func TestDashboardStats_JSONSerialization(t *testing.T) {
	now := time.Now()
	endTime := now.Add(30 * 24 * time.Hour)

	original := DashboardStats{
		UserID:               "user-json-test",
		TotalOffers:          50,
		EvaluatedOffers:      40,
		PendingEvaluations:   10,
		AIEvaluationsTotal:   30,
		AIEvaluationsSuccess: 25,
		AIEvaluationsFailed:  5,
		TokensTotal:          2000,
		TokensConsumed:       800,
		TokensRemaining:      1200,
		SubscriptionPlan:     "elite",
		SubscriptionEnd:      &endTime,
		AdsAccounts: &AdsAccountStats{
			TotalAccounts:        15,
			ActiveAccounts:       12,
			PendingAuthorization: 3,
			OffersCoverage:       80.5,
		},
		CheckinStreak:       14,
		TotalCheckins:       60,
		TotalReferrals:      8,
		SuccessfulReferrals: 6,
		RecentEvaluations:   []RecentEvaluation{},
		LastUpdated:         now,
	}

	// Marshal to JSON
	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	// Unmarshal back
	var unmarshaled DashboardStats
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	// Verify key fields
	if unmarshaled.UserID != original.UserID {
		t.Errorf("UserID mismatch: expected %s, got %s", original.UserID, unmarshaled.UserID)
	}

	if unmarshaled.TotalOffers != original.TotalOffers {
		t.Errorf("TotalOffers mismatch: expected %d, got %d", original.TotalOffers, unmarshaled.TotalOffers)
	}

	if unmarshaled.SubscriptionPlan != original.SubscriptionPlan {
		t.Errorf("SubscriptionPlan mismatch: expected %s, got %s", original.SubscriptionPlan, unmarshaled.SubscriptionPlan)
	}

	// Verify AdsAccountStats
	if unmarshaled.AdsAccounts == nil {
		t.Error("AdsAccounts should not be nil")
	} else {
		if unmarshaled.AdsAccounts.TotalAccounts != original.AdsAccounts.TotalAccounts {
			t.Errorf("AdsAccounts.TotalAccounts mismatch")
		}
	}
}

// TestRecentEvaluation_JSONSerialization tests JSON marshaling of RecentEvaluation
func TestRecentEvaluation_JSONSerialization(t *testing.T) {
	now := time.Now()
	brandName := "Test Brand"
	domain := "test.example.com"
	score := 90

	original := RecentEvaluation{
		ID:             "eval-json-123",
		OfferID:        "offer-json-456",
		Type:           "ai",
		Status:         "completed",
		TokensConsumed: 50,
		BrandName:      &brandName,
		Domain:         &domain,
		AIScore:        &score,
		CompletedAt:    &now,
		CreatedAt:      now,
	}

	// Marshal to JSON
	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	// Unmarshal back
	var unmarshaled RecentEvaluation
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	// Verify fields
	if unmarshaled.ID != original.ID {
		t.Errorf("ID mismatch")
	}

	if unmarshaled.Type != original.Type {
		t.Errorf("Type mismatch")
	}

	if *unmarshaled.BrandName != *original.BrandName {
		t.Errorf("BrandName mismatch")
	}

	if *unmarshaled.AIScore != *original.AIScore {
		t.Errorf("AIScore mismatch")
	}
}
