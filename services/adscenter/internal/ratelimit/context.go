package ratelimit

import (
	"context"
)

type ctxKey string

const keyParams ctxKey = "adscenter.rate.params"

// RateParams carries per-key limiter configuration injected by handler layer.
type RateParams struct {
	Key         string
	RPM         int
	Concurrency int
}

// WithParams attaches per-key rate parameters to context.
func WithParams(ctx context.Context, p RateParams) context.Context {
	return context.WithValue(ctx, keyParams, p)
}

// ParamsFrom extracts per-key rate parameters from context.
func ParamsFrom(ctx context.Context) (RateParams, bool) {
	if v := ctx.Value(keyParams); v != nil {
		if p, ok := v.(RateParams); ok && p.Key != "" {
			return p, true
		}
	}
	return RateParams{}, false
}
