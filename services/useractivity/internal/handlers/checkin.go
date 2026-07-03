package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/errors"
	"github.com/ScientificInternet/Google-Monetize/pkg/events"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"github.com/google/uuid"
)

// Global service registry (set by main.go)
var globalServiceRegistry *serviceclient.Registry

// Global event publisher (set by main.go)
var globalEventPublisher *events.Publisher

// SetGlobalRegistry sets the global service registry for this package
func SetGlobalRegistry(registry *serviceclient.Registry) {
	globalServiceRegistry = registry
}

// SetGlobalEventPublisher sets the global event publisher for this package
func SetGlobalEventPublisher(pub *events.Publisher) {
	globalEventPublisher = pub
}

// CheckinHandler handles check-in related requests
type CheckinHandler struct {
	db *sql.DB
}

// NewCheckinHandler creates a new check-in handler
func NewCheckinHandler(db *sql.DB) *CheckinHandler {
	return &CheckinHandler{
		db: db,
	}
}

// CheckinRequest represents a check-in request
type CheckinRequest struct {
	Source string `json:"source,omitempty"` // "web", "mobile", etc.
}

// CheckinResponse represents the response after check-in
type CheckinResponse struct {
	Success      bool   `json:"success"`
	TokensEarned int    `json:"tokensEarned"`
	TotalTokens  int    `json:"totalTokens"`
	Streak       int    `json:"streak"`
	Message      string `json:"message"`
	NextCheckin  string `json:"nextCheckin"`
}

// CheckinStatus represents user's current check-in status
type CheckinStatus struct {
	LastCheckinAt   *time.Time `json:"lastCheckinAt,omitempty"`
	TotalCheckins   int        `json:"totalCheckins"`
	CurrentStreak   int        `json:"currentStreak"`
	LongestStreak   int        `json:"longestStreak"`
	TokensEarned    int        `json:"tokensEarned"`
	CanCheckin      bool       `json:"canCheckin"`
	TodayChecked    bool       `json:"todayChecked"`
	NextCheckinTime *time.Time `json:"nextCheckinTime,omitempty"`

	// Frontend compatibility fields
	HasCheckedInToday bool `json:"hasCheckedInToday"`
}

// CheckinHistoryItem represents a single check-in history entry
type CheckinHistoryItem struct {
	ID           string `json:"id"`
	TokensEarned int    `json:"tokensEarned"`
	StreakDay    int    `json:"streakDay"`
	CheckinDate  string `json:"checkinDate"`
	CreatedAt    string `json:"createdAt"`
}

