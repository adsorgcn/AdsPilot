package handlers

import (
	"bytes"
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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	_ "github.com/lib/pq"
)

// withUserContext adds a user ID to the request context
func withUserContext(r *http.Request, userID string) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
	return r.WithContext(ctx)
}

// TestGenerateReferralCode tests referral code generation
func TestGenerateReferralCode(t *testing.T) {
	h := &ReferralHandler{}

	// Generate multiple codes to test uniqueness
	codes := make(map[string]bool)
	for i := 0; i < 100; i++ {
		code := h.generateReferralCode()

		// Check length
		if len(code) != 8 {
			t.Errorf("Expected code length 8, got %d", len(code))
		}

		// Check for duplicates (though highly unlikely)
		if codes[code] {
			t.Errorf("Generated duplicate code: %s", code)
		}
		codes[code] = true

		// Check for ambiguous characters
		for _, char := range code {
			if char == 'O' || char == '0' || char == 'I' || char == '1' {
				t.Errorf("Code contains ambiguous character: %c in %s", char, code)
			}
		}
	}
}

// TestGenerateReferralCode_Format tests code format
func TestGenerateReferralCode_Format(t *testing.T) {
	h := &ReferralHandler{}

	code := h.generateReferralCode()

	// Should be uppercase alphanumeric
	for _, char := range code {
		if !((char >= 'A' && char <= 'Z') || (char >= '2' && char <= '9')) {
			t.Errorf("Code contains invalid character: %c", char)
		}
	}
}

// TestTrialSubscription_Struct tests TrialSubscription struct
func TestTrialSubscription_Struct(t *testing.T) {
	trial := TrialSubscription{
		ID:       "trial-123",
		UserID:   "user-456",
		PlanTier: "pro",
		IsActive: true,
		Source:   "self_register",
	}

	if trial.ID != "trial-123" {
		t.Errorf("Expected ID trial-123, got %s", trial.ID)
	}

	if trial.PlanTier != "pro" {
		t.Errorf("Expected PlanTier pro, got %s", trial.PlanTier)
	}
}

// TestReferralInfo_Struct tests ReferralInfo struct
func TestReferralInfo_Struct(t *testing.T) {
	info := ReferralInfo{
		ReferralCode:      "ABC12345",
		ReferralLink:      "https://gm.com/signup?ref=ABC12345",
		TotalInvites:      10,
		SuccessfulInvites: 7,
		TotalRewards:      140,
	}

	if info.ReferralCode != "ABC12345" {
		t.Errorf("Expected referral code ABC12345, got %s", info.ReferralCode)
	}

	if info.SuccessfulInvites > info.TotalInvites {
		t.Errorf("Successful invites (%d) should not exceed total invites (%d)",
			info.SuccessfulInvites, info.TotalInvites)
	}
}

// TestReferralHandler_GetReferral tests GetReferral handler
func TestReferralHandler_GetReferral(t *testing.T) {
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
	testUserID := fmt.Sprintf("test_user_referral_%d", time.Now().Unix())

	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM useractivity.referrals WHERE user_id = $1`, testUserID)
	}()

	handler := &ReferralHandler{db: db}

	req := httptest.NewRequest("GET", "/api/v1/referral", nil)
	req = withUserContext(req, testUserID)
	w := httptest.NewRecorder()

	handler.GetReferral(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response ReferralInfo
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	// Verify referral code is generated
	assert.NotEmpty(t, response.ReferralCode)
	assert.Len(t, response.ReferralCode, 8)
	assert.NotEmpty(t, response.ReferralLink)
	assert.Equal(t, 0, response.TotalInvites)
	assert.Equal(t, 0, response.SuccessfulInvites)
	assert.Equal(t, 0, response.TotalRewards)

	// Second call should return same code
	req2 := httptest.NewRequest("GET", "/api/v1/referral", nil)
	req2 = withUserContext(req2, testUserID)
	w2 := httptest.NewRecorder()

	handler.GetReferral(w2, req2)

	var response2 ReferralInfo
	err = json.NewDecoder(w2.Body).Decode(&response2)
	require.NoError(t, err)

	assert.Equal(t, response.ReferralCode, response2.ReferralCode)
}

// TestReferralHandler_CreateTrial_SelfRegister tests 7-day self-register trial creation
func TestReferralHandler_CreateTrial_SelfRegister(t *testing.T) {
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
	testUserID := fmt.Sprintf("test_user_self_trial_%d", time.Now().Unix())

	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM billing.trial_subscriptions WHERE user_id = $1`, testUserID)
	}()

	handler := &ReferralHandler{db: db}

	requestBody := map[string]interface{}{
		"userId": testUserID,
		"days":   7,
		"source": "self_register",
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/trial/create", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.CreateTrial(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var response map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	assert.Equal(t, "created", response["status"])
	assert.NotEmpty(t, response["trialId"])
	assert.NotEmpty(t, response["endDate"])

	// Verify trial in database
	var planTier, source string
	var isActive bool
	var startDate, endDate time.Time

	err = db.QueryRowContext(ctx, `
		SELECT plan_tier, start_date, end_date, is_active, source
		FROM billing.trial_subscriptions
		WHERE user_id = $1 AND source = 'self_register'
	`, testUserID).Scan(&planTier, &startDate, &endDate, &isActive, &source)
	require.NoError(t, err)

	assert.Equal(t, "pro", planTier)
	assert.True(t, isActive)
	assert.Equal(t, "self_register", source)

	// Verify trial duration is approximately 7 days
	duration := endDate.Sub(startDate)
	expected := 7 * 24 * time.Hour
	assert.InDelta(t, expected, duration, float64(time.Minute)) // Allow 1 minute margin
}

