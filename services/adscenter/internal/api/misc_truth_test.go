package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestAccessibleAccountsDoNotInventMetadata(t *testing.T) {
	account := accessibleAccountPayload("customers/2222222222")
	data, err := json.Marshal(account)
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatal(err)
	}
	if result["accountId"] != "2222222222" || result["status"] != "unknown" || result["metadataVerified"] != false || result["source"] != "google_ads_accessible_customers" {
		t.Fatalf("account access result lost its evidence boundary: %s", data)
	}
	for _, field := range []string{
		"accountName", "currencyCode", "timezone", "connectedAt", "createdAt", "updatedAt", "lastSyncedAt",
		"totalCost", "totalRevenue", "totalConversions", "roas", "linkedOffersCount", "activeCampaignsCount",
	} {
		if _, exists := result[field]; exists {
			t.Errorf("unfetched %s was fabricated: %s", field, data)
		}
	}
}

func TestAccountDefaultsPreserveUnknownAndObservedValues(t *testing.T) {
	unknown := accountPayload{ID: "2222222222", Source: "local_record"}
	unknown.applyDefaults()
	if unknown.Status != "unknown" || unknown.CurrencyCode != "" || unknown.Timezone != "" || unknown.ConnectedAt != "" || unknown.TotalCost != nil {
		t.Fatal("defaulting invented provider metadata or measurements")
	}
	zero := 0.0
	observed := accountPayload{ID: "2222222222", CurrencyCode: "EUR", Timezone: "Europe/Paris", TotalCost: &zero}
	observed.applyDefaults()
	data, err := json.Marshal(observed)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), `"totalCost":0`) || observed.CurrencyCode != "EUR" || observed.Timezone != "Europe/Paris" {
		t.Fatalf("observed zero or account settings were lost: %s", data)
	}
}

func TestUnimplementedAccountSyncDoesNotClaimProviderSync(t *testing.T) {
	handler := &MiscHandler{}
	for _, tc := range []struct {
		name string
		run  http.HandlerFunc
	}{
		{"single", handler.HandleSyncAccount}, {"all", handler.HandleSyncAllAccounts},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/adscenter/accounts/2222222222/sync", nil)
			req = withUserContext(req, "local")
			route := chi.NewRouteContext()
			route.URLParams.Add("id", "2222222222")
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, route))
			response := httptest.NewRecorder()
			tc.run(response, req)
			if response.Code != http.StatusNotImplemented {
				t.Fatalf("unimplemented sync returned %d: %s", response.Code, response.Body.String())
			}
			if strings.Contains(response.Body.String(), `"success":true`) || strings.Contains(response.Body.String(), `"synced_at"`) || strings.Contains(response.Body.String(), `"synced_count"`) {
				t.Fatalf("sync fabricated a provider result: %s", response.Body.String())
			}
			unauthorized := httptest.NewRecorder()
			tc.run(unauthorized, httptest.NewRequest(http.MethodPost, "/sync", nil))
			if unauthorized.Code != http.StatusUnauthorized {
				t.Fatal("unavailable sync stopped enforcing authentication")
			}
		})
	}
}
