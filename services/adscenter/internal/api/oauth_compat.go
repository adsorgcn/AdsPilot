package api

import (
	"database/sql"
	"os"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/crypto"
)

// DecryptWithRotation attempts to decrypt a stored token, trying the current and
// previous token-encryption keys (supporting key rotation). Returns (plaintext, true)
// on success, or ("", false) if no key is configured or none can decrypt the value
// (in which case callers fall back to using the raw value).
//
// NOTE: server-side token custody is being phased out in favor of local per-user
// OAuth (token stays on the user's machine). This remains only to decrypt any
// legacy stored tokens during the transition.
func DecryptWithRotation(enc string) (string, bool) {
	if strings.TrimSpace(enc) == "" {
		return "", false
	}
	for _, env := range []string{"ADS_TOKEN_ENC_KEY", "ADS_TOKEN_ENC_KEY_PREV"} {
		key := strings.TrimSpace(os.Getenv(env))
		if key == "" {
			continue
		}
		if pt, err := crypto.Decrypt([]byte(key), enc); err == nil {
			return pt, true
		}
	}
	return "", false
}

// OAuthHandler handles the Google Ads OAuth endpoints. The authorization flow
// itself (loopback + PKCE, with the refresh token stored on the user's machine
// and zero server-side retention) is implemented in oauth_local.go.
type OAuthHandler struct {
	db *sql.DB
}

// NewOAuthHandler creates an OAuthHandler.
func NewOAuthHandler(db *sql.DB) *OAuthHandler {
	return &OAuthHandler{db: db}
}
