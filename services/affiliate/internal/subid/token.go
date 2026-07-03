// Package subid generates portable tracking tokens and stores the mapping from a
// token to the gclid and campaign dimensions it represents. See
// docs/affiliate-design.md: the token goes into the affiliate sub-id, everything
// else stays in the mapping store, and gclid is the join key back to Google Ads.
package subid

import "crypto/rand"

// tokenAlphabet is URL-safe and accepted by every supported network's sub-id
// (alphanumeric only, no separators or symbols).
const tokenAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// TokenLen is the token length in characters. It stays at or below the portable
// sub-id ceiling (provider.PortableSubIDMaxLen = 32) so a token fits every
// supported network.
const TokenLen = 24

// NewToken returns a new opaque, URL-safe, alphanumeric tracking token. The token
// carries no meaning; the mapping store holds the gclid and dimensions it points
// to.
func NewToken() (string, error) {
	b := make([]byte, TokenLen)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	out := make([]byte, TokenLen)
	for i, v := range b {
		out[i] = tokenAlphabet[int(v)%len(tokenAlphabet)]
	}
	return string(out), nil
}
