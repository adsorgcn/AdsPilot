package api

// Privacy-first, local Google Ads authorization.
//
// Implements the RFC 8252 (OAuth 2.0 for Native Apps) loopback redirect flow
// with RFC 7636 PKCE. The user authorizes in their own browser; the resulting
// refresh token is stored on the user's machine (see the localcreds package)
// and is never retained server-side.
//
// The OAuth client MUST be a "Desktop app" (installed application) type.
// Desktop clients require no pre-registered redirect URI and accept any
// loopback port, so the loopback callback below works without extra console
// configuration. A "Web application" client would reject the loopback redirect
// with redirect_uri_mismatch.
//
// Per the Google Ads API OAuth docs, access_type=offline and prompt=consent are
// required to reliably receive a refresh token. If the OAuth consent screen is
// still in "Testing" status the refresh token expires after 7 days; set it to
// "In production" for a long-lived token.

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/localcreds"
)

const (
	googleAuthEndpoint   = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenEndpoint  = "https://oauth2.googleapis.com/token"
	googleRevokeEndpoint = "https://oauth2.googleapis.com/revoke"
	googleAdsScope       = "https://www.googleapis.com/auth/adwords"
	pendingAuthTTL       = 10 * time.Minute
)

var googleHTTPClient = &http.Client{
	Timeout: 30 * time.Second,
	// An unexpected redirect must not forward authorization codes, client
	// secrets, or refresh tokens to another endpoint.
	CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
}

// RequireLocalOAuthRequest is shared by the router and handlers so alternate
// mounting paths cannot expose the process credential store. Host validation
// blocks DNS rebinding; Origin/Fetch Metadata block browser-driven local CSRF.
// A top-level callback GET may originate at Google: state+PKCE validates it.
func RequireLocalOAuthRequest(w http.ResponseWriter, r *http.Request) bool {
	if !middleware.LocalMode() {
		http.Error(w, "Local OAuth is unavailable outside local adapter mode", http.StatusNotFound)
		return false
	}
	peer, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		peer = r.RemoteAddr
	}
	peerIP := net.ParseIP(peer)
	host, err := url.Parse("http://" + r.Host)
	if peerIP == nil || !peerIP.IsLoopback() || err != nil || host.User != nil || host.Path != "" || host.RawQuery != "" || host.Fragment != "" || !isOAuthLoopbackHost(host.Hostname()) {
		http.Error(w, "Local OAuth requires a loopback connection and Host", http.StatusForbidden)
		return false
	}
	isCallback := r.Method == http.MethodGet && r.URL.Path == "/api/v1/adscenter/oauth/callback"
	if !isCallback {
		if site := strings.ToLower(r.Header.Get("Sec-Fetch-Site")); site != "" && site != "same-origin" && site != "none" {
			http.Error(w, "Cross-origin local OAuth request rejected", http.StatusForbidden)
			return false
		}
		if origin := r.Header.Get("Origin"); origin != "" {
			u, err := url.Parse(origin)
			scheme := "http"
			if r.TLS != nil {
				scheme = "https"
			}
			if err != nil || u.Scheme != scheme || !strings.EqualFold(u.Host, r.Host) || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
				http.Error(w, "Cross-origin local OAuth request rejected", http.StatusForbidden)
				return false
			}
		}
	}
	return true
}

func isOAuthLoopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// pendingAuthEntry holds the short-lived PKCE verifier and redirect URI between
// the /oauth/url call and the /oauth/callback call, keyed by the state value.
// It lives in process memory only; nothing transient is persisted to disk.
type pendingAuthEntry struct {
	verifier    string
	redirectURI string
	created     time.Time
}

var (
	pendingAuthMu sync.Mutex
	pendingAuths  = map[string]pendingAuthEntry{}
)

func putPendingAuth(state string, e pendingAuthEntry) {
	pendingAuthMu.Lock()
	defer pendingAuthMu.Unlock()
	for k, v := range pendingAuths {
		if time.Since(v.created) > pendingAuthTTL {
			delete(pendingAuths, k)
		}
	}
	pendingAuths[state] = e
}

