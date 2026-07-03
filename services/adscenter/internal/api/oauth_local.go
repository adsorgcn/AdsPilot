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
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

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

var googleHTTPClient = &http.Client{Timeout: 30 * time.Second}

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

	writeCallbackPage(w, http.StatusOK, "Authorization successful. The refresh token has been saved on this machine. You can close this page.")
}

// HandleOAuthRevoke revokes the stored refresh token at Google (best effort) and
// deletes the local credential file.
func (h *OAuthHandler) HandleOAuthRevoke(w http.ResponseWriter, r *http.Request) {
	cred, err := localcreds.Load()
	if err == localcreds.ErrNotFound {
		writeJSONStatus(w, http.StatusOK, map[string]bool{"revoked": false})
		return
	}
	if err != nil {
		http.Error(w, "failed to read local credential: "+err.Error(), http.StatusInternalServerError)
		return
	}

	revokeToken(r.Context(), cred.RefreshToken)

	if err := localcreds.Delete(); err != nil {
		http.Error(w, "revoked at provider but failed to delete local credential: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSONStatus(w, http.StatusOK, map[string]bool{"revoked": true})
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
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return tr, err
	}
	if tr.Error != "" {
		return tr, &oauthError{code: tr.Error, desc: tr.ErrorDesc}
	}
	return tr, nil
}

func revokeToken(ctx context.Context, token string) {
	form := url.Values{"token": {token}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, googleRevokeEndpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := googleHTTPClient.Do(req)
	if err != nil {
		return
	}
	_ = resp.Body.Close()
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
