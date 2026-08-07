package config

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/localcreds"
)

func TestLoadAdsCreds(t *testing.T) {
	// Set test environment variables
	os.Setenv("GOOGLE_ADS_DEVELOPER_TOKEN", "test-dev-token")
	os.Setenv("GOOGLE_ADS_OAUTH_CLIENT_ID", "test-client-id")
	os.Setenv("GOOGLE_ADS_OAUTH_CLIENT_SECRET", "test-client-secret")
	os.Setenv("GOOGLE_ADS_REFRESH_TOKEN", "test-refresh-token")
	os.Setenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "1234567890")
	os.Setenv("GOOGLE_ADS_TEST_CUSTOMER_ID", "0987654321")

	// Clear cache before test
	cachedCreds = &adsCredsCache{cache: cachedCreds.cache}

	ctx := context.Background()
	creds, err := LoadAdsCreds(ctx)
	if err != nil {
		t.Fatalf("LoadAdsCreds() error = %v", err)
	}

	if creds.DeveloperToken != "test-dev-token" {
		t.Errorf("DeveloperToken = %s, want test-dev-token", creds.DeveloperToken)
	}
	if creds.OAuthClientID != "test-client-id" {
		t.Errorf("OAuthClientID = %s, want test-client-id", creds.OAuthClientID)
	}
	if creds.OAuthClientSecret != "test-client-secret" {
		t.Errorf("OAuthClientSecret = %s, want test-client-secret", creds.OAuthClientSecret)
	}
	if creds.RefreshToken != "test-refresh-token" {
		t.Errorf("RefreshToken = %s, want test-refresh-token", creds.RefreshToken)
	}
	if creds.LoginCustomerID != "1234567890" {
		t.Errorf("LoginCustomerID = %s, want 1234567890", creds.LoginCustomerID)
	}
	if creds.TestCustomerID != "0987654321" {
		t.Errorf("TestCustomerID = %s, want 0987654321", creds.TestCustomerID)
	}
}

func TestLoadAdsCredsLocalcredsFallback(t *testing.T) {
	// No refresh token via env or Secret Manager: the token stored by the
	// local OAuth flow (localcreds) must be picked up.
	t.Setenv("GOOGLE_ADS_DEVELOPER_TOKEN", "dev-token")
	t.Setenv("GOOGLE_ADS_OAUTH_CLIENT_ID", "client-a")
	t.Setenv("GOOGLE_ADS_OAUTH_CLIENT_SECRET", "client-secret")
	t.Setenv("GOOGLE_ADS_REFRESH_TOKEN", "")
	t.Setenv("GOOGLE_ADS_REFRESH_TOKEN_SECRET_NAME", "")

	credPath := filepath.Join(t.TempDir(), "credentials.json")
	t.Setenv("ADSPILOT_CREDENTIALS_PATH", credPath)
	writeCred := func(clientID string) {
		t.Helper()
		if err := localcreds.Save(localcreds.Credential{
			RefreshToken: "localcreds-refresh-token",
			ClientID:     clientID,
			ObtainedAt:   time.Now(),
		}); err != nil {
			t.Fatalf("localcreds.Save() error = %v", err)
		}
	}

	orig := cachedCreds
	t.Cleanup(func() { cachedCreds = orig })
	ctx := context.Background()

	// Token minted by the configured client: used.
	writeCred("client-a")
	cachedCreds = &adsCredsCache{cache: nil}
	creds, err := LoadAdsCreds(ctx)
	if err != nil {
		t.Fatalf("LoadAdsCreds() error = %v", err)
	}
	if creds.RefreshToken != "localcreds-refresh-token" {
		t.Errorf("RefreshToken = %q, want localcreds-refresh-token", creds.RefreshToken)
	}

	// Token minted by a different client: ignored (refresh would fail with
	// invalid_grant).
	writeCred("client-b")
	cachedCreds = &adsCredsCache{cache: nil}
	creds, err = LoadAdsCreds(ctx)
	if err != nil {
		t.Fatalf("LoadAdsCreds() error = %v", err)
	}
	if creds.RefreshToken != "" {
		t.Errorf("RefreshToken = %q, want empty on client mismatch", creds.RefreshToken)
	}

	// An explicit env token always wins over localcreds.
	writeCred("client-a")
	t.Setenv("GOOGLE_ADS_REFRESH_TOKEN", "env-refresh-token")
	cachedCreds = &adsCredsCache{cache: nil}
	creds, err = LoadAdsCreds(ctx)
	if err != nil {
		t.Fatalf("LoadAdsCreds() error = %v", err)
	}
	if creds.RefreshToken != "env-refresh-token" {
		t.Errorf("RefreshToken = %q, want env-refresh-token", creds.RefreshToken)
	}
}

