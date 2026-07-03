package domain

import (
	"testing"
	"time"
)

func TestNewCampaign(t *testing.T) {
	id := "campaign-123"
	userID := "user-456"
	offerID := "offer-789"
	googleAdsID := "gads-123"

	campaign := NewCampaign(id, userID, offerID, googleAdsID)

	if campaign.ID != id {
		t.Errorf("Expected ID to be %s, but got %s", id, campaign.ID)
	}
	if campaign.UserID != userID {
		t.Errorf("Expected UserID to be %s, but got %s", userID, campaign.UserID)
	}
	if campaign.OfferID != offerID {
		t.Errorf("Expected OfferID to be %s, but got %s", offerID, campaign.OfferID)
	}
	if campaign.GoogleAdsID != googleAdsID {
		t.Errorf("Expected GoogleAdsID to be %s, but got %s", googleAdsID, campaign.GoogleAdsID)
	}
	if campaign.Status != "draft" {
		t.Errorf("Expected Status to be 'draft', but got %s", campaign.Status)
	}
	if campaign.ABTestEnabled {
		t.Errorf("Expected ABTestEnabled to be false initially")
	}
	if campaign.ComplianceStatus != "pending" {
		t.Errorf("Expected ComplianceStatus to be 'pending', but got %s", campaign.ComplianceStatus)
	}
	if time.Since(campaign.CreatedAt) > time.Second {
		t.Errorf("Expected CreatedAt to be recent")
	}
}

func TestCampaign_StartCampaign(t *testing.T) {
	campaign := NewCampaign("id", "user", "offer", "gads")
	time.Sleep(10 * time.Millisecond)
	campaign.StartCampaign()

	if campaign.Status != "running" {
		t.Errorf("Expected Status to be 'running', but got %s", campaign.Status)
	}
	if !campaign.UpdatedAt.After(campaign.CreatedAt) {
		t.Errorf("Expected UpdatedAt to be after CreatedAt")
	}
}

func TestCampaign_PauseCampaign(t *testing.T) {
	campaign := NewCampaign("id", "user", "offer", "gads")
	campaign.StartCampaign()
	time.Sleep(10 * time.Millisecond)
	campaign.PauseCampaign()

	if campaign.Status != "paused" {
		t.Errorf("Expected Status to be 'paused', but got %s", campaign.Status)
	}
	if !campaign.UpdatedAt.After(campaign.CreatedAt) {
		t.Errorf("Expected UpdatedAt to be after CreatedAt")
	}
}

func TestCampaign_EnableABTest(t *testing.T) {
	campaign := NewCampaign("id", "user", "offer", "gads")
	time.Sleep(10 * time.Millisecond)
	campaign.EnableABTest()

	if !campaign.ABTestEnabled {
		t.Errorf("Expected ABTestEnabled to be true")
	}
	if !campaign.UpdatedAt.After(campaign.CreatedAt) {
		t.Errorf("Expected UpdatedAt to be after CreatedAt")
	}
}

func TestCampaign_UpdateComplianceStatus(t *testing.T) {
	campaign := NewCampaign("id", "user", "offer", "gads")
	status := "approved"
	time.Sleep(10 * time.Millisecond)
	campaign.UpdateComplianceStatus(status)

	if campaign.ComplianceStatus != status {
		t.Errorf("Expected ComplianceStatus to be '%s', but got '%s'", status, campaign.ComplianceStatus)
	}
	if !campaign.UpdatedAt.After(campaign.CreatedAt) {
		t.Errorf("Expected UpdatedAt to be after CreatedAt")
	}
}