func takePendingAuth(state string) (pendingAuthEntry, bool) {
	pendingAuthMu.Lock()
	defer pendingAuthMu.Unlock()
	e, ok := pendingAuths[state]
	if !ok {
		return pendingAuthEntry{}, false
	}
	delete(pendingAuths, state)
	if time.Since(e.created) > pendingAuthTTL {
		return pendingAuthEntry{}, false
	}
	return e, true
}

// oauthRedirectURI returns the loopback callback URI. It honors
// ADSPILOT_OAUTH_REDIRECT_URI, otherwise defaults to a loopback address on the
// port adscenter listens on (PORT, default 8080).
func oauthRedirectURI() string {
	if u := strings.TrimSpace(os.Getenv("ADSPILOT_OAUTH_REDIRECT_URI")); u != "" {
		return u
	}
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}
	return "http://127.0.0.1:" + port + "/api/v1/adscenter/oauth/callback"
}

func randomURLSafe(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// HandleOAuthURL generates the Google consent URL for the loopback + PKCE flow
// and returns it as JSON. The caller opens the URL in the user's browser.
func (h *OAuthHandler) HandleOAuthURL(w http.ResponseWriter, r *http.Request) {
	if !RequireLocalOAuthRequest(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	creds, err := config.LoadAdsCreds(r.Context())
	if err != nil || creds == nil || strings.TrimSpace(creds.OAuthClientID) == "" {
		http.Error(w, "OAuth client not configured (set GOOGLE_ADS_OAUTH_CLIENT_ID; the client must be a Desktop-type client)", http.StatusInternalServerError)
		return
	}

	verifier, err := randomURLSafe(32)
	if err != nil {
		http.Error(w, "failed to generate PKCE verifier", http.StatusInternalServerError)
		return
	}
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	state, err := randomURLSafe(16)
	if err != nil {
		http.Error(w, "failed to generate state", http.StatusInternalServerError)
		return
	}

	redirect := oauthRedirectURI()
	putPendingAuth(state, pendingAuthEntry{verifier: verifier, redirectURI: redirect, created: time.Now()})

	authURL := googleAuthEndpoint + "?" + url.Values{
		"client_id":             {creds.OAuthClientID},
		"redirect_uri":          {redirect},
		"response_type":         {"code"},
		"scope":                 {googleAdsScope},
		"access_type":           {"offline"},
		"prompt":                {"consent"},
		"state":                 {state},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
	}.Encode()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"url": authURL, "state": state})
}

// HandleOAuthCallback receives the loopback redirect from Google, exchanges the
// authorization code (with the PKCE verifier) for tokens, and stores the
// refresh token on the user's machine. Nothing is retained server-side.
func (h *OAuthHandler) HandleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if !RequireLocalOAuthRequest(w, r) {
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	q := r.URL.Query()
	if e := q.Get("error"); e != "" {
		writeCallbackPage(w, http.StatusBadRequest, "Authorization was denied or failed: "+e)
		return
	}
	state := q.Get("state")
	code := q.Get("code")
	if state == "" || code == "" {
		writeCallbackPage(w, http.StatusBadRequest, "Missing authorization code or state.")
		return
	}
	entry, ok := takePendingAuth(state)
	if !ok {
		writeCallbackPage(w, http.StatusBadRequest, "Unknown or expired authorization state. Please start authorization again.")
		return
	}

	creds, err := config.LoadAdsCreds(r.Context())
	if err != nil || creds == nil || strings.TrimSpace(creds.OAuthClientID) == "" {
		writeCallbackPage(w, http.StatusInternalServerError, "OAuth client not configured.")
		return
	}

	tok, err := exchangeAuthCode(r.Context(), creds.OAuthClientID, creds.OAuthClientSecret, code, entry.verifier, entry.redirectURI)
	if err != nil {
		writeCallbackPage(w, http.StatusBadGateway, "Token exchange failed: "+err.Error())
		return
	}
	if strings.TrimSpace(tok.RefreshToken) == "" {
		writeCallbackPage(w, http.StatusBadRequest, "No refresh token was returned. Revoke this app's prior access at https://myaccount.google.com/permissions and authorize again.")
		return
	}

	if err := localcreds.Save(localcreds.Credential{
		RefreshToken: tok.RefreshToken,
		Scope:        tok.Scope,
		ObtainedAt:   time.Now(),
		ClientID:     creds.OAuthClientID,
	}); err != nil {
		writeCallbackPage(w, http.StatusInternalServerError, "Authorized, but failed to store the credential locally: "+err.Error())
		return
	}

	// The creds bundle was cached without a refresh token before authorization;
	// drop it so Ads API handlers pick up the new token immediately instead of
	// after the cache TTL.
	config.InvalidateAdsCredsCache(r.Context())

	writeCallbackPage(w, http.StatusOK, "Authorization successful. The refresh token has been saved on this machine. You can close this page.")
}

