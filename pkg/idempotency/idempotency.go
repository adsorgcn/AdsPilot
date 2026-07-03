package idempotency

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const keyCtx contextKey = "idempotencyKey"

// FromHeader extracts X-Idempotency-Key and normalizes whitespace.
func FromHeader(r *http.Request) string {
	return strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))
}

func WithContext(ctx context.Context, k string) context.Context {
	if k == "" {
		return ctx
	}
	return context.WithValue(ctx, keyCtx, k)
}

func FromContext(ctx context.Context) (string, bool) {
	if v, ok := ctx.Value(keyCtx).(string); ok && v != "" {
		return v, true
	}
	return "", false
}

// Validate performs minimal checks on the idempotency key.
// Allow up to 128 chars; reject spaces and control chars.
func Validate(k string) bool {
	if k == "" || len(k) > 128 {
		return false
	}
	for _, r := range k {
		if r <= 0x1f || r == ' ' || r == 0x7f {
			return false
		}
	}
	return true
}
