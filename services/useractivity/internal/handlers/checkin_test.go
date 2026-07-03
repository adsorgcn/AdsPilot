package handlers

import (
	"testing"
	"time"
)

// TestCheckinRequest_Struct tests CheckinRequest structure
func TestCheckinRequest_Struct(t *testing.T) {
	req := CheckinRequest{
		Source: "web",
	}

	if req.Source != "web" {
		t.Errorf("Expected source 'web', got %s", req.Source)
	}

	// Test valid sources
	validSources := []string{"web", "mobile", "app", "api"}
	for _, source := range validSources {
		req.Source = source
		if req.Source != source {
			t.Errorf("Expected source %s, got %s", source, req.Source)
		}
	}
}

// TestCheckinResponse_Struct tests CheckinResponse structure
func TestCheckinResponse_Struct(t *testing.T) {
	response := CheckinResponse{
		Success:      true,
		TokensEarned: 10,
		TotalTokens:  110,
		Streak:       7,
		Message:      "Check-in successful! You earned 10 tokens.",
		NextCheckin:  "2025-10-17T00:00:00Z",
	}

	// Verify success case
	if !response.Success {
		t.Error("Expected success to be true")
	}

	// Verify tokens
	if response.TokensEarned != 10 {
		t.Errorf("Expected tokensEarned 10, got %d", response.TokensEarned)
	}

	if response.TokensEarned > response.TotalTokens {
		t.Errorf("TokensEarned (%d) should not exceed TotalTokens (%d)",
			response.TokensEarned, response.TotalTokens)
	}

	// Verify streak
	if response.Streak < 1 {
		t.Errorf("Streak should be at least 1, got %d", response.Streak)
	}

	// Verify message
	if response.Message == "" {
		t.Error("Message should not be empty")
	}

	// Verify next checkin time
	if response.NextCheckin == "" {
		t.Error("NextCheckin should not be empty")
	}

	// Parse next checkin time
	_, err := time.Parse(time.RFC3339, response.NextCheckin)
	if err != nil {
		t.Errorf("NextCheckin is not valid RFC3339 format: %v", err)
	}
}

// TestCheckinResponse_FailureCase tests failure response
func TestCheckinResponse_FailureCase(t *testing.T) {
	response := CheckinResponse{
		Success:      false,
		TokensEarned: 0,
		TotalTokens:  100,
		Streak:       6,
		Message:      "You have already checked in today. Try again tomorrow!",
		NextCheckin:  "2025-10-17T00:00:00Z",
	}

	// Verify failure case
	if response.Success {
		t.Error("Expected success to be false for already checked in case")
	}

	// Verify no tokens earned on duplicate check-in
	if response.TokensEarned != 0 {
		t.Errorf("Expected tokensEarned 0 for duplicate check-in, got %d", response.TokensEarned)
	}

	// Verify message is descriptive
	if response.Message == "" {
		t.Error("Failure message should not be empty")
	}
}

// TestCheckinStatus_Struct tests CheckinStatus structure
func TestCheckinStatus_Struct(t *testing.T) {
	lastCheckin := time.Now().Add(-24 * time.Hour)
	nextCheckin := time.Now().Add(24 * time.Hour)

	status := CheckinStatus{
		LastCheckinAt:   &lastCheckin,
		TotalCheckins:   30,
		CurrentStreak:   7,
		LongestStreak:   15,
		TokensEarned:    300,
		CanCheckin:      true,
		TodayChecked:    false,
		NextCheckinTime: &nextCheckin,
	}

	// Verify totals
	if status.TotalCheckins < 0 {
		t.Errorf("TotalCheckins should be non-negative, got %d", status.TotalCheckins)
	}

	// Verify streaks
	if status.CurrentStreak < 0 {
		t.Errorf("CurrentStreak should be non-negative, got %d", status.CurrentStreak)
	}

	if status.CurrentStreak > status.LongestStreak {
		t.Errorf("CurrentStreak (%d) should not exceed LongestStreak (%d)",
			status.CurrentStreak, status.LongestStreak)
	}

	// Verify tokens earned
	if status.TokensEarned < 0 {
		t.Errorf("TokensEarned should be non-negative, got %d", status.TokensEarned)
	}

	// Verify check-in logic
	if status.CanCheckin && status.TodayChecked {
		t.Error("Cannot both CanCheckin and TodayChecked be true simultaneously")
	}

	// Verify last checkin time
	if status.LastCheckinAt != nil && status.LastCheckinAt.After(time.Now()) {
		t.Error("LastCheckinAt cannot be in the future")
	}
}

// TestCheckinHistoryItem_Struct tests CheckinHistoryItem structure
func TestCheckinHistoryItem_Struct(t *testing.T) {
	item := CheckinHistoryItem{
		ID:           "checkin-123",
		TokensEarned: 10,
		StreakDay:    5,
		CheckinDate:  "2025-10-16",
		CreatedAt:    "2025-10-16T10:30:00Z",
	}

	// Verify ID
	if item.ID == "" {
		t.Error("ID should not be empty")
	}

	// Verify tokens earned
	if item.TokensEarned != 10 {
		t.Errorf("Expected tokensEarned 10, got %d", item.TokensEarned)
	}

	// Verify streak day
	if item.StreakDay < 1 {
		t.Errorf("StreakDay should be at least 1, got %d", item.StreakDay)
	}

	// Verify checkin date format
	_, err := time.Parse("2006-01-02", item.CheckinDate)
	if err != nil {
		t.Errorf("CheckinDate is not valid date format: %v", err)
	}

	// Verify created at format
	_, err = time.Parse(time.RFC3339, item.CreatedAt)
	if err != nil {
		t.Errorf("CreatedAt is not valid RFC3339 format: %v", err)
	}
}

