package supabaseauth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidToken = errors.New("invalid supabase token")
	ErrJWKSFetch    = errors.New("failed to fetch supabase jwks")
)

type Verifier struct {
	projectURL string
	issuer     string
	jwksURL    string
	Audience   string

	cacheMu    sync.RWMutex
	keys       map[string]*rsa.PublicKey
	cacheExp   time.Time
	cacheTTL   time.Duration
	httpClient *http.Client
}

// Option configures the verifier.
type Option func(*Verifier)

// WithProjectURL overrides the Supabase project base URL.
func WithProjectURL(projectURL string) Option {
	return func(v *Verifier) {
		projectURL = strings.TrimSuffix(strings.TrimSpace(projectURL), "/")
		if projectURL != "" {
			v.projectURL = projectURL
			v.issuer = projectURL + "/auth/v1"
			v.jwksURL = projectURL + "/auth/v1/keys"
		}
	}
}

// WithJWKSURL overrides the JWKS url used for verification.
func WithJWKSURL(jwksURL string) Option {
	return func(v *Verifier) {
		v.jwksURL = strings.TrimSpace(jwksURL)
	}
}

// WithAudience configures the expected JWT audience.
func WithAudience(audience string) Option {
	return func(v *Verifier) {
		if strings.TrimSpace(audience) != "" {
			v.Audience = audience
		}
	}
}

// WithHTTPClient sets a custom HTTP client for JWKS fetches.
func WithHTTPClient(client *http.Client) Option {
	return func(v *Verifier) {
		if client != nil {
			v.httpClient = client
		}
	}
}

// WithCacheTTL overrides the JWKS cache TTL.
func WithCacheTTL(ttl time.Duration) Option {
	return func(v *Verifier) {
		if ttl > 0 {
			v.cacheTTL = ttl
		}
	}
}

