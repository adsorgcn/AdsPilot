package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/localcreds"
)

func localOAuthRequest(method, path string) *http.Request {
	r := httptest.NewRequest(method, "http://127.0.0.1:8080"+path, nil)
	r.RemoteAddr = "127.0.0.1:54000"
	return r
}

func TestLocalOAuthRequestBoundary(t *testing.T) {
	for _, tc := range []struct {
		name, mode, peer, host, origin, site, path, method string
		want                                               int
	}{
		{"local tool", "1", "127.0.0.1:1234", "127.0.0.1:8080", "", "", "/oauth/revoke", "POST", 200},
		{"ipv6 loopback", "true", "[::1]:1234", "[::1]:8080", "", "", "/oauth/revoke", "POST", 200},
		{"same origin", "1", "127.0.0.1:1234", "localhost:8080", "http://localhost:8080", "same-origin", "/oauth/revoke", "POST", 200},
		{"non-local mode", "0", "127.0.0.1:1234", "127.0.0.1:8080", "", "", "/oauth/url", "GET", 404},
		{"remote peer", "1", "203.0.113.7:1234", "127.0.0.1:8080", "", "", "/oauth/revoke", "POST", 403},
		{"rebinding host", "1", "127.0.0.1:1234", "attacker.example:8080", "", "", "/oauth/revoke", "POST", 403},
		{"external origin", "1", "127.0.0.1:1234", "127.0.0.1:8080", "https://attacker.example", "", "/oauth/revoke", "POST", 403},
		{"null origin", "1", "127.0.0.1:1234", "127.0.0.1:8080", "null", "", "/oauth/revoke", "POST", 403},
		{"different local port", "1", "127.0.0.1:1234", "127.0.0.1:8080", "http://127.0.0.1:9000", "same-site", "/oauth/revoke", "POST", 403},
		{"cross-site without origin", "1", "127.0.0.1:1234", "127.0.0.1:8080", "", "cross-site", "/oauth/revoke", "POST", 403},
		{"cross-site initiation", "1", "127.0.0.1:1234", "127.0.0.1:8080", "", "cross-site", "/oauth/url", "GET", 403},
		{"provider callback navigation", "1", "127.0.0.1:1234", "127.0.0.1:8080", "https://accounts.google.com", "cross-site", "/oauth/callback", "GET", 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("ADSPILOT_LOCAL", tc.mode)
			r := localOAuthRequest(tc.method, "/api/v1/adscenter"+tc.path)
			r.RemoteAddr, r.Host = tc.peer, tc.host
			r.Header.Set("Origin", tc.origin)
			r.Header.Set("Sec-Fetch-Site", tc.site)
			r.Header.Set("X-Forwarded-For", "127.0.0.1")
			w := httptest.NewRecorder()
			allowed := RequireLocalOAuthRequest(w, r)
			if allowed != (tc.want == 200) || w.Code != tc.want {
				t.Fatalf("allowed=%v status=%d, want %d", allowed, w.Code, tc.want)
			}
		})
	}
}

func TestOAuthHandlersEnforceBoundaryWithoutRouter(t *testing.T) {
	t.Setenv("ADSPILOT_LOCAL", "0")
	h := NewOAuthHandler(nil)
	for _, run := range []http.HandlerFunc{h.HandleOAuthURL, h.HandleOAuthCallback, h.HandleOAuthRevoke} {
		w := httptest.NewRecorder()
		run(w, localOAuthRequest(http.MethodPost, "/api/v1/adscenter/oauth/revoke"))
		if w.Code != http.StatusNotFound {
			t.Fatalf("direct OAuth handler escaped local-only boundary: %d", w.Code)
		}
	}
}

type oauthTestRoundTripper func(*http.Request) (*http.Response, error)

