// github.com/ScientificInternet/Google-Monetize/services/siterank/internal/events/config.go
package events

import "os"

// GetProjectID tries multiple environment variables to get the GCP project ID.
// It checks GOOGLE_CLOUD_PROJECT first (standard Cloud Run variable),
// then falls back to GCP_PROJECT_ID (custom variable).
func GetProjectID() string {
	// Try standard Cloud Run variable first
	if id := os.Getenv("GOOGLE_CLOUD_PROJECT"); id != "" {
		return id
	}
	// Fallback to custom variable
	if id := os.Getenv("GCP_PROJECT_ID"); id != "" {
		return id
	}
	return ""
}
