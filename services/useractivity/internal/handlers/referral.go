package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/errors"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/google/uuid"
)

// ReferralHandler handles referral related requests
type ReferralHandler struct {
	db *sql.DB
}

// NewReferralHandler creates a new referral handler
func NewReferralHandler(db *sql.DB) *ReferralHandler {
	h := &ReferralHandler{
		db: db,
	}

	// Start background worker for trial expiration check
	go h.startTrialExpirationWorker()

	return h
}

// ReferralInfo represents user's referral information
type ReferralInfo struct {
	ReferralCode      string `json:"referralCode"`
	ReferralLink      string `json:"referralLink"`
	TotalInvites      int    `json:"totalInvites"`
	SuccessfulInvites int    `json:"successfulInvites"`
	TotalRewards      int    `json:"totalRewards"`
}

// ReferralItem represents a single referral record
type ReferralItem struct {
	ID           string `json:"id"`
	ReferredUser string `json:"referredUser"`
	Status       string `json:"status"`
	RewardTokens int    `json:"rewardTokens"`
	CreatedAt    string `json:"createdAt"`
}

// TrialSubscription represents a trial subscription
type TrialSubscription struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	PlanTier  string    `json:"planTier"`
	StartDate time.Time `json:"startDate"`
	EndDate   time.Time `json:"endDate"`
	IsActive  bool      `json:"isActive"`
	Source    string    `json:"source"` // "self_register", "referral_inviter", "referral_invitee"
	CreatedAt time.Time `json:"createdAt"`
}

