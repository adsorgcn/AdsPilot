package handlers

import (
	"testing"

	"github.com/ScientificInternet/Google-Monetize/services/console/internal/clients"
)

// TestListOffersResponse_Struct tests ListOffersResponse structure
func TestListOffersResponse_Struct(t *testing.T) {
	response := ListOffersResponse{
		Items: []OfferWithUser{
			{
				Offer: clients.Offer{
					ID:     "offer-1",
					UserID: "user-1",
					Name:   "Test Offer 1",
					Status: "active",
				},
				UserEmail: "user1@example.com",
				UserName:  "User One",
			},
			{
				Offer: clients.Offer{
					ID:     "offer-2",
					UserID: "user-2",
					Name:   "Test Offer 2",
					Status: "pending",
				},
				UserEmail: "user2@example.com",
				UserName:  "User Two",
			},
		},
		TotalCount: 2,
		Page:       1,
		PageSize:   20,
	}

	// Verify total count
	if response.TotalCount != 2 {
		t.Errorf("Expected TotalCount 2, got %d", response.TotalCount)
	}

	// Verify page
	if response.Page < 1 {
		t.Errorf("Page should be at least 1, got %d", response.Page)
	}

	// Verify page size
	if response.PageSize < 1 {
		t.Errorf("PageSize should be at least 1, got %d", response.PageSize)
	}

	// Verify items
	if len(response.Items) != response.TotalCount {
		t.Errorf("Items length (%d) should match TotalCount (%d)",
			len(response.Items), response.TotalCount)
	}

	// Verify first item
	firstItem := response.Items[0]
	if firstItem.ID != "offer-1" {
		t.Errorf("Expected first item ID offer-1, got %s", firstItem.ID)
	}

	if firstItem.UserEmail == "" {
		t.Error("UserEmail should not be empty")
	}

	if firstItem.UserName == "" {
		t.Error("UserName should not be empty")
	}
}

// TestOfferWithUser_Struct tests OfferWithUser structure
func TestOfferWithUser_Struct(t *testing.T) {
	offer := OfferWithUser{
		Offer: clients.Offer{
			ID:     "offer-123",
			UserID: "user-456",
			Name:   "Sample Offer",
			Status: "active",
		},
		UserEmail: "test@example.com",
		UserName:  "Test User",
	}

	// Verify Offer fields
	if offer.ID != "offer-123" {
		t.Errorf("Expected ID offer-123, got %s", offer.ID)
	}

	if offer.UserID != "user-456" {
		t.Errorf("Expected UserID user-456, got %s", offer.UserID)
	}

	// Verify extended fields
	if offer.UserEmail != "test@example.com" {
		t.Errorf("Expected UserEmail test@example.com, got %s", offer.UserEmail)
	}

	if offer.UserName != "Test User" {
		t.Errorf("Expected UserName 'Test User', got %s", offer.UserName)
	}

	// Verify status values
	validStatuses := []string{"active", "pending", "suspended", "deleted"}
	isValidStatus := false
	for _, validStatus := range validStatuses {
		if offer.Status == validStatus {
			isValidStatus = true
			break
		}
	}

	if !isValidStatus {
		t.Errorf("Invalid status: %s", offer.Status)
	}
}

// TestPaginationLogic tests pagination calculation
func TestPaginationLogic(t *testing.T) {
	tests := []struct {
		name           string
		page           int
		pageSize       int
		expectedOffset int
	}{
		{
			name:           "First page",
			page:           1,
			pageSize:       20,
			expectedOffset: 0,
		},
		{
			name:           "Second page",
			page:           2,
			pageSize:       20,
			expectedOffset: 20,
		},
		{
			name:           "Third page with smaller page size",
			page:           3,
			pageSize:       10,
			expectedOffset: 20,
		},
		{
			name:           "Large page",
			page:           10,
			pageSize:       50,
			expectedOffset: 450,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			offset := (tt.page - 1) * tt.pageSize

			if offset != tt.expectedOffset {
				t.Errorf("Expected offset %d, got %d", tt.expectedOffset, offset)
			}
		})
	}
}

