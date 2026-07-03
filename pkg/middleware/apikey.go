package middleware

import (
	"context"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	httpx "github.com/ScientificInternet/Google-Monetize/pkg/http"
)

type APIKeyOptions struct {
	// Required scopes. If empty, no scope check.
	Scopes []string
	// RPM limit per key. If <=0, no rate limit.
	RPM int
	// Whitelisted client IPs (exact match). If empty, no whitelist enforced.
	IPWhitelist []string
}

// APIKeyMiddleware validates X-API-Key (or query api_key) by calling Console validate endpoint
// and optionally enforces per-key RPM and IP whitelist. It returns 401/403/429 when checks fail.
//
// Requirements:
//   - CONSOLE_URL: base URL of console service
//   - INTERNAL_SERVICE_TOKEN: token to authorize /apikeys/validate
func APIKeyMiddleware(opts APIKeyOptions) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := strings.TrimSpace(r.Header.Get("X-API-Key"))
			if key == "" {
				key = strings.TrimSpace(r.URL.Query().Get("api_key"))
			}
			if key == "" {
				http.Error(w, `{"error":"missing_api_key"}`, http.StatusUnauthorized)
				return
			}
			// IP whitelist (exact match list)
			if len(opts.IPWhitelist) > 0 {
				ip := clientIP(r)
				if ip == "" || !inList(ip, opts.IPWhitelist) {
					http.Error(w, `{"error":"ip_not_allowed"}`, http.StatusForbidden)
					return
				}
			}
			// Remote validate
			base := strings.TrimSpace(os.Getenv("CONSOLE_URL"))
			token := strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_TOKEN"))
			if base == "" || token == "" {
				http.Error(w, `{"error":"server_not_configured"}`, http.StatusInternalServerError)
				return
			}
			// Scope check: pass single scope (first required) — if multiple required, validate any match
			scope := ""
			if len(opts.Scopes) > 0 {
				scope = opts.Scopes[0]
			}
			url := strings.TrimRight(base, "/") + "/api/v1/console/apikeys/validate"
			if scope != "" {
				url += "?scope=" + scope
			}
			ctx, cancel := context.WithTimeout(r.Context(), 1500*time.Millisecond)
			defer cancel()
			hdr := map[string]string{"X-Service-Token": token, "X-API-Key": key, "Accept": "application/json"}
			var resp struct {
				Ok bool `json:"ok"`
			}
			if err := httpx.New(1500*time.Millisecond).DoJSON(ctx, http.MethodPost, url, nil, hdr, 1, &resp); err != nil || !resp.Ok {
				http.Error(w, `{"error":"invalid_api_key"}`, http.StatusUnauthorized)
				return
			}
			// RPM limit per key
			if opts.RPM > 0 {
				cache := pcache.NewFromEnv()
				if cache != nil && cache.Ready() {
					now := time.Now().UTC()
					bucket := now.Format("20060102T1504") // yyyyMMddTHHMM (minute)
					rk := "apikey:rpm:" + bucket + ":" + hashKey(key)
					// INCR and set expire 70s
					if cache.Redis() != nil {
						pipe := cache.Redis().Pipeline()
						cnt := pipe.Incr(ctx, rk)
						pipe.Expire(ctx, rk, 70*time.Second)
						_, _ = pipe.Exec(ctx)
						n, _ := cnt.Result()
						if n > int64(opts.RPM) {
							w.Header().Set("Retry-After", strconv.Itoa(60))
							http.Error(w, `{"error":"rate_limited"}`, http.StatusTooManyRequests)
							return
						}
					}
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xr := strings.TrimSpace(r.Header.Get("X-Real-IP")); xr != "" {
		return xr
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func inList(v string, arr []string) bool {
	for _, x := range arr {
		if v == x {
			return true
		}
	}
	return false
}
func hashKey(s string) string {
	h := 0
	for i := 0; i < len(s); i++ {
		h = 31*h + int(s[i])
	}
	if h < 0 {
		h = -h
	}
	return strconv.Itoa(h)
}
