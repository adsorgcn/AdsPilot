package api

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	adscfg "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/localcreds"
)

func setupLocalAdsCredential(t *testing.T) {
	t.Helper()
	t.Setenv("ADSPILOT_LOCAL", "1")
	t.Setenv("ADSPILOT_CREDENTIALS_PATH", filepath.Join(t.TempDir(), "credentials.json"))
	for _, key := range []string{
		"GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_OAUTH_CLIENT_ID",
		"GOOGLE_ADS_OAUTH_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN",
		"GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_TEST_CUSTOMER_ID",
	} {
		t.Setenv(key, "")
		t.Setenv(key+"_SECRET_NAME", "")
	}
	t.Setenv("GOOGLE_ADS_OAUTH_CLIENT_ID", "local-client")
	t.Setenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "1111111111")
	adscfg.InvalidateAdsCredsCache(context.Background())
	t.Cleanup(func() { adscfg.InvalidateAdsCredsCache(context.Background()) })
}

func TestLocalAdsCredentialsDoNotRequireLegacyDatabase(t *testing.T) {
	setupLocalAdsCredential(t)
	if err := localcreds.Save(localcreds.Credential{ClientID: "local-client", RefreshToken: "local-test-token"}); err != nil {
		t.Fatal(err)
	}
	creds, err := loadUserAdsCredentials(context.Background(), nil, "local")
	if err != nil {
		t.Fatalf("local OAuth credentials should work without a legacy database: %v", err)
	}
	if creds.RefreshToken != "local-test-token" || creds.LoginCustomerID != "1111111111" {
		t.Fatal("local request did not use the shared local credential source")
	}
	// Handler-specific changes must not mutate credentials used by another request.
	creds.LoginCustomerID = "2222222222"
	reloaded, err := loadUserAdsCredentials(context.Background(), nil, "local")
	if err != nil || reloaded.LoginCustomerID != "1111111111" {
		t.Fatal("handler changes leaked into the process credential cache")
	}
}

func TestLocalAdsCredentialsMissingTokenFailsClearly(t *testing.T) {
	setupLocalAdsCredential(t)
	_, err := loadUserAdsCredentials(context.Background(), nil, "local")
	if err == nil || !strings.Contains(err.Error(), "complete local Google Ads authorization") {
		t.Fatal("missing local OAuth token did not produce an actionable authorization error")
	}
}

func TestLegacyAdsCredentialsDoNotBorrowLocalToken(t *testing.T) {
	setupLocalAdsCredential(t)
	t.Setenv("ADSPILOT_LOCAL", "0")
	t.Setenv("GOOGLE_ADS_REFRESH_TOKEN", "process-token")
	_, err := loadUserAdsCredentials(context.Background(), nil, "another-user")
	if err == nil || !strings.Contains(err.Error(), "database not configured") {
		t.Fatal("legacy user credentials silently fell back to the process token")
	}
}

func TestRollbackCustomerIDComesFromSnapshots(t *testing.T) {
	tests := []struct {
		name      string
		resources []string
		want      string
	}{
		{"single target", []string{"customers/2222222222/campaigns/42"}, "2222222222"},
		{"same account resources", []string{"customers/2222222222/campaigns/42", "customers/2222222222/campaignBudgets/51"}, "2222222222"},
		{"missing", nil, ""},
		{"missing prefix", []string{"campaigns/42"}, ""},
		{"missing customer", []string{"customers//campaigns/42"}, ""},
		{"malformed customer", []string{"customers/abcdefghij/campaigns/42"}, ""},
		{"short customer", []string{"customers/123/campaigns/42"}, ""},
		{"missing resource ID", []string{"customers/2222222222/campaigns/"}, ""},
		{"mixed accounts", []string{"customers/2222222222/campaigns/42", "customers/3333333333/campaigns/51"}, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := rollbackCustomerID(tc.resources)
			if tc.want == "" {
				if err == nil {
					t.Fatal("invalid target did not fail closed")
				}
				return
			}
			if err != nil || got != tc.want {
				t.Fatalf("got target %q, error %v", got, err)
			}
		})
	}
}
