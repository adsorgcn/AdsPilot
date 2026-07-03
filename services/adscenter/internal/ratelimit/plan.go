package ratelimit

import (
	"net/http"
	"strings"
)

// ResolveUserPlan reads user's plan tier from Gateway-injected header.
// Gateway middleware already checked subscription and injected X-User-Tier header.
// Fallback: "Free" when header is missing.
func ResolveUserPlan(r *http.Request) string {
	// Read tier from Gateway-injected header (X-User-Tier contains tier like "starter", "professional", "elite")
	tier := strings.TrimSpace(r.Header.Get("X-User-Tier"))
	if tier == "" {
		// Fallback to "Free" if header not present
		// (should not happen if request came through Gateway)
		return "Free"
	}
	return tier
}
