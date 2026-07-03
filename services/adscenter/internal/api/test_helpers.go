package api

import (
	"context"
	"net/http"
	"testing"

	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
)

// withUserContext adds a user ID to the request context
func withUserContext(r *http.Request, userID string) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
	return r.WithContext(ctx)
}

// skipIfShort skips the test if running in short mode
func skipIfShort(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}
}
