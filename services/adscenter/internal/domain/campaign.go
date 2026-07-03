package domain

import (
	"time"
)

// Campaign represents an ad campaign in the adscenter.
type Campaign struct {
	ID               string    `json:"id"`
	UserID           string    `json:"userId"`
	OfferID          string    `json:"offerId"`
	GoogleAdsID      string    `json:"googleAdsId"`
	Status           string    `json:"status"` // "draft", "running", "paused", "archived"
	ABTestEnabled    bool      `json:"abTestEnabled"`
	ComplianceStatus string    `json:"complianceStatus"` // "pending", "approved", "rejected"
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// NewCampaign creates a new ad campaign with a "draft" status.
func NewCampaign(id, userID, offerID, googleAdsID string) *Campaign {
	now := time.Now()
	return &Campaign{
		ID:               id,
		UserID:           userID,
		OfferID:          offerID,
		GoogleAdsID:      googleAdsID,
		Status:           "draft",
		ABTestEnabled:    false,
		ComplianceStatus: "pending",
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}

// StartCampaign starts the ad campaign.
func (c *Campaign) StartCampaign() {
	c.Status = "running"
	c.UpdatedAt = time.Now()
}

// PauseCampaign pauses the ad campaign.
func (c *Campaign) PauseCampaign() {
	c.Status = "paused"
	c.UpdatedAt = time.Now()
}

// EnableABTest enables A/B testing for the campaign.
func (c *Campaign) EnableABTest() {
	c.ABTestEnabled = true
	c.UpdatedAt = time.Now()
}

// UpdateComplianceStatus updates the compliance status of the campaign.
func (c *Campaign) UpdateComplianceStatus(status string) {
	c.ComplianceStatus = status // "approved" or "rejected"
	c.UpdatedAt = time.Now()
}