func TestInvalidateAdsCredsCache(t *testing.T) {
	orig := cachedCreds
	t.Cleanup(func() { cachedCreds = orig })

	cachedCreds = &adsCredsCache{cache: pcache.NewFromEnv()}
	cachedCreds.put(&AdsCreds{DeveloperToken: "cached"})
	if cachedCreds.get() == nil {
		t.Fatal("expected cached creds before invalidation")
	}
	InvalidateAdsCredsCache(context.Background())
	if got := cachedCreds.get(); got != nil {
		t.Errorf("cache should be empty after invalidation, got %+v", got)
	}

	// Must not panic when the cache is nil.
	cachedCreds = &adsCredsCache{cache: nil}
	InvalidateAdsCredsCache(context.Background())
}

func TestAdsCredsCache(t *testing.T) {
	cache := &adsCredsCache{cache: cachedCreds.cache}

	testCreds := &AdsCreds{
		DeveloperToken:    "test-token",
		OAuthClientID:     "test-id",
		OAuthClientSecret: "test-secret",
		RefreshToken:      "test-refresh",
		LoginCustomerID:   "1111111111",
		TestCustomerID:    "2222222222",
	}

	// Test put and get
	cache.put(testCreds)
	retrieved := cache.get()

	if retrieved == nil {
		t.Fatal("cache.get() returned nil")
	}

	if retrieved.DeveloperToken != testCreds.DeveloperToken {
		t.Errorf("DeveloperToken = %s, want %s", retrieved.DeveloperToken, testCreds.DeveloperToken)
	}
	if retrieved.OAuthClientID != testCreds.OAuthClientID {
		t.Errorf("OAuthClientID = %s, want %s", retrieved.OAuthClientID, testCreds.OAuthClientID)
	}
	if retrieved.RefreshToken != testCreds.RefreshToken {
		t.Errorf("RefreshToken = %s, want %s", retrieved.RefreshToken, testCreds.RefreshToken)
	}
}

func TestAdsCredsCacheTTL(t *testing.T) {
	// Set short TTL for testing
	os.Setenv("ADS_CREDS_CACHE_TTL_MS", "50")
	defer os.Unsetenv("ADS_CREDS_CACHE_TTL_MS")

	cache := &adsCredsCache{cache: cachedCreds.cache}
	ttl := cache.ttl()

	if ttl != 50*time.Millisecond {
		t.Errorf("ttl() = %v, want 50ms", ttl)
	}
}

func TestAdsCredsCacheNilHandling(t *testing.T) {
	cache := &adsCredsCache{cache: nil}

	// Should not panic with nil cache
	cache.put(&AdsCreds{DeveloperToken: "test"})
	retrieved := cache.get()

	if retrieved != nil {
		t.Errorf("cache.get() with nil cache should return nil, got %v", retrieved)
	}
}

func TestLoadPrecheckFlags(t *testing.T) {
	// Test default values
	os.Unsetenv("ADS_PRECHECK_ENABLE_LIVE")
	os.Unsetenv("ADS_PRECHECK_ENABLE_ACCESSIBLE_CUSTOMERS")
	os.Unsetenv("ADS_PRECHECK_ENABLE_VALIDATE_ONLY")
	os.Unsetenv("ADS_PRECHECK_TIMEOUT_MS")
	os.Unsetenv("ADS_PRECHECK_TOTAL_TIMEOUT_MS")

	flags := LoadPrecheckFlags()
	if flags.EnableLive != false {
		t.Errorf("EnableLive default should be false, got %v", flags.EnableLive)
	}
	if flags.PerCheckTimeoutMS != 1500 {
		t.Errorf("PerCheckTimeoutMS default should be 1500, got %d", flags.PerCheckTimeoutMS)
	}
	if flags.TotalTimeoutMS != 2500 {
		t.Errorf("TotalTimeoutMS default should be 2500, got %d", flags.TotalTimeoutMS)
	}

	// Test custom values
	os.Setenv("ADS_PRECHECK_ENABLE_LIVE", "true")
	os.Setenv("ADS_PRECHECK_ENABLE_ACCESSIBLE_CUSTOMERS", "1")
	os.Setenv("ADS_PRECHECK_ENABLE_VALIDATE_ONLY", "yes")
	os.Setenv("ADS_PRECHECK_TIMEOUT_MS", "2000")
	os.Setenv("ADS_PRECHECK_TOTAL_TIMEOUT_MS", "5000")

	flags = LoadPrecheckFlags()
	if flags.EnableLive != true {
		t.Errorf("EnableLive should be true, got %v", flags.EnableLive)
	}
	if flags.EnableAccessibleCustomers != true {
		t.Errorf("EnableAccessibleCustomers should be true, got %v", flags.EnableAccessibleCustomers)
	}
	if flags.EnableValidateOnly != true {
		t.Errorf("EnableValidateOnly should be true, got %v", flags.EnableValidateOnly)
	}
	if flags.PerCheckTimeoutMS != 2000 {
		t.Errorf("PerCheckTimeoutMS should be 2000, got %d", flags.PerCheckTimeoutMS)
	}
	if flags.TotalTimeoutMS != 5000 {
		t.Errorf("TotalTimeoutMS should be 5000, got %d", flags.TotalTimeoutMS)
	}
}