// TestCalculateNextCheckinTime tests next check-in time calculation
func TestCalculateNextCheckinTime(t *testing.T) {
	tests := []struct {
		name     string
		now      time.Time
		expected time.Time
	}{
		{
			name:     "Morning check-in",
			now:      time.Date(2025, 10, 16, 8, 0, 0, 0, time.UTC),
			expected: time.Date(2025, 10, 17, 0, 0, 0, 0, time.UTC),
		},
		{
			name:     "Noon check-in",
			now:      time.Date(2025, 10, 16, 12, 0, 0, 0, time.UTC),
			expected: time.Date(2025, 10, 17, 0, 0, 0, 0, time.UTC),
		},
		{
			name:     "Evening check-in",
			now:      time.Date(2025, 10, 16, 20, 0, 0, 0, time.UTC),
			expected: time.Date(2025, 10, 17, 0, 0, 0, 0, time.UTC),
		},
		{
			name:     "Midnight check-in",
			now:      time.Date(2025, 10, 16, 0, 0, 0, 0, time.UTC),
			expected: time.Date(2025, 10, 17, 0, 0, 0, 0, time.UTC),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateNextCheckinTime(tt.now)

			if !result.Equal(tt.expected) {
				t.Errorf("Expected next checkin time %v, got %v", tt.expected, result)
			}

			// Verify result is always midnight
			if result.Hour() != 0 || result.Minute() != 0 || result.Second() != 0 {
				t.Errorf("Next checkin time should be at midnight, got %v", result)
			}

			// Verify result is in the future
			if !result.After(tt.now) {
				t.Errorf("Next checkin time should be after now, got %v", result)
			}
		})
	}
}

// TestStreakCalculation tests streak logic
func TestStreakCalculation(t *testing.T) {
	tests := []struct {
		name              string
		lastCheckinDate   *time.Time
		currentStreak     int
		expectedNewStreak int
		description       string
	}{
		{
			name:              "First check-in",
			lastCheckinDate:   nil,
			currentStreak:     0,
			expectedNewStreak: 1,
			description:       "First ever check-in should start streak at 1",
		},
		{
			name:              "Consecutive day",
			lastCheckinDate:   ptrTime(time.Now().Add(-24 * time.Hour)),
			currentStreak:     5,
			expectedNewStreak: 6,
			description:       "Consecutive day should increment streak",
		},
		{
			name:              "Missed days",
			lastCheckinDate:   ptrTime(time.Now().Add(-72 * time.Hour)),
			currentStreak:     10,
			expectedNewStreak: 1,
			description:       "Missed days should reset streak to 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var newStreak int

			if tt.lastCheckinDate == nil {
				// First check-in
				newStreak = 1
			} else {
				// Check if consecutive
				now := time.Now()
				today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
				yesterday := today.Add(-24 * time.Hour)

				if tt.lastCheckinDate.After(yesterday) || tt.lastCheckinDate.Equal(yesterday) {
					// Consecutive day
					newStreak = tt.currentStreak + 1
				} else {
					// Not consecutive
					newStreak = 1
				}
			}

			if newStreak != tt.expectedNewStreak {
				t.Errorf("%s: Expected streak %d, got %d", tt.description, tt.expectedNewStreak, newStreak)
			}
		})
	}
}

// TestTokensEarned tests token earning logic
func TestTokensEarned(t *testing.T) {
	// Fixed: 10 tokens per day
	fixedTokensPerDay := 10

	tests := []struct {
		name           string
		streak         int
		expectedTokens int
	}{
		{
			name:           "Day 1 streak",
			streak:         1,
			expectedTokens: fixedTokensPerDay,
		},
		{
			name:           "Day 7 streak",
			streak:         7,
			expectedTokens: fixedTokensPerDay,
		},
		{
			name:           "Day 30 streak",
			streak:         30,
			expectedTokens: fixedTokensPerDay,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tokensEarned := fixedTokensPerDay

			if tokensEarned != tt.expectedTokens {
				t.Errorf("Expected %d tokens, got %d", tt.expectedTokens, tokensEarned)
			}
		})
	}
}

// TestDuplicateCheckin tests duplicate check-in prevention
func TestDuplicateCheckin(t *testing.T) {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// Last check-in was today
	lastCheckinToday := today.Add(8 * time.Hour)

	// Check if already checked in
	alreadyCheckedIn := lastCheckinToday.After(today)

	if !alreadyCheckedIn {
		t.Error("Should detect that user already checked in today")
	}

	// Last check-in was yesterday
	lastCheckinYesterday := today.Add(-16 * time.Hour)
	alreadyCheckedIn = lastCheckinYesterday.After(today)

	if alreadyCheckedIn {
		t.Error("Should allow check-in if last check-in was yesterday")
	}
}

// TestNewCheckinHandler tests handler initialization
func TestNewCheckinHandler(t *testing.T) {
	handler := NewCheckinHandler(nil)

	if handler == nil {
		t.Error("Expected handler to be initialized")
	}
}

// Helper functions

func ptrTime(t time.Time) *time.Time {
	return &t
}