func (f oauthTestRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func useOAuthTestServer(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	target, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	previous := googleHTTPClient
	t.Cleanup(func() { googleHTTPClient = previous })
	googleHTTPClient = &http.Client{
		Timeout:       time.Second,
		CheckRedirect: previous.CheckRedirect,
		Transport: oauthTestRoundTripper(func(r *http.Request) (*http.Response, error) {
			if r.URL.Host != "oauth2.googleapis.com" {
				return nil, errors.New("unexpected outbound OAuth host")
			}
			copy := r.Clone(r.Context())
			copy.URL.Scheme, copy.URL.Host = target.Scheme, target.Host
			return http.DefaultTransport.RoundTrip(copy)
		}),
	}
}

func TestOAuthRevocationReportsProviderEvidence(t *testing.T) {
	for _, providerStatus := range []int{200, 400, 500, 302} {
		t.Run(http.StatusText(providerStatus), func(t *testing.T) {
			setupLocalAdsCredential(t)
			if err := localcreds.Save(localcreds.Credential{ClientID: "local-client", RefreshToken: "test-revoke-token"}); err != nil {
				t.Fatal(err)
			}
			_, _ = config.LoadAdsCreds(context.Background())
			calls := 0
			useOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) {
				calls++
				if r.Method != http.MethodPost || r.URL.Path != "/revoke" || r.FormValue("token") != "test-revoke-token" {
					t.Error("unexpected revocation request")
				}
				if providerStatus == 302 {
					w.Header().Set("Location", "https://untrusted.invalid/revoke")
				}
				w.WriteHeader(providerStatus)
			})
			w := httptest.NewRecorder()
			NewOAuthHandler(nil).HandleOAuthRevoke(w, localOAuthRequest(http.MethodPost, "/api/v1/adscenter/oauth/revoke"))
			wantStatus := http.StatusBadGateway
			if providerStatus == 200 {
				wantStatus = http.StatusOK
			}
			var result map[string]any
			if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if w.Code != wantStatus || result["revoked"] != (providerStatus == 200) || result["localDeleted"] != true || calls != 1 {
				t.Fatalf("incorrect revocation evidence: status=%d result=%v calls=%d", w.Code, result, calls)
			}
			if _, err := localcreds.Load(); !errors.Is(err, localcreds.ErrNotFound) {
				t.Fatal("local credential was not removed")
			}
			creds, err := config.LoadAdsCreds(context.Background())
			if err != nil || creds.RefreshToken != "" {
				t.Fatal("revocation left stale credentials in cache")
			}
		})
	}
}

func TestOAuthRevocationNetworkFailureIsNotSuccess(t *testing.T) {
	setupLocalAdsCredential(t)
	if err := localcreds.Save(localcreds.Credential{RefreshToken: "test-network-token"}); err != nil {
		t.Fatal(err)
	}
	previous := googleHTTPClient
	t.Cleanup(func() { googleHTTPClient = previous })
	googleHTTPClient = &http.Client{Transport: oauthTestRoundTripper(func(*http.Request) (*http.Response, error) { return nil, errors.New("simulated outage") })}
	w := httptest.NewRecorder()
	NewOAuthHandler(nil).HandleOAuthRevoke(w, localOAuthRequest(http.MethodPost, "/api/v1/adscenter/oauth/revoke"))
	var result map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if w.Code != 502 || result["revoked"] != false || result["localDeleted"] != true || result["providerStatus"] != "unconfirmed" {
		t.Fatalf("network failure was misreported: %d %v", w.Code, result)
	}
}

func TestOAuthCallbackAllowsProviderNavigationWithValidState(t *testing.T) {
	setupLocalAdsCredential(t)
	state := "test-external-navigation-state"
	putPendingAuth(state, pendingAuthEntry{verifier: "test-verifier", redirectURI: "http://127.0.0.1:8080/api/v1/adscenter/oauth/callback", created: time.Now()})
	t.Cleanup(func() { _, _ = takePendingAuth(state) })
	calls := 0
	useOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/token" || r.FormValue("code_verifier") != "test-verifier" {
			t.Error("callback lost PKCE binding")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"refresh_token":"test-callback-token","scope":"https://www.googleapis.com/auth/adwords"}`))
	})
	request := func() *http.Request {
		r := localOAuthRequest(http.MethodGet, "/api/v1/adscenter/oauth/callback?state="+state+"&code=test-code")
		r.Header.Set("Origin", "https://accounts.google.com")
		r.Header.Set("Sec-Fetch-Site", "cross-site")
		return r
	}
	w := httptest.NewRecorder()
	NewOAuthHandler(nil).HandleOAuthCallback(w, request())
	if w.Code != 200 {
		t.Fatalf("valid provider callback rejected: %d %s", w.Code, w.Body.String())
	}
	cred, err := localcreds.Load()
	if err != nil || cred.RefreshToken != "test-callback-token" {
		t.Fatal("valid callback did not save expected test token")
	}
	w = httptest.NewRecorder()
	NewOAuthHandler(nil).HandleOAuthCallback(w, request())
	if w.Code != 400 || calls != 1 {
		t.Fatalf("replayed state reached provider: status=%d calls=%d", w.Code, calls)
	}
}
