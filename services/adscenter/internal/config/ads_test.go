package config

import (
	"context"
	"errors"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/localcreds"
)

func isolateCredentials(t *testing.T) {
	t.Helper()
	for _, key := range []string{
		"GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_OAUTH_CLIENT_ID",
		"GOOGLE_ADS_OAUTH_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN",
		"GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_TEST_CUSTOMER_ID",
	} {
		t.Setenv(key, "")
		t.Setenv(key+"_SECRET_NAME", "")
	}
	t.Setenv("ADS_CREDS_CACHE_TTL_MS", "")
	t.Setenv("ADSPILOT_CREDENTIALS_PATH", filepath.Join(t.TempDir(), "credentials.json"))
	InvalidateAdsCredsCache(context.Background())
	t.Cleanup(func() { InvalidateAdsCredsCache(context.Background()) })
}

func TestLoadAdsCreds(t *testing.T) {
	isolateCredentials(t)
	t.Setenv("GOOGLE_ADS_DEVELOPER_TOKEN", "test-dev-token")
	t.Setenv("GOOGLE_ADS_OAUTH_CLIENT_ID", "test-client-id")
	t.Setenv("GOOGLE_ADS_OAUTH_CLIENT_SECRET", "test-client-secret")
	t.Setenv("GOOGLE_ADS_REFRESH_TOKEN", "test-refresh-token")
	t.Setenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "1234567890")
	t.Setenv("GOOGLE_ADS_TEST_CUSTOMER_ID", "0987654321")
	creds, err := LoadAdsCreds(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := AdsCreds{
		DeveloperToken: "test-dev-token", OAuthClientID: "test-client-id",
		OAuthClientSecret: "test-client-secret", RefreshToken: "test-refresh-token",
		LoginCustomerID: "1234567890", TestCustomerID: "0987654321",
	}
	if *creds != want {
		t.Fatal("credential fields did not resolve from their respective environment variables")
	}
}

func TestLoadAdsCredsLocalcredsFallback(t *testing.T) {
	isolateCredentials(t)
	t.Setenv("GOOGLE_ADS_OAUTH_CLIENT_ID", "client-a")
	writeCred := func(clientID, token string) {
		t.Helper()
		if err := localcreds.Save(localcreds.Credential{RefreshToken: token, ClientID: clientID, ObtainedAt: time.Now()}); err != nil {
			t.Fatal(err)
		}
		InvalidateAdsCredsCache(context.Background())
	}
	checkToken := func(want string) {
		t.Helper()
		creds, err := LoadAdsCreds(context.Background())
		if err != nil || creds.RefreshToken != want {
			t.Fatal("resolved token did not match the expected source")
		}
	}
	writeCred("client-a", "local-token")
	checkToken("local-token")
	writeCred("client-b", "other-client-token")
	checkToken("")
	t.Setenv("GOOGLE_ADS_REFRESH_TOKEN", "env-token")
	writeCred("client-a", "local-token")
	checkToken("env-token")
}

func TestInvalidateAdsCredsCacheReloadsOAuthToken(t *testing.T) {
	isolateCredentials(t)
	t.Setenv("GOOGLE_ADS_OAUTH_CLIENT_ID", "client-a")
	ctx := context.Background()
	before, err := LoadAdsCreds(ctx)
	if err != nil || before.RefreshToken != "" {
		t.Fatal("expected no token before OAuth")
	}
	if err := localcreds.Save(localcreds.Credential{ClientID: "client-a", RefreshToken: "new-token"}); err != nil {
		t.Fatal(err)
	}
	InvalidateAdsCredsCache(ctx)
	after, err := LoadAdsCreds(ctx)
	if err != nil || after.RefreshToken != "new-token" {
		t.Fatal("OAuth invalidation did not reload the new token")
	}
	if err := localcreds.Delete(); err != nil {
		t.Fatal(err)
	}
	InvalidateAdsCredsCache(ctx)
	removed, err := LoadAdsCreds(ctx)
	if err != nil || removed.RefreshToken != "" {
		t.Fatal("OAuth disconnect left the token cached")
	}
}

func TestAdsCredsCacheOwnsCopiesAndExpires(t *testing.T) {
	cache := &adsCredsCache{}
	source := &AdsCreds{RefreshToken: "original", LoginCustomerID: "1234567890"}
	loads := 0
	resolve := func() (*AdsCreds, error) { loads++; return source, nil }
	first, _ := cache.load(resolve)
	first.RefreshToken = "caller-change"
	source.RefreshToken = "source-change"
	second, _ := cache.load(resolve)
	if second.RefreshToken != "original" || loads != 1 {
		t.Fatal("a caller or resolver mutated the cached secret")
	}
	cache.mu.Lock()
	cache.expiresAt = time.Now().Add(-time.Second)
	cache.mu.Unlock()
	third, _ := cache.load(resolve)
	if third.RefreshToken != "source-change" || loads != 2 {
		t.Fatal("expired credentials were not reloaded")
	}
	cache.invalidate()
	_, _ = cache.load(resolve)
	if loads != 3 {
		t.Fatal("invalidated credentials were not reloaded")
	}
}

func TestAdsCredsCacheConcurrentLoads(t *testing.T) {
	cache := &adsCredsCache{}
	var loads atomic.Int32
	var workers sync.WaitGroup
	for range 32 {
		workers.Add(1)
		go func() {
			defer workers.Done()
			creds, err := cache.load(func() (*AdsCreds, error) {
				loads.Add(1)
				return &AdsCreds{RefreshToken: "shared-secret"}, nil
			})
			if err != nil || creds.RefreshToken != "shared-secret" {
				t.Error("concurrent load failed")
			}
			creds.RefreshToken = "caller-owned"
		}()
	}
	workers.Wait()
	if loads.Load() != 1 {
		t.Fatal("concurrent callers performed duplicate credential resolution")
	}
}

