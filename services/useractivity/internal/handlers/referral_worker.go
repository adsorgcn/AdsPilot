package handlers

import (
	"context"
	"log"
)

// startTrialExpirationWorker marks this function as deprecated
// Note: Trial subscription functionality has been migrated to billing service
func (h *ReferralHandler) startTrialExpirationWorker() {
	log.Printf("Trial expiration worker is deprecated - trial subscriptions are now managed by billing service")
}

// expireTrials marks expired trials as inactive and downgrades users to Starter plan
// Deprecated: Trial subscription functionality has been migrated to billing service
func (h *ReferralHandler) expireTrials(ctx context.Context) error {
	log.Println("Trial expiration functionality has been migrated to billing service")
	return nil
}