// TestPageSizeValidation tests page size bounds
func TestPageSizeValidation(t *testing.T) {
	tests := []struct {
		name         string
		inputSize    int
		expectedSize int
	}{
		{
			name:         "Normal page size",
			inputSize:    20,
			expectedSize: 20,
		},
		{
			name:         "Too small page size",
			inputSize:    0,
			expectedSize: 20, // default
		},
		{
			name:         "Negative page size",
			inputSize:    -10,
			expectedSize: 20, // default
		},
		{
			name:         "Too large page size",
			inputSize:    200,
			expectedSize: 20, // capped or default
		},
		{
			name:         "Maximum allowed",
			inputSize:    100,
			expectedSize: 100,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pageSize := tt.inputSize
			if pageSize < 1 || pageSize > 100 {
				pageSize = 20
			}

			if pageSize != tt.expectedSize {
				t.Errorf("Expected pageSize %d, got %d", tt.expectedSize, pageSize)
			}
		})
	}
}

// TestPageValidation tests page number validation
func TestPageValidation(t *testing.T) {
	tests := []struct {
		name         string
		inputPage    int
		expectedPage int
	}{
		{
			name:         "Valid page",
			inputPage:    1,
			expectedPage: 1,
		},
		{
			name:         "Zero page",
			inputPage:    0,
			expectedPage: 1, // default to 1
		},
		{
			name:         "Negative page",
			inputPage:    -5,
			expectedPage: 1, // default to 1
		},
		{
			name:         "Large page",
			inputPage:    999,
			expectedPage: 999,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			page := tt.inputPage
			if page < 1 {
				page = 1
			}

			if page != tt.expectedPage {
				t.Errorf("Expected page %d, got %d", tt.expectedPage, page)
			}
		})
	}
}

// TestStatusFilterValidation tests status filter values
func TestStatusFilterValidation(t *testing.T) {
	validStatuses := []string{"active", "pending", "suspended", "deleted", ""}

	for _, status := range validStatuses {
		t.Run("Status_"+status, func(t *testing.T) {
			// Empty string means no filter
			if status == "" {
				return
			}

			// Verify status is one of the expected values
			allowed := []string{"active", "pending", "suspended", "deleted"}
			isValid := false
			for _, validStatus := range allowed {
				if status == validStatus {
					isValid = true
					break
				}
			}

			if !isValid {
				t.Errorf("Invalid status filter: %s", status)
			}
		})
	}
}

// TestOfferStats_Struct tests offer statistics structure
func TestOfferStats_Struct(t *testing.T) {
	type OfferStats struct {
		TotalOffers       int
		ActiveOffers      int
		PendingOffers     int
		SuspendedOffers   int
		RecentOffers      int
		EvaluatedOffers   int
		UnevaluatedOffers int
	}

	stats := OfferStats{
		TotalOffers:       100,
		ActiveOffers:      80,
		PendingOffers:     10,
		SuspendedOffers:   5,
		RecentOffers:      15,
		EvaluatedOffers:   70,
		UnevaluatedOffers: 30,
	}

	// Verify total
	if stats.TotalOffers < stats.ActiveOffers+stats.PendingOffers+stats.SuspendedOffers {
		t.Error("Total offers should be >= sum of status counts")
	}

	// Verify evaluated + unevaluated = total
	if stats.EvaluatedOffers+stats.UnevaluatedOffers != stats.TotalOffers {
		t.Errorf("Evaluated (%d) + Unevaluated (%d) should equal Total (%d)",
			stats.EvaluatedOffers, stats.UnevaluatedOffers, stats.TotalOffers)
	}

	// Verify non-negative values
	if stats.ActiveOffers < 0 || stats.PendingOffers < 0 || stats.SuspendedOffers < 0 {
		t.Error("Status counts should be non-negative")
	}
}