// TestReferralHandler_CreateTrial_DuplicatePrevention tests duplicate trial prevention
func TestReferralHandler_CreateTrial_DuplicatePrevention(t *testing.T) {
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
	testUserID := fmt.Sprintf("test_user_dup_trial_%d", time.Now().Unix())

	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM billing.trial_subscriptions WHERE user_id = $1`, testUserID)
	}()

	handler := &ReferralHandler{db: db}

	requestBody := map[string]interface{}{
		"userId": testUserID,
		"days":   7,
		"source": "self_register",
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	// First request - should succeed
	req1 := httptest.NewRequest("POST", "/api/v1/trial/create", bytes.NewReader(bodyBytes))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()

	handler.CreateTrial(w1, req1)
	assert.Equal(t, http.StatusCreated, w1.Code)

	// Second request - should be skipped
	bodyBytes2, _ := json.Marshal(requestBody)
	req2 := httptest.NewRequest("POST", "/api/v1/trial/create", bytes.NewReader(bodyBytes2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()

	handler.CreateTrial(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)

	var response map[string]interface{}
	err = json.NewDecoder(w2.Body).Decode(&response)
	require.NoError(t, err)

	assert.Equal(t, "skipped", response["status"])
	assert.Contains(t, response["message"], "already has active trial")
}

// TestReferralHandler_CreateTrial_InvalidDays tests validation for self-register trial days
func TestReferralHandler_CreateTrial_InvalidDays(t *testing.T) {
	handler := &ReferralHandler{db: nil}

	requestBody := map[string]interface{}{
		"userId": "test_user",
		"days":   14, // Invalid: self-register must be 7 days
		"source": "self_register",
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/trial/create", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.CreateTrial(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	errorData := response["error"].(map[string]interface{})
	assert.Equal(t, "INVALID_ARGUMENT", errorData["code"])
	assert.Contains(t, errorData["message"], "7 days")
}

// TestReferralHandler_TrackReferral tests referral tracking
func TestReferralHandler_TrackReferral(t *testing.T) {
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
	referrerID := fmt.Sprintf("test_referrer_%d", time.Now().Unix())
	inviteeID := fmt.Sprintf("test_invitee_%d", time.Now().Unix())

	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM useractivity.referral_records WHERE referred_user_id = $1`, inviteeID)
		_, _ = db.ExecContext(ctx, `DELETE FROM billing.trial_subscriptions WHERE user_id IN ($1, $2)`, referrerID, inviteeID)
		_, _ = db.ExecContext(ctx, `DELETE FROM useractivity.referrals WHERE user_id = $1`, referrerID)
	}()

	// Create referrer with referral code
	referralCode := "TEST1234"
	_, err = db.ExecContext(ctx, `
		INSERT INTO useractivity.referrals (id, user_id, referral_code, total_invites, successful_invites, total_rewards, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, 0, 0, 0, NOW(), NOW())
	`, referrerID, referralCode)
	require.NoError(t, err)

	handler := &ReferralHandler{db: db}

	requestBody := map[string]interface{}{
		"referralCode": referralCode,
		"newUserId":    inviteeID,
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/referral/track", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.TrackReferral(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Verify referral record created
	var recordID, status string
	err = db.QueryRowContext(ctx, `
		SELECT id, status FROM useractivity.referral_records WHERE referred_user_id = $1
	`, inviteeID).Scan(&recordID, &status)
	require.NoError(t, err)
	assert.Equal(t, "completed", status)

	// Verify referrer statistics updated
	var totalInvites, successfulInvites int
	err = db.QueryRowContext(ctx, `
		SELECT total_invites, successful_invites FROM useractivity.referrals WHERE user_id = $1
	`, referrerID).Scan(&totalInvites, &successfulInvites)
	require.NoError(t, err)
	assert.Equal(t, 1, totalInvites)
	assert.Equal(t, 1, successfulInvites)

	// Verify invitee trial created (14 days)
	var inviteeTrialSource string
	var inviteeDuration time.Duration
	var inviteeStartDate, inviteeEndDate time.Time
	err = db.QueryRowContext(ctx, `
		SELECT source, start_date, end_date
		FROM billing.trial_subscriptions
		WHERE user_id = $1 AND source = 'referral_invitee'
	`, inviteeID).Scan(&inviteeTrialSource, &inviteeStartDate, &inviteeEndDate)
	require.NoError(t, err)
	inviteeDuration = inviteeEndDate.Sub(inviteeStartDate)
	assert.Equal(t, "referral_invitee", inviteeTrialSource)
	assert.InDelta(t, 14*24*time.Hour, inviteeDuration, float64(time.Minute))

	// Verify inviter trial created (14 days)
	var inviterTrialSource string
	var inviterDuration time.Duration
	var inviterStartDate, inviterEndDate time.Time
	err = db.QueryRowContext(ctx, `
		SELECT source, start_date, end_date
		FROM billing.trial_subscriptions
		WHERE user_id = $1 AND source = 'referral_inviter'
	`, referrerID).Scan(&inviterTrialSource, &inviterStartDate, &inviterEndDate)
	require.NoError(t, err)
	inviterDuration = inviterEndDate.Sub(inviterStartDate)
	assert.Equal(t, "referral_inviter", inviterTrialSource)
	assert.InDelta(t, 14*24*time.Hour, inviterDuration, float64(time.Minute))
}

