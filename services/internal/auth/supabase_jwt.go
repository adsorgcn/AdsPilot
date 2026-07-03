package auth

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// SupabaseTokenVerifier verifies Supabase-issued JWTs using the project's JWKS.
type SupabaseTokenVerifier struct {
	jwksURL    string
	issuer     string
	audience   string
	httpClient *http.Client

	mu        sync.RWMutex
	cacheKeys map[string]*rsa.PublicKey
	cacheExp  time.Time
}

// NewSupabaseTokenVerifier constructs a new verifier for the given Supabase project URL.
func NewSupabaseTokenVerifier(projectURL string) *SupabaseTokenVerifier {
	return &SupabaseTokenVerifier{
		jwksURL:    fmt.Sprintf("%s/auth/v1/keys", projectURL),
		issuer:     fmt.Sprintf("%s/auth/v1", projectURL),
		audience:   "authenticated",
		httpClient: &http.Client{Timeout: 5 * time.Second},
		cacheKeys:  make(map[string]*rsa.PublicKey),
	}
}

type jwk struct {
	KID string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwks struct {
	Keys []jwk `json:"keys"`
}

func (v *SupabaseTokenVerifier) fetchKeys(ctx context.Context) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if time.Now().Before(v.cacheExp) && len(v.cacheKeys) > 0 {
		return nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return err
	}

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch JWKS: %s", resp.Status)
	}

	var data jwks
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return err
	}

	keys := make(map[string]*rsa.PublicKey)
	for _, key := range data.Keys {
		pub, err := parseRSAPublicKey(key.N, key.E)
		if err != nil {
			continue
		}
		keys[key.KID] = pub
	}

	if len(keys) == 0 {
		return errors.New("no usable RSA keys in JWKS")
	}

	v.cacheKeys = keys
	v.cacheExp = time.Now().Add(15 * time.Minute)
	return nil
}

func parseRSAPublicKey(nStr, eStr string) (*rsa.PublicKey, error) {
	nBytes, err := jwt.DecodeSegment(nStr)
	if err != nil {
		return nil, err
	}
	eBytes, err := jwt.DecodeSegment(eStr)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	var e int
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}

	return &rsa.PublicKey{N: n, E: e}, nil
}

// Verify validates a Supabase JWT and returns its registered claims.
func (v *SupabaseTokenVerifier) Verify(ctx context.Context, tokenString string) (*jwt.RegisteredClaims, error) {
	if err := v.fetchKeys(ctx); err != nil {
		return nil, err
	}

	token, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Header["alg"] != "RS256" {
			return nil, fmt.Errorf("unexpected signing method %v", token.Header["alg"])
		}

		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, errors.New("missing kid in JWT header")
		}

		v.mu.RLock()
		defer v.mu.RUnlock()

		key, exists := v.cacheKeys[kid]
		if !exists {
			return nil, fmt.Errorf("unknown kid %s", kid)
		}
		return key, nil
	}, jwt.WithIssuer(v.issuer), jwt.WithAudience(v.audience))

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*jwt.RegisteredClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid JWT claims")
	}

	return claims, nil
}