// NewVerifier constructs a Supabase verifier using provided options or environment defaults.
func NewVerifier(opts ...Option) *Verifier {
	projectURL := strings.TrimSuffix(strings.TrimSpace(os.Getenv("SUPABASE_PROJECT_URL")), "/")
	if projectURL == "" {
		projectURL = strings.TrimSuffix(strings.TrimSpace(os.Getenv("NEXT_PUBLIC_SUPABASE_URL")), "/")
	}
	if projectURL == "" {
		projectURL = strings.TrimSuffix(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/")
	}

	verifier := &Verifier{
		projectURL: projectURL,
		issuer:     projectURL + "/auth/v1",
		jwksURL:    projectURL + "/auth/v1/keys",
		Audience:   "authenticated",
		keys:       make(map[string]*rsa.PublicKey),
		cacheTTL:   5 * time.Minute,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}

	for _, opt := range opts {
		opt(verifier)
	}

	return verifier
}

// DefaultVerifier returns a singleton verifier configured from environment variables.
func DefaultVerifier() *Verifier {
	defaultVerifierOnce.Do(func() {
		defaultVerifier = NewVerifier()
	})

	return defaultVerifier
}

var (
	defaultVerifier     *Verifier
	defaultVerifierOnce sync.Once
)

func (v *Verifier) fetchKeys(ctx context.Context) error {
	v.cacheMu.Lock()
	defer v.cacheMu.Unlock()

	if time.Now().Before(v.cacheExp) && len(v.keys) > 0 {
		return nil
	}

	jwksURL := v.jwksURL
	if jwksURL == "" {
		return fmt.Errorf("%w: supabase project url not configured", ErrJWKSFetch)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, jwksURL, nil)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrJWKSFetch, err)
	}

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrJWKSFetch, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: status %d", ErrJWKSFetch, resp.StatusCode)
	}

	var data struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Alg string `json:"alg"`
			Use string `json:"use"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return fmt.Errorf("%w: decode error: %v", ErrJWKSFetch, err)
	}

	if len(data.Keys) == 0 {
		return fmt.Errorf("%w: no keys found", ErrJWKSFetch)
	}

	fresh := make(map[string]*rsa.PublicKey)
	for _, k := range data.Keys {
		pub, err := parseRSAPublicKey(k.N, k.E)
		if err != nil {
			continue
		}
		fresh[k.Kid] = pub
	}

	if len(fresh) == 0 {
		return fmt.Errorf("%w: no usable RSA keys", ErrJWKSFetch)
	}

	v.keys = fresh
	v.cacheExp = time.Now().Add(v.cacheTTL)
	return nil
}

func parseRSAPublicKey(nStr, eStr string) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(nStr)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eStr)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	e := 0
	for _, b := range eBytes {
		e = e<<8 + int(b)
	}

	return &rsa.PublicKey{N: n, E: e}, nil
}

// Verify parses and validates a Supabase JWT, returning extracted claims.
func (v *Verifier) Verify(ctx context.Context, tokenString string) (Claims, error) {
	if err := v.fetchKeys(ctx); err != nil {
		return Claims{}, err
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Header["alg"] != "RS256" {
			return nil, fmt.Errorf("unexpected signing method %v", token.Header["alg"])
		}
		kid, _ := token.Header["kid"].(string)
		v.cacheMu.RLock()
		defer v.cacheMu.RUnlock()
		key, ok := v.keys[kid]
		if !ok {
			return nil, fmt.Errorf("unknown jwk kid %s", kid)
		}
		return key, nil
	}, jwt.WithIssuer(v.issuer), jwt.WithAudience(v.Audience))

	if err != nil {
		return Claims{}, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}

	if !token.Valid {
		return Claims{}, ErrInvalidToken
	}

	return convertClaims(claims)
}

func convertClaims(claims jwt.MapClaims) (Claims, error) {
	info := Claims{
		Raw: claims,
	}

	if sub, _ := claims["sub"].(string); strings.TrimSpace(sub) != "" {
		info.UserID = strings.TrimSpace(sub)
	}

	if email, _ := claims["email"].(string); strings.TrimSpace(email) != "" {
		info.Email = strings.TrimSpace(email)
	}

	if role, _ := claims["role"].(string); strings.TrimSpace(role) != "" {
		info.Role = strings.TrimSpace(role)
	}

	if info.UserID == "" {
		return Claims{}, fmt.Errorf("%w: missing sub claim", ErrInvalidToken)
	}

	return info, nil
}

// VerifyRequest extracts the Authorization header and validates the token.
func (v *Verifier) VerifyRequest(ctx context.Context, r *http.Request) (Claims, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return Claims{}, fmt.Errorf("%w: authorization header missing", ErrInvalidToken)
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return Claims{}, fmt.Errorf("%w: invalid authorization header format", ErrInvalidToken)
	}

	return v.Verify(ctx, parts[1])
}

// ProjectURL returns the configured project URL.
func (v *Verifier) ProjectURL() string {
	return v.projectURL
}

// JWKSURL returns the JWKS endpoint.
func (v *Verifier) JWKSURL() string {
	return v.jwksURL
}

// Issuer returns the configured issuer.
func (v *Verifier) Issuer() string {
	return v.issuer
}

// AudienceOrDefault returns the audience configured for verification.
func (v *Verifier) AudienceOrDefault() string {
	if v.Audience != "" {
		return v.Audience
	}
	return "authenticated"
}

// ParseProjectFromServiceKey extracts the Supabase project URL from a service key.
func ParseProjectFromServiceKey(serviceKey string) (string, error) {
	serviceKey = strings.TrimSpace(serviceKey)
	if serviceKey == "" {
		return "", fmt.Errorf("service key empty")
	}
	parts := strings.Split(serviceKey, ".")
	if len(parts) < 3 {
		return "", fmt.Errorf("service key malformed")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("decode payload: %w", err)
	}

	var data struct {
		Project string `json:"project_id"`
	}
	if err := json.Unmarshal(payload, &data); err != nil {
		return "", fmt.Errorf("unmarshal payload: %w", err)
	}

	if strings.TrimSpace(data.Project) == "" {
		return "", fmt.Errorf("project id missing in service key")
	}

	return fmt.Sprintf("https://%s.supabase.co", strings.TrimSpace(data.Project)), nil
}

// RewriteDatabaseURL rewrites a postgres connection string database component.
// Exposed here so services can ensure DB_NAME overrides remain colocated with Supabase config requirements.
func RewriteDatabaseURL(originalURL, newDBName string) string {
	u, err := url.Parse(originalURL)
	if err != nil {
		return originalURL
	}
	u.Path = "/" + newDBName
	return u.String()
}
