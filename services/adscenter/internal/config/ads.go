package config

import (
	"context"
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"time"

	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/localcreds"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/secrets"
)

type AdsCreds struct {
	DeveloperToken    string
	OAuthClientID     string
	OAuthClientSecret string
	RefreshToken      string
	LoginCustomerID   string
	TestCustomerID    string
}

// LoadAdsCreds loads Google Ads credentials from environment variables
// or, if provided, from Secret Manager using corresponding *_SECRET_NAME envs.
// Secret-name envs: GOOGLE_ADS_DEVELOPER_TOKEN_SECRET_NAME, GOOGLE_ADS_OAUTH_CLIENT_ID_SECRET_NAME,
// GOOGLE_ADS_OAUTH_CLIENT_SECRET_SECRET_NAME, GOOGLE_ADS_REFRESH_TOKEN_SECRET_NAME,
// GOOGLE_ADS_LOGIN_CUSTOMER_ID_SECRET_NAME, GOOGLE_ADS_TEST_CUSTOMER_ID_SECRET_NAME
func LoadAdsCreds(ctx context.Context) (*AdsCreds, error) {
	// in-process cache with TTL to reduce Secret Manager calls
	if c := cachedCreds.get(); c != nil {
		return c, nil
	}
	get := func(key, secretNameKey string) (string, error) {
		if v := strings.TrimSpace(os.Getenv(key)); v != "" {
			return v, nil
		}
		if sn := strings.TrimSpace(os.Getenv(secretNameKey)); sn != "" {
			return secrets.Get(ctx, sn)
		}
		return "", nil
	}
	dev, _ := get("GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_DEVELOPER_TOKEN_SECRET_NAME")
	cid, _ := get("GOOGLE_ADS_OAUTH_CLIENT_ID", "GOOGLE_ADS_OAUTH_CLIENT_ID_SECRET_NAME")
	csec, _ := get("GOOGLE_ADS_OAUTH_CLIENT_SECRET", "GOOGLE_ADS_OAUTH_CLIENT_SECRET_SECRET_NAME")
	rt, _ := get("GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_REFRESH_TOKEN_SECRET_NAME")
	if rt == "" {
		// Fall back to the token stored by the local OAuth flow (loopback +
		// PKCE, see internal/api/oauth_local.go). A token minted by a
		// different OAuth client is ignored: refreshing it with the current
		// client would fail with invalid_grant.
		if cred, err := localcreds.Load(); err == nil {
			if cred.ClientID == "" || cid == "" || cred.ClientID == cid {
				rt = strings.TrimSpace(cred.RefreshToken)
			}
		}
	}
	login, _ := get("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_LOGIN_CUSTOMER_ID_SECRET_NAME")
	test, _ := get("GOOGLE_ADS_TEST_CUSTOMER_ID", "GOOGLE_ADS_TEST_CUSTOMER_ID_SECRET_NAME")
	out := &AdsCreds{DeveloperToken: dev, OAuthClientID: cid, OAuthClientSecret: csec, RefreshToken: rt, LoginCustomerID: login, TestCustomerID: test}
	cachedCreds.put(out)
	return out, nil
}

type PrecheckFlags struct {
	EnableLive                bool
	EnableAccessibleCustomers bool
	EnableValidateOnly        bool
	PerCheckTimeoutMS         int
	TotalTimeoutMS            int
}

func LoadPrecheckFlags() PrecheckFlags {
	toBool := func(k string, def bool) bool {
		v := strings.ToLower(strings.TrimSpace(os.Getenv(k)))
		if v == "true" || v == "1" || v == "yes" {
			return true
		}
		if v == "false" || v == "0" || v == "no" {
			return false
		}
		return def
	}
	toInt := func(k string, def int) int {
		if s := strings.TrimSpace(os.Getenv(k)); s != "" {
			if n, err := strconv.Atoi(s); err == nil {
				return n
			}
		}
		return def
	}
	return PrecheckFlags{
		EnableLive:                toBool("ADS_PRECHECK_ENABLE_LIVE", false),
		EnableAccessibleCustomers: toBool("ADS_PRECHECK_ENABLE_ACCESSIBLE_CUSTOMERS", false),
		EnableValidateOnly:        toBool("ADS_PRECHECK_ENABLE_VALIDATE_ONLY", false),
		PerCheckTimeoutMS:         toInt("ADS_PRECHECK_TIMEOUT_MS", 1500),
		TotalTimeoutMS:            toInt("ADS_PRECHECK_TOTAL_TIMEOUT_MS", 2500),
	}
}

// InvalidateAdsCredsCache drops the cached credential bundle so the next
// LoadAdsCreds call re-resolves env / Secret Manager / localcreds. The local
// OAuth callback calls this after storing a fresh refresh token; without it,
// handlers would keep seeing the cached token-less bundle for up to the cache
// TTL (default 10 minutes).
func InvalidateAdsCredsCache(ctx context.Context) {
	if cachedCreds != nil && cachedCreds.cache != nil {
		cachedCreds.cache.Del(ctx, adsCredsCacheKey)
	}
}

// --- Redis-backed cache for AdsCreds (replaces in-memory) ---
var cachedCreds = &adsCredsCache{
	cache: pcache.NewFromEnv(),
}

type adsCredsCache struct {
	cache *pcache.Cache
}

const adsCredsCacheKey = "adscenter:ads_creds"

func (c *adsCredsCache) ttl() time.Duration {
	// default: 10m, override via ADS_CREDS_CACHE_TTL_MS
	if s := strings.TrimSpace(os.Getenv("ADS_CREDS_CACHE_TTL_MS")); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			return time.Duration(n) * time.Millisecond
		}
	}
	return 10 * time.Minute
}

func (c *adsCredsCache) get() *AdsCreds {
	if c.cache == nil {
		return nil
	}

	val, ok := c.cache.Get(context.Background(), adsCredsCacheKey)
	if !ok {
		return nil
	}

	var creds AdsCreds
	if err := json.Unmarshal([]byte(val), &creds); err != nil {
		return nil
	}
	return &creds
}

func (c *adsCredsCache) put(v *AdsCreds) {
	if v == nil || c.cache == nil {
		return
	}

	data, err := json.Marshal(v)
	if err != nil {
		return
	}

	c.cache.Set(context.Background(), adsCredsCacheKey, string(data), c.ttl())
}
