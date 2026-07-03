package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// RequestID ensures each incoming request carries an X-Request-Id.
// If the header is missing, it generates a lightweight unique id and
// injects it into both the request (for downstream middlewares/handlers)
// and the response (for clients and proxies).
func RequestID() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rid := strings.TrimSpace(r.Header.Get("X-Request-Id"))
			if rid == "" {
				rid = strings.TrimSpace(r.Header.Get("x-request-id"))
			}
			if rid == "" {
				rid = genReqID()
				// inject into request for downstream use
				r.Header.Set("X-Request-Id", rid)
			}
			// always echo on response for observability
			w.Header().Set("X-Request-Id", rid)
			next.ServeHTTP(w, r)
		})
	}
}

func genReqID() string {
	// ts (base36) + '-' + 8 random bytes hex
	ts := strconv.FormatInt(time.Now().UnixNano()/1e6, 36)
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return ts + "-" + hex.EncodeToString(b)
}