// TestReferralHandler_TrackReferral_InvalidCode tests invalid referral code
func TestReferralHandler_TrackReferral_InvalidCode(t *testing.T) {
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

	handler := &ReferralHandler{db: db}

	requestBody := map[string]interface{}{
		"referralCode": "INVALID123",
		"newUserId":    "test_user_invalid",
	}
	bodyBytes, err := json.Marshal(requestBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/referral/track", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.TrackReferral(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var response map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	errorData := response["error"].(map[string]interface{})
	assert.Equal(t, "INTERNAL", errorData["code"])
}

// TestReferralHandler_GetActiveTrial tests getting active trial
func TestReferralHandler_GetActiveTrial(t *testing.T) {
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
	testUserID := fmt.Sprintf("test_user_active_trial_%d", time.Now().Unix())

	defer func() {
		_, _ = db.ExecContext(ctx, `DELETE FROM billing.trial_subscriptions WHERE user_id = $1`, testUserID)
	}()

	// Create active trial
	_, err = db.ExecContext(ctx, `
		INSERT INTO billing.trial_subscriptions (id, user_id, plan_tier, start_date, end_date, is_active, source, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, 'pro', NOW(), NOW() + INTERVAL '7 days', true, 'self_register', NOW(), NOW())
	`, testUserID)
	require.NoError(t, err)

	handler := &ReferralHandler{db: db}

	req := httptest.NewRequest("GET", "/api/v1/trial/active", nil)
	req = withUserContext(req, testUserID)
	w := httptest.NewRecorder()

	handler.GetActiveTrial(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response TrialSubscription
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	assert.Equal(t, testUserID, response.UserID)
	assert.Equal(t, "pro", response.PlanTier)
	assert.True(t, response.IsActive)
	assert.Equal(t, "self_register", response.Source)
}

// TestReferralHandler_GetActiveTrial_None tests when user has no active trial
func TestReferralHandler_GetActiveTrial_None(t *testing.T) {
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

	handler := &ReferralHandler{db: db}

	testUserID := fmt.Sprintf("test_user_no_trial_%d", time.Now().Unix())

	req := httptest.NewRequest("GET", "/api/v1/trial/active", nil)
	req = withUserContext(req, testUserID)
	w := httptest.NewRecorder()

	handler.GetActiveTrial(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err = json.NewDecoder(w.Body).Decode(&response)
	require.NoError(t, err)

	active, ok := response["active"].(bool)
	require.True(t, ok)
	assert.False(t, active)
}