// GetReferral handles GET /api/v1/referral
func (h *ReferralHandler) GetReferral(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context
	userID, ok := ctx.Value(middleware.UserIDKey).(string)
	if !ok {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Missing user ID", nil)
		return
	}

	// Get or create referral code
	info, err := h.getReferralInfo(ctx, userID)
	if err != nil {
		log.Printf("Error getting referral info for user %s: %v", userID, err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to get referral info", map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(info)
}

// GetReferralList handles GET /api/v1/referral/list
func (h *ReferralHandler) GetReferralList(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context
	userID, ok := ctx.Value(middleware.UserIDKey).(string)
	if !ok {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Missing user ID", nil)
		return
	}

	// Get referral list
	list, err := h.getReferralList(ctx, userID)
	if err != nil {
		log.Printf("Error getting referral list for user %s: %v", userID, err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to get referral list", map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{"items": list})
}

// TrackReferral handles POST /api/v1/referral/track (internal)
func (h *ReferralHandler) TrackReferral(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		ReferralCode string `json:"referralCode"`
		NewUserID    string `json:"newUserId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Invalid request body", nil)
		return
	}

	if req.ReferralCode == "" || req.NewUserID == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Missing required fields", nil)
		return
	}

	// Track referral
	if err := h.trackReferral(ctx, req.ReferralCode, req.NewUserID); err != nil {
		log.Printf("Error tracking referral: %v", err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to track referral", map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
}

// CreateTrial handles POST /api/v1/trial/create (internal - for self-register)
// DEPRECATED: This endpoint is deprecated. Use billing service API instead.
func (h *ReferralHandler) CreateTrial(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		UserID string `json:"userId"`
		Days   int    `json:"days"`
		Source string `json:"source"` // "self_register"
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Invalid request body", nil)
		return
	}

	if req.UserID == "" || req.Days <= 0 || req.Source == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Missing required fields", nil)
		return
	}

	// Validate days (only allow 7 for self-register)
	if req.Source == "self_register" && req.Days != 7 {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "Self-register trial must be 7 days", nil)
		return
	}

	// Call billing service to create trial
	if err := h.createTrialViaBillingService(ctx, req.UserID, req.Days, req.Source); err != nil {
		log.Printf("Error creating trial for user %s via billing service: %v", req.UserID, err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to create trial", map[string]string{"error": err.Error()})
		return
	}

	log.Printf("Trial created successfully via billing service: user=%s, days=%d, source=%s", req.UserID, req.Days, req.Source)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Deprecated", "true")
	w.Header().Set("X-Deprecation-Message", "Use billing service API: POST /api/v1/billing/subscriptions/trial")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"status":  "created",
		"message": "Trial created via billing service",
	})
}

// GetActiveTrial handles GET /api/v1/trial/active
func (h *ReferralHandler) GetActiveTrial(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context
	userID, ok := ctx.Value(middleware.UserIDKey).(string)
	if !ok {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Missing user ID", nil)
		return
	}

	// Get active trial
	trial, err := h.getActiveTrial(ctx, userID)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Error getting active trial for user %s: %v", userID, err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to get active trial", map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if trial != nil {
		json.NewEncoder(w).Encode(trial)
	} else {
		json.NewEncoder(w).Encode(map[string]any{"active": false})
	}
}

// getReferralInfo retrieves or creates user's referral information
func (h *ReferralHandler) getReferralInfo(ctx context.Context, userID string) (*ReferralInfo, error) {
	var referralCode string
	var totalInvites, successfulInvites, totalRewards int

	// Try to get existing referral code
	err := h.db.QueryRowContext(ctx, `
		SELECT referral_code, total_invites, successful_invites, total_rewards
		FROM useractivity.referrals
		WHERE user_id = $1
	`, userID).Scan(&referralCode, &totalInvites, &successfulInvites, &totalRewards)

	if err == sql.ErrNoRows {
		// Generate new referral code
		referralCode = h.generateReferralCode()

		// Insert new referral record
		_, err = h.db.ExecContext(ctx, `
			INSERT INTO useractivity.referrals (id, user_id, referral_code, total_invites, successful_invites, total_rewards, created_at, updated_at)
			VALUES ($1, $2, $3, 0, 0, 0, NOW(), NOW())
		`, uuid.New().String(), userID, referralCode)

		if err != nil {
			return nil, fmt.Errorf("failed to create referral record: %w", err)
		}

		totalInvites = 0
		successfulInvites = 0
		totalRewards = 0
	} else if err != nil {
		return nil, fmt.Errorf("failed to query referral info: %w", err)
	}

	// Generate referral link
	baseURL := "https://gm.com" // TODO: Get from config
	referralLink := fmt.Sprintf("%s/signup?ref=%s", baseURL, referralCode)

	return &ReferralInfo{
		ReferralCode:      referralCode,
		ReferralLink:      referralLink,
		TotalInvites:      totalInvites,
		SuccessfulInvites: successfulInvites,
		TotalRewards:      totalRewards,
	}, nil
}

// getReferralList retrieves user's referral list
func (h *ReferralHandler) getReferralList(ctx context.Context, userID string) ([]ReferralItem, error) {
	rows, err := h.db.QueryContext(ctx, `
		SELECT id, referred_user_id, status, reward_tokens, created_at
		FROM useractivity.referral_records
		WHERE referrer_id = $1
		ORDER BY created_at DESC
		LIMIT 100
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query referral list: %w", err)
	}
	defer rows.Close()

	var list []ReferralItem
	for rows.Next() {
		var item ReferralItem
		var createdAt sql.NullTime

		if err := rows.Scan(&item.ID, &item.ReferredUser, &item.Status, &item.RewardTokens, &createdAt); err != nil {
			continue
		}

		if createdAt.Valid {
			item.CreatedAt = createdAt.Time.Format(time.RFC3339)
		}

		list = append(list, item)
	}

	return list, nil
}

// trackReferral tracks a new referral
func (h *ReferralHandler) trackReferral(ctx context.Context, referralCode, newUserID string) error {
	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Find referrer by referral code
	var referrerID string
	err = tx.QueryRowContext(ctx, `
		SELECT user_id
		FROM useractivity.referrals
		WHERE referral_code = $1
	`, referralCode).Scan(&referrerID)

	if err == sql.ErrNoRows {
		return fmt.Errorf("invalid referral code")
	} else if err != nil {
		return fmt.Errorf("failed to find referrer: %w", err)
	}

	// Check if user already has a referral record
	var existingID string
	err = tx.QueryRowContext(ctx, `
		SELECT id FROM useractivity.referral_records WHERE referred_user_id = $1
	`, newUserID).Scan(&existingID)

	if err == nil {
		// User already referred by someone
		return fmt.Errorf("user already referred")
	} else if err != sql.ErrNoRows {
		return fmt.Errorf("failed to check existing referral: %w", err)
	}

	// Create referral record
	recordID := uuid.New().String()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO useractivity.referral_records (id, referrer_id, referred_user_id, status, reward_tokens, created_at, updated_at)
		VALUES ($1, $2, $3, 'pending', 0, NOW(), NOW())
	`, recordID, referrerID, newUserID)

	if err != nil {
		return fmt.Errorf("failed to create referral record: %w", err)
	}

	// Update referral statistics
	_, err = tx.ExecContext(ctx, `
		UPDATE useractivity.referrals
		SET total_invites = total_invites + 1, updated_at = NOW()
		WHERE user_id = $1
	`, referrerID)

	if err != nil {
		return fmt.Errorf("failed to update referral stats: %w", err)
	}

	// Commit transaction first
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Call billing service to create trial subscriptions for both inviter and invitee
	// This is now done via HTTP API calls instead of direct database manipulation

	// Create trial for invitee (14 days)
	if err := h.createTrialViaBillingService(ctx, newUserID, 14, "referral_invitee"); err != nil {
		log.Printf("Warning: Failed to create invitee trial via billing service: %v", err)
		// Don't fail the entire operation, just log the error
	}

	// Create trial for inviter (14 days)
	if err := h.createTrialViaBillingService(ctx, referrerID, 14, "referral_inviter"); err != nil {
		log.Printf("Warning: Failed to create inviter trial via billing service: %v", err)
		// Don't fail the entire operation, just log the error
	}

	// Update referral record status to completed
	_, err = h.db.ExecContext(ctx, `
		UPDATE useractivity.referral_records
		SET status = 'completed', reward_tokens = 0, updated_at = NOW()
		WHERE id = $1
	`, recordID)

	if err != nil {
		log.Printf("Warning: Failed to update referral record status: %v", err)
	}

	// Update successful invites count
	_, err = h.db.ExecContext(ctx, `
		UPDATE useractivity.referrals
		SET successful_invites = successful_invites + 1, updated_at = NOW()
		WHERE user_id = $1
	`, referrerID)

	if err != nil {
		log.Printf("Warning: Failed to update successful invites count: %v", err)
	}

	log.Printf("Referral tracked successfully: referrer=%s, invitee=%s", referrerID, newUserID)

	return nil
}

// createTrialViaBillingService calls billing service API to create a trial subscription
func (h *ReferralHandler) createTrialViaBillingService(ctx context.Context, userID string, days int, source string) error {
	// Get billing service URL from environment
	billingURL := getEnvOrDefault("BILLING_SERVICE_URL", "http://billing:8080")

	// Create HTTP client
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Prepare request body
	reqBody := map[string]interface{}{
		"userId": userID,
		"days":   days,
		"source": source,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	url := billingURL + "/api/v1/billing/subscriptions/trial"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call billing service: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, _ := io.ReadAll(resp.Body)

	// Check response status
	if resp.StatusCode >= 400 {
		// Check if it's a conflict error (SUB_001 or SUB_002)
		if resp.StatusCode == http.StatusConflict {
			// Parse error response to differentiate SUB_001 vs SUB_002
			var errorResp map[string]interface{}
			if err := json.Unmarshal(respBody, &errorResp); err == nil {
				if code, ok := errorResp["code"].(string); ok {
					switch code {
					case "SUB_001":
						log.Printf("User %s already has trial subscription (SUB_001), skipping", userID)
						return nil // Not an error for self-register, just skip
					case "SUB_002":
						log.Printf("User %s already received invitee reward (SUB_002), skipping", userID)
						return nil // Not an error, invitee can only get reward once
					default:
						log.Printf("User %s trial creation conflict (%s), skipping: %s", userID, code, string(respBody))
						return nil // Other conflicts, skip gracefully
					}
				}
			}
			// If we can't parse the error, still skip gracefully
			log.Printf("User %s trial creation conflict, skipping: %s", userID, string(respBody))
			return nil
		}
		return fmt.Errorf("billing service returned error %d: %s", resp.StatusCode, string(respBody))
	}

	log.Printf("Successfully created/extended trial via billing service: userID=%s, days=%d, source=%s", userID, days, source)
	return nil
}

// getEnvOrDefault gets environment variable or returns default value
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getActiveTrial retrieves user's active trial subscription
func (h *ReferralHandler) getActiveTrial(ctx context.Context, userID string) (*TrialSubscription, error) {
	var trial TrialSubscription

	err := h.db.QueryRowContext(ctx, `
		SELECT id, user_id, plan_tier, start_date, end_date, is_active, source, created_at
		FROM billing.trial_subscriptions
		WHERE user_id = $1 AND is_active = true AND end_date > NOW()
		ORDER BY end_date DESC
		LIMIT 1
	`, userID).Scan(
		&trial.ID,
		&trial.UserID,
		&trial.PlanTier,
		&trial.StartDate,
		&trial.EndDate,
		&trial.IsActive,
		&trial.Source,
		&trial.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, fmt.Errorf("failed to query active trial: %w", err)
	}

	return &trial, nil
}

// generateReferralCode generates a random referral code
func (h *ReferralHandler) generateReferralCode() string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Exclude ambiguous characters
	const length = 8

	code := make([]byte, length)
	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		code[i] = charset[n.Int64()]
	}

	return string(code)
}

// CreateSelfRegisterTrial creates a 7-day trial for self-registered users
func (h *ReferralHandler) CreateSelfRegisterTrial(ctx context.Context, userID string) error {
	trialID := uuid.New().String()
	startDate := time.Now()
	endDate := startDate.Add(7 * 24 * time.Hour)

	_, err := h.db.ExecContext(ctx, `
		INSERT INTO billing.trial_subscriptions (id, user_id, plan_tier, start_date, end_date, is_active, source, created_at, updated_at)
		VALUES ($1, $2, 'pro', $3, $4, true, 'self_register', NOW(), NOW())
	`, trialID, userID, startDate, endDate)

	if err != nil {
		return fmt.Errorf("failed to create self-register trial: %w", err)
	}

	log.Printf("Self-register trial created for user %s", userID)
	return nil
}

// ExpireTrials expires expired trial subscriptions (for cron job)
func (h *ReferralHandler) ExpireTrials(ctx context.Context) error {
	result, err := h.db.ExecContext(ctx, `
		UPDATE billing.trial_subscriptions
		SET is_active = false, updated_at = NOW()
		WHERE is_active = true AND end_date <= NOW()
	`)

	if err != nil {
		return fmt.Errorf("failed to expire trials: %w", err)
	}

	affected, _ := result.RowsAffected()
	if affected > 0 {
		log.Printf("Expired %d trial subscriptions", affected)
	}

	return nil
}