func TestAdsCredsCacheInvalidationWaitsForInflightLoad(t *testing.T) {
	cache := &adsCredsCache{}
	entered, release, loaded := make(chan struct{}), make(chan struct{}), make(chan struct{})
	go func() {
		defer close(loaded)
		_, _ = cache.load(func() (*AdsCreds, error) {
			close(entered)
			<-release
			return &AdsCreds{RefreshToken: "old-token"}, nil
		})
	}()
	<-entered
	invalidated := make(chan struct{})
	go func() { cache.invalidate(); close(invalidated) }()
	close(release)
	<-loaded
	<-invalidated
	creds, _ := cache.load(func() (*AdsCreds, error) { return &AdsCreds{RefreshToken: "new-token"}, nil })
	if creds.RefreshToken != "new-token" {
		t.Fatal("an in-flight load repopulated invalidated credentials")
	}
}

func TestAdsCredsCacheDoesNotCacheFailures(t *testing.T) {
	cache := &adsCredsCache{}
	wantErr := errors.New("secret provider unavailable")
	if _, err := cache.load(func() (*AdsCreds, error) { return nil, wantErr }); !errors.Is(err, wantErr) {
		t.Fatal("resolver error was lost")
	}
	creds, err := cache.load(func() (*AdsCreds, error) { return &AdsCreds{RefreshToken: "retry-token"}, nil })
	if err != nil || creds.RefreshToken != "retry-token" {
		t.Fatal("failed resolution prevented retry")
	}
}

func TestAdsCredsCacheTTL(t *testing.T) {
	cache := &adsCredsCache{}
	for _, tc := range []struct {
		value string
		want  time.Duration
	}{
		{"", 10 * time.Minute}, {"50", 50 * time.Millisecond}, {"-1", 10 * time.Minute}, {"invalid", 10 * time.Minute},
	} {
		t.Setenv("ADS_CREDS_CACHE_TTL_MS", tc.value)
		if cache.ttl() != tc.want {
			t.Errorf("unexpected TTL for %q", tc.value)
		}
	}
}

func TestAdsCredsNeverConnectsToSharedCache(t *testing.T) {
	if os.Getenv("ADSPILOT_CREDS_CACHE_TEST_CHILD") == "1" {
		isolateCredentials(t)
		t.Setenv("GOOGLE_ADS_REFRESH_TOKEN", "private-test-token")
		if _, err := LoadAdsCreds(context.Background()); err != nil {
			t.Fatal(err)
		}
		return
	}
	// A fresh process catches regressions in package-startup cache creation.
	for _, backend := range []string{"REDIS_URL", "VALKEY_URL"} {
		t.Run(backend, func(t *testing.T) {
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			var connections atomic.Int32
			done := make(chan struct{})
			go func() {
				defer close(done)
				for {
					conn, err := listener.Accept()
					if err != nil {
						return
					}
					connections.Add(1)
					_ = conn.Close()
				}
			}()
			t.Cleanup(func() { _ = listener.Close(); <-done })
			t.Setenv("REDIS_URL", "")
			t.Setenv("VALKEY_URL", "")
			t.Setenv(backend, "redis://"+listener.Addr().String())
			t.Setenv("ADSPILOT_CREDS_CACHE_TEST_CHILD", "1")
			exe, err := os.Executable()
			if err != nil {
				t.Fatal(err)
			}
			cmd := exec.Command(exe, "-test.run=^TestAdsCredsNeverConnectsToSharedCache$")
			if output, err := cmd.CombinedOutput(); err != nil {
				t.Fatalf("credential subprocess failed: %v\n%s", err, output)
			}
			_ = listener.Close()
			<-done
			if connections.Load() != 0 {
				t.Fatal("credential resolution contacted the shared cache backend")
			}
		})
	}
}

func TestLoadPrecheckFlags(t *testing.T) {
	for _, key := range []string{"ADS_PRECHECK_ENABLE_LIVE", "ADS_PRECHECK_ENABLE_ACCESSIBLE_CUSTOMERS", "ADS_PRECHECK_ENABLE_VALIDATE_ONLY", "ADS_PRECHECK_TIMEOUT_MS", "ADS_PRECHECK_TOTAL_TIMEOUT_MS"} {
		t.Setenv(key, "")
	}
	flags := LoadPrecheckFlags()
	if flags.EnableLive || flags.PerCheckTimeoutMS != 1500 || flags.TotalTimeoutMS != 2500 {
		t.Fatal("unexpected default precheck flags")
	}
	t.Setenv("ADS_PRECHECK_ENABLE_LIVE", "true")
	t.Setenv("ADS_PRECHECK_ENABLE_ACCESSIBLE_CUSTOMERS", "1")
	t.Setenv("ADS_PRECHECK_ENABLE_VALIDATE_ONLY", "yes")
	t.Setenv("ADS_PRECHECK_TIMEOUT_MS", "2000")
	t.Setenv("ADS_PRECHECK_TOTAL_TIMEOUT_MS", "5000")
	flags = LoadPrecheckFlags()
	if !flags.EnableLive || !flags.EnableAccessibleCustomers || !flags.EnableValidateOnly || flags.PerCheckTimeoutMS != 2000 || flags.TotalTimeoutMS != 5000 {
		t.Fatal("custom precheck flags were not loaded")
	}
}
