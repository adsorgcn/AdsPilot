package preflight

import (
	"context"
	"os"
	"strconv"
	"time"

	rl "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ratelimit"
)

// throttledClient wraps a LiveClient with rate limiting and retry/backoff.
type throttledClient struct {
	inner    LiveClient
	lim      *rl.Limiter
	keyed    *rl.KeyedManager
	attempts int
	base     time.Duration
	max      time.Duration
}

// WrapWithThrottle returns a LiveClient wrapped with limiter and retry logic.
// Env:
//
//	ADS_RATE_LIMIT_RPM: tokens per minute (default 60)
//	ADS_CONCURRENCY_MAX: max concurrent in-flight (default 4)
//	ADS_RETRY_ATTEMPTS: retry attempts (default 3)
//	ADS_RETRY_BASE_MS: base backoff ms (default 200)
//	ADS_RETRY_MAX_MS: max backoff ms (default 2000)
var (
	globalLimiter *rl.Limiter
	keyedMgr      *rl.KeyedManager
)

func getLimiter() *rl.Limiter {
	if globalLimiter != nil {
		return globalLimiter
	}
	rpm := getenvInt("ADS_RATE_LIMIT_RPM", 60)
	conc := getenvInt("ADS_CONCURRENCY_MAX", 4)
	globalLimiter = rl.NewLimiter(rpm, conc)
	globalLimiter.Start()
	return globalLimiter
}

func WrapWithThrottle(inner LiveClient) LiveClient {
	lim := getLimiter()
	if keyedMgr == nil {
		pol := rl.LoadPolicy(context.Background())
		ttl := time.Duration(pol.KeyTTLSeconds) * time.Second
		if ttl <= 0 {
			ttl = time.Hour
		}
		keyedMgr = rl.NewKeyedManager(ttl, pol.MaxKeys)
	}
	return &throttledClient{
		inner:    inner,
		lim:      lim,
		keyed:    keyedMgr,
		attempts: getenvInt("ADS_RETRY_ATTEMPTS", 3),
		base:     time.Duration(getenvInt("ADS_RETRY_BASE_MS", 200)) * time.Millisecond,
		max:      time.Duration(getenvInt("ADS_RETRY_MAX_MS", 2000)) * time.Millisecond,
	}
}

func getenvInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func (t *throttledClient) withThrottle(ctx context.Context, f func(context.Context) error) error {
	// per-key limiter (fairness)
	if p, ok := rl.ParamsFrom(ctx); ok && p.Key != "" && t.keyed != nil {
		// plan-based policy: override rpm/conc if non-zero from context else derive from defaults
		rpm := p.RPM
		conc := p.Concurrency
		if rpm <= 0 || conc <= 0 {
			// fallback to defaults
			rpm = getenvInt("ADS_RATE_LIMIT_RPM", 60)
			conc = getenvInt("ADS_CONCURRENCY_MAX", 4)
		}
		pl := t.keyed.Get(p.Key, rpm, conc)
		relKey, err := pl.Acquire(ctx)
		if err != nil {
			return err
		}
		defer relKey()
	}
	// global limiter (total cap)
	release, err := t.lim.Acquire(ctx)
	if err != nil {
		return err
	}
	defer release()
	return rl.Retry(ctx, t.attempts, t.base, t.max, f)
}

func (t *throttledClient) ListAccessibleCustomers(ctx context.Context) ([]string, error) {
	var out []string
	err := t.withThrottle(ctx, func(c context.Context) error {
		var e error
		out, e = t.inner.ListAccessibleCustomers(c)
		return e
	})
	return out, err
}

func (t *throttledClient) AdsAPIPing(ctx context.Context) error {
	return t.withThrottle(ctx, func(c context.Context) error { return t.inner.AdsAPIPing(c) })
}

func (t *throttledClient) GetCampaignsCount(ctx context.Context, accountID string) (int, error) {
	var n int
	err := t.withThrottle(ctx, func(c context.Context) error {
		var e error
		n, e = t.inner.GetCampaignsCount(c, accountID)
		return e
	})
	return n, err
}

func (t *throttledClient) HasActiveConversionTracking(ctx context.Context, accountID string) (bool, error) {
	var ok bool
	err := t.withThrottle(ctx, func(c context.Context) error {
		var e error
		ok, e = t.inner.HasActiveConversionTracking(c, accountID)
		return e
	})
	return ok, err
}

func (t *throttledClient) HasSufficientBudget(ctx context.Context, accountID string) (bool, error) {
	var ok bool
	err := t.withThrottle(ctx, func(c context.Context) error {
		var e error
		ok, e = t.inner.HasSufficientBudget(c, accountID)
		return e
	})
	return ok, err
}
