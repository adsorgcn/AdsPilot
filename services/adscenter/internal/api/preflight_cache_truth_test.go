package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	adscfg "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
)

func TestLocalPreflightDoesNotReusePreviousAuthorizationSnapshot(t *testing.T) {
	setupLocalAdsCredential(t)
	t.Setenv("ADS_PRECHECK_ENABLE_LIVE", "false")
	// Local mode must not attempt a shared Firestore write, even if legacy
	// environment configuration happens to enable it.
	t.Setenv("FIRESTORE_ENABLED", "1")
	handler := NewPreflightHandler(nil, nil)
	handler.pc["truthful-v1:local:2222222222:vo=1"] = preflightCache{
		val: PreflightResponse{Summary: "stale-authorization", Mode: "live_reads", GoogleValidated: true},
		exp: time.Now().Add(time.Hour),
	}
	run := func() string {
		t.Helper()
		req := withUserContext(httptest.NewRequest(http.MethodPost, "/preflight", strings.NewReader(`{"accountId":"2222222222","validateOnly":true}`)), "local")
		response := httptest.NewRecorder()
		handler.HandlePreflight(response, req)
		if response.Code != http.StatusOK {
			t.Fatalf("preflight failed: %s", response.Body.String())
		}
		return response.Body.String()
	}
	before := run()
	if strings.Contains(before, "stale-authorization") || !strings.Contains(before, "missing GOOGLE_ADS_DEVELOPER_TOKEN") {
		t.Fatal("preflight reused stale authorization cache")
	}
	t.Setenv("GOOGLE_ADS_DEVELOPER_TOKEN", "test-only-developer-token")
	adscfg.InvalidateAdsCredsCache(context.Background())
	after := run()
	if strings.Contains(after, "missing GOOGLE_ADS_DEVELOPER_TOKEN") {
		t.Fatal("preflight cached an obsolete credential/configuration observation")
	}
	if handler.pc["truthful-v1:local:2222222222:vo=1"].val.Summary != "stale-authorization" {
		t.Fatal("local preflight still writes historical cache")
	}
}
