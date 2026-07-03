package domain

import (
	"testing"
	"time"
)

func TestNewSiterankAnalysis(t *testing.T) {
	id := "analysis-123"
	offerID := "offer-456"
	userID := "user-789"

	analysis := NewSiterankAnalysis(id, offerID, userID)

	if analysis.ID != id {
		t.Errorf("Expected ID to be %s, but got %s", id, analysis.ID)
	}
	if analysis.OfferID != offerID {
		t.Errorf("Expected OfferID to be %s, but got %s", offerID, analysis.OfferID)
	}
	if analysis.UserID != userID {
		t.Errorf("Expected UserID to be %s, but got %s", userID, analysis.UserID)
	}
	if analysis.Status != "pending" {
		t.Errorf("Expected Status to be 'pending', but got %s", analysis.Status)
	}
	if time.Since(analysis.CreatedAt) > time.Second {
		t.Errorf("Expected CreatedAt to be recent")
	}
	if analysis.Score != nil {
		t.Errorf("Expected Score to be nil initially")
	}
}

func TestSiterankAnalysis_Start(t *testing.T) {
	analysis := NewSiterankAnalysis("id", "offer", "user")
	time.Sleep(10 * time.Millisecond) // Ensure UpdatedAt will change
	analysis.Start()

	if analysis.Status != "running" {
		t.Errorf("Expected Status to be 'running', but got %s", analysis.Status)
	}
	if !analysis.UpdatedAt.After(analysis.CreatedAt) {
		t.Errorf("Expected UpdatedAt to be after CreatedAt, but they are %s and %s", analysis.UpdatedAt, analysis.CreatedAt)
	}
}

func TestSiterankAnalysis_Complete(t *testing.T) {
	analysis := NewSiterankAnalysis("id", "offer", "user")
	score := 92.3
	time.Sleep(10 * time.Millisecond)
	analysis.Complete(score)

	if analysis.Status != "completed" {
		t.Errorf("Expected Status to be 'completed', but got %s", analysis.Status)
	}
	if analysis.Score == nil {
		t.Fatal("Expected Score to be updated, but it's nil")
	}
	if *analysis.Score != score {
		t.Errorf("Expected Score to be %f, but got %f", score, *analysis.Score)
	}
	if !analysis.UpdatedAt.After(analysis.CreatedAt) {
		t.Errorf("Expected UpdatedAt to be after CreatedAt")
	}
}

func TestSiterankAnalysis_Fail(t *testing.T) {
	analysis := NewSiterankAnalysis("id", "offer", "user")
	time.Sleep(10 * time.Millisecond)
	analysis.Fail()

	if analysis.Status != "failed" {
		t.Errorf("Expected Status to be 'failed', but got %s", analysis.Status)
	}
	if !analysis.UpdatedAt.After(analysis.CreatedAt) {
		t.Errorf("Expected UpdatedAt to be after CreatedAt")
	}
}