// Checkin handles POST /api/v1/check-in
func (h *CheckinHandler) Checkin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context (set by auth middleware)
	userID, ok := ctx.Value(middleware.UserIDKey).(string)
	if !ok {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Missing user ID", nil)
		return
	}

	log.Printf("Processing check-in for user: %s", userID)

	var req CheckinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Empty body is OK, just set default source
		req.Source = "web"
	}

	// Extract auth token from request to forward to billing service
	authToken := r.Header.Get("Authorization")

	// Process check-in
	response, err := h.processCheckinWithAuth(ctx, userID, req.Source, authToken)
	if err != nil {
		log.Printf("Error processing check-in for user %s: %v", userID, err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to process check-in", map[string]string{"error": err.Error()})
		return
	}

	// Send notification about successful check-in
	if response.Success {
		h.sendCheckinNotification(ctx, userID, response)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// GetCheckinStatus handles GET /api/v1/check-in/status
func (h *CheckinHandler) GetCheckinStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context (set by auth middleware)
	userID, ok := ctx.Value(middleware.UserIDKey).(string)
	if !ok {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Missing user ID", nil)
		return
	}

	// Get check-in status
	status, err := h.getCheckinStatus(ctx, userID)
	if err != nil {
		log.Printf("Error getting check-in status for user %s: %v", userID, err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to get check-in status", map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(status)
}

// GetCheckinHistory handles GET /api/v1/check-in/history
func (h *CheckinHandler) GetCheckinHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context (set by auth middleware)
	userID, ok := ctx.Value(middleware.UserIDKey).(string)
	if !ok {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Missing user ID", nil)
		return
	}

	// Parse query parameters
	limit := 30
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}

	// Get check-in history
	history, err := h.getCheckinHistory(ctx, userID, limit)
	if err != nil {
		log.Printf("Error getting check-in history for user %s: %v", userID, err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Failed to get check-in history", map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{"items": history})
}

// processCheckinWithAuth processes a user check-in with auth token for billing service
func (h *CheckinHandler) processCheckinWithAuth(ctx context.Context, userID, source, authToken string) (*CheckinResponse, error) {
	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get current check-in status
	var lastCheckinAt sql.NullTime
	var totalCheckins, currentStreak, longestStreak, tokensEarned int

	err = tx.QueryRowContext(ctx, `
		SELECT
			last_checkin_at,
			total_checkins,
			current_streak,
			longest_streak,
			tokens_earned
		FROM useractivity.checkins
		WHERE user_id = $1
		FOR UPDATE
	`, userID).Scan(&lastCheckinAt, &totalCheckins, &currentStreak, &longestStreak, &tokensEarned)

	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to query check-in status: %w", err)
	}

	// Parse last check-in date
	var lastCheckinDate time.Time
	if lastCheckinAt.Valid {
		lastCheckinDate = lastCheckinAt.Time
	}

	// Check if user already checked in today (based on local timezone)
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	if lastCheckinAt.Valid && lastCheckinDate.After(today) {
		// User already checked in today
		response := &CheckinResponse{
			Success:      false,
			TokensEarned: 0,
			TotalTokens:  tokensEarned,
			Streak:       currentStreak,
			Message:      "You have already checked in today. Try again tomorrow!",
			NextCheckin:  calculateNextCheckinTime(now).Format(time.RFC3339),
		}
		return response, nil
	}

	// Calculate streak
	var newStreak int
	if lastCheckinAt.Valid {
		// Check if last check-in was yesterday (consecutive day)
		yesterday := today.Add(-24 * time.Hour)
		if lastCheckinDate.After(yesterday) || lastCheckinDate.Equal(yesterday) {
			// Consecutive day, increment streak
			newStreak = currentStreak + 1
		} else {
			// Not consecutive, reset streak
			newStreak = 1
		}
	} else {
		// First check-in
		newStreak = 1
	}

	// Calculate tokens earned
	// Fixed: 10 tokens per day
	tokensEarnedToday := 10

	// Update or insert check-in record
	checkinID := uuid.New().String()
	if err != nil && err != sql.ErrNoRows {
		// Update existing record
		_, err = tx.ExecContext(ctx, `
			UPDATE useractivity.checkins
			SET
				last_checkin_at = NOW(),
				total_checkins = $1,
				current_streak = $2,
				longest_streak = $3,
				tokens_earned = $4,
				updated_at = NOW()
			WHERE user_id = $5
		`, totalCheckins+1, newStreak,
			func() int {
				if newStreak > longestStreak {
					return newStreak
				}
				return longestStreak
			}(),
			tokensEarned+tokensEarnedToday, userID)
	} else {
		// Insert new record
		_, err = tx.ExecContext(ctx, `
			INSERT INTO useractivity.checkins (
				id, user_id, last_checkin_at, total_checkins,
				current_streak, longest_streak, tokens_earned,
				created_at, updated_at
			) VALUES ($1, $2, NOW(), 1, $3, $3, $4, NOW(), NOW())
		`, checkinID, userID, newStreak, tokensEarnedToday)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to update check-in record: %w", err)
	}

	// Insert check-in statistics record
	checkinDate := now.Format("2006-01-02")
	checkinStatsID := uuid.New().String()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO useractivity.user_checkin_stats (
			id, user_id, checkin_date, tokens_earned, streak_day, created_at
		) VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (user_id, checkin_date) DO UPDATE SET
			tokens_earned = $4,
			streak_day = $5
	`, checkinStatsID, userID, checkinDate, tokensEarnedToday, newStreak)

	if err != nil {
		return nil, fmt.Errorf("failed to insert check-in statistics: %w", err)
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Publish CheckinCompleted event (async, non-blocking)
	// This replaces the synchronous billing service call for better performance
	if err := h.publishCheckinCompletedEvent(ctx, userID, tokensEarnedToday, newStreak, checkinDate, checkinStatsID); err != nil {
		log.Printf("Warning: Failed to publish CheckinCompleted event for user %s: %v", userID, err)
		// Don't fail the check-in if event publishing fails
		// Fall back to synchronous call if needed
		if shouldUseSyncFallback() {
			if err := h.creditTokensViaBilling(ctx, userID, tokensEarnedToday, newStreak, checkinDate, authToken); err != nil {
				log.Printf("Warning: Fallback billing call also failed for user %s: %v", userID, err)
			}
		}
	}

	// Create response
	response := &CheckinResponse{
		Success:      true,
		TokensEarned: tokensEarnedToday,
		TotalTokens:  tokensEarned + tokensEarnedToday,
		Streak:       newStreak,
		Message:      fmt.Sprintf("Check-in successful! You earned %d tokens.", tokensEarnedToday),
		NextCheckin:  calculateNextCheckinTime(now).Format(time.RFC3339),
	}

	// Log check-in event
	log.Printf("User %s checked in successfully: streak=%d, tokens=%d", userID, newStreak, tokensEarnedToday)

	return response, nil
}

// getCheckinStatus retrieves user's current check-in status
func (h *CheckinHandler) getCheckinStatus(ctx context.Context, userID string) (*CheckinStatus, error) {
	var status CheckinStatus
	var lastCheckinAt sql.NullTime

	err := h.db.QueryRowContext(ctx, `
		SELECT
			last_checkin_at,
			total_checkins,
			current_streak,
			longest_streak,
			tokens_earned
		FROM useractivity.checkins
		WHERE user_id = $1
	`, userID).Scan(&lastCheckinAt, &status.TotalCheckins, &status.CurrentStreak,
		&status.LongestStreak, &status.TokensEarned)

	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to query check-in status: %w", err)
	}

	if lastCheckinAt.Valid {
		status.LastCheckinAt = &lastCheckinAt.Time
	}

	// Determine if user can check in today
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	status.CanCheckin = !lastCheckinAt.Valid || lastCheckinAt.Time.Before(today)
	status.TodayChecked = lastCheckinAt.Valid && lastCheckinAt.Time.After(today)

	// Frontend compatibility: map TodayChecked -> HasCheckedInToday
	status.HasCheckedInToday = status.TodayChecked

	if status.CanCheckin {
		nextTime := now
		status.NextCheckinTime = &nextTime
	} else {
		nextTime := calculateNextCheckinTime(now)
		status.NextCheckinTime = &nextTime
	}

	return &status, nil
}

// getCheckinHistory retrieves user's check-in history
func (h *CheckinHandler) getCheckinHistory(ctx context.Context, userID string, limit int) ([]CheckinHistoryItem, error) {
	rows, err := h.db.QueryContext(ctx, `
		SELECT
			id,
			tokens_earned,
			streak_day,
			checkin_date,
			created_at
		FROM useractivity.user_checkin_stats
		WHERE user_id = $1
		ORDER BY checkin_date DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query check-in history: %w", err)
	}
	defer rows.Close()

	var history []CheckinHistoryItem
	for rows.Next() {
		var item CheckinHistoryItem
		var createdAt sql.NullTime

		if err := rows.Scan(&item.ID, &item.TokensEarned, &item.StreakDay, &item.CheckinDate, &createdAt); err != nil {
			continue
		}

		if createdAt.Valid {
			item.CreatedAt = createdAt.Time.Format(time.RFC3339)
		}

		history = append(history, item)
	}

	return history, nil
}

// sendCheckinNotification sends a notification about successful check-in
func (h *CheckinHandler) sendCheckinNotification(ctx context.Context, userID string, response *CheckinResponse) {
	// Create notification message
	title := "Daily Check-in Completed!"
	messageData := map[string]any{
		"tokensEarned": response.TokensEarned,
		"streak":       response.Streak,
		"totalTokens":  response.TotalTokens,
	}

	messageBytes, _ := json.Marshal(messageData)
	_, err := h.db.ExecContext(ctx, `
		INSERT INTO useractivity.notifications (user_id, type, title, message, created_at)
		VALUES ($1, $2, $3, $4, NOW())
	`, userID, "CHECKIN_SUCCESS", title, string(messageBytes))

	if err != nil {
		log.Printf("Failed to insert check-in notification: %v", err)
	} else {
		log.Printf("Check-in notification sent to user %s: %s", userID, title)
	}
}

// calculateNextCheckinTime calculates the next available check-in time
func calculateNextCheckinTime(now time.Time) time.Time {
	// Reset to midnight (00:00:00) and add 24 hours
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return midnight.Add(24 * time.Hour)
}

// publishCheckinCompletedEvent publishes a CheckinCompleted event to Pub/Sub
func (h *CheckinHandler) publishCheckinCompletedEvent(ctx context.Context, userID string, tokenReward int, streak int, checkinDate string, checkinID string) error {
	// Check if Pub/Sub is enabled
	if os.Getenv("PUBSUB_ENABLED") != "true" {
		log.Printf("Pub/Sub disabled, skipping event publish for user %s", userID)
		return nil
	}

	event := map[string]interface{}{
		"eventId":    uuid.New().String(),
		"eventType":  "CheckinCompleted",
		"occurredAt": time.Now().Format(time.RFC3339),
		"userId":     userID,
		"data": map[string]interface{}{
			"checkinId":   checkinID,
			"userId":      userID,
			"checkinDate": checkinDate,
			"streak":      streak,
			"tokenReward": tokenReward,
			"isFirstTime": streak == 1,
		},
	}

	log.Printf("Publishing CheckinCompleted event: userID=%s, tokens=%d, streak=%d", userID, tokenReward, streak)

	// Publish event using global event publisher
	if globalEventPublisher != nil {
		err := globalEventPublisher.Publish(ctx, "user.checkin.completed", event)
		if err != nil {
			return fmt.Errorf("failed to publish CheckinCompleted event: %w", err)
		}
		log.Printf("Successfully published CheckinCompleted event for user %s", userID)
	} else {
		// Fallback: log the event that would be published
		eventJSON, _ := json.Marshal(event)
		log.Printf("Warning: Event publisher not initialized. Event payload: %s", string(eventJSON))
		return fmt.Errorf("event publisher not initialized")
	}

	return nil
}

// shouldUseSyncFallback checks if synchronous fallback should be used
func shouldUseSyncFallback() bool {
	// Check environment variable to enable/disable sync fallback
	// CHECKIN_TOKEN_MODE=async (default) - use events only
	// CHECKIN_TOKEN_MODE=sync - use synchronous calls
	// CHECKIN_TOKEN_MODE=hybrid - use events with sync fallback
	mode := getEnvOrDefault("CHECKIN_TOKEN_MODE", "async")
	return mode == "hybrid" || mode == "sync"
}

// creditTokensViaBilling calls billing service to credit tokens for check-in (fallback/legacy)
func (h *CheckinHandler) creditTokensViaBilling(ctx context.Context, userID string, amount int, streak int, checkinDate string, authToken string) error {
	if globalServiceRegistry == nil {
		return fmt.Errorf("service registry not initialized")
	}

	// Prepare request body
	reqBody := map[string]interface{}{
		"amount":      amount,
		"description": fmt.Sprintf("Daily check-in reward (streak: %d)", streak),
		"metadata": map[string]interface{}{
			"streak":       streak,
			"checkin_date": checkinDate,
			"source":       "useractivity",
		},
	}

	// Prepare headers - forward authorization token
	headers := map[string]string{}
	if authToken != "" {
		headers["Authorization"] = authToken
	}

	err := globalServiceRegistry.CallJSON(ctx, "billing", serviceclient.Request{
		Method:  http.MethodPost,
		Path:    "/api/v1/billing/tokens/credit/checkin",
		Body:    reqBody,
		Headers: headers,
	}, nil)

	if err != nil {
		return fmt.Errorf("failed to call billing service: %w", err)
	}

	log.Printf("Successfully credited %d tokens to user %s via billing service (sync fallback)", amount, userID)
	return nil
}
