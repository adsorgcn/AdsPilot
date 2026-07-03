package domain

import (
	"time"
)

// SiterankAnalysis represents a Siterank analysis for a given offer.
type SiterankAnalysis struct {
	ID        string    `json:"id"`
	OfferID   string    `json:"offerId"`
	UserID    string    `json:"userId"`
	Status    string    `json:"status"` // "pending", "running", "completed", "failed"
	Score     *float64  `json:"score,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// NewSiterankAnalysis creates a new Siterank analysis with a "pending" status.
func NewSiterankAnalysis(id, offerID, userID string) *SiterankAnalysis {
	now := time.Now()
	return &SiterankAnalysis{
		ID:        id,
		OfferID:   offerID,
		UserID:    userID,
		Status:    "pending",
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// Start marks the analysis as "running".
func (a *SiterankAnalysis) Start() {
	a.Status = "running"
	a.UpdatedAt = time.Now()
}

// Complete marks the analysis as "completed" and sets the final score.
func (a *SiterankAnalysis) Complete(score float64) {
	a.Status = "completed"
	a.Score = &score
	a.UpdatedAt = time.Now()
}

// Fail marks the analysis as "failed".
func (a *SiterankAnalysis) Fail() {
	a.Status = "failed"
	a.UpdatedAt = time.Now()
}