// HandleOAuthRevoke deletes local credentials and reports provider revocation
// separately. A network failure or provider rejection is never called revoked.
func (h *OAuthHandler) HandleOAuthRevoke(w http.ResponseWriter, r *http.Request) {
	if !RequireLocalOAuthRequest(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	cred, err := localcreds.Load()
	if err == localcreds.ErrNotFound {
		config.InvalidateAdsCredsCache(r.Context())
		writeJSONStatus(w, http.StatusOK, map[string]any{"revoked": false, "localDeleted": true, "providerStatus": "not_attempted"})
		return
	}
	if err != nil {
		http.Error(w, "failed to read local credential: "+err.Error(), http.StatusInternalServerError)
		return
	}

	revokeErr := revokeToken(r.Context(), cred.RefreshToken)
	deleteErr := localcreds.Delete()
	// Invalidate even if disk deletion failed: a cached revoked token is stale.
	config.InvalidateAdsCredsCache(r.Context())
	result := map[string]any{"revoked": revokeErr == nil, "localDeleted": deleteErr == nil, "providerStatus": "revoked"}
	status := http.StatusOK
	if revokeErr != nil {
		status = http.StatusBadGateway
		result["providerStatus"] = "unconfirmed"
		result["message"] = "Provider revocation was not confirmed; review or revoke this grant in the Google account permissions page"
	}
	if deleteErr != nil {
		status = http.StatusInternalServerError
		result["localError"] = "Failed to delete the stored local credential"
	}
	writeJSONStatus(w, status, result)
}

type oauthTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
	TokenType    string `json:"token_type"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

func exchangeAuthCode(ctx context.Context, clientID, clientSecret, code, verifier, redirect string) (oauthTokenResponse, error) {
	var tr oauthTokenResponse
	form := url.Values{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {redirect},
		"grant_type":    {"authorization_code"},
		"code_verifier": {verifier},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleTokenEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return tr, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := googleHTTPClient.Do(req)
	if err != nil {
		return tr, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return tr, fmt.Errorf("Google OAuth token exchange returned HTTP %d", resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return tr, err
	}
	if tr.Error != "" {
		return tr, &oauthError{code: tr.Error, desc: tr.ErrorDesc}
	}
	return tr, nil
}

func revokeToken(ctx context.Context, token string) error {
	if strings.TrimSpace(token) == "" {
		return errors.New("missing token to revoke")
	}
	form := url.Values{"token": {token}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleRevokeEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return errors.New("failed to construct provider revocation request")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := googleHTTPClient.Do(req)
	if err != nil {
		return errors.New("provider revocation request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("provider revocation returned HTTP %d", resp.StatusCode)
	}
	return nil
}

type oauthError struct {
	code string
	desc string
}

func (e *oauthError) Error() string {
	if e.desc != "" {
		return e.code + ": " + e.desc
	}
	return e.code
}

func writeJSONStatus(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeCallbackPage(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte("<!doctype html><html><body style=\"font-family:sans-serif;text-align:center;margin-top:80px\"><h2>" + htmlEscape(msg) + "</h2></body></html>"))
}

func htmlEscape(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&quot;", "'", "&#39;")
	return r.Replace(s)
}
