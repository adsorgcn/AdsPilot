package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/logger"
	"github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth"
)

// LoggingMiddleware writes structured JSON logs for each HTTP request.
// Fields: service, method, path, status, duration_ms, user_id, trace_id.
func LoggingMiddleware(service string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: 200}
			// Extract identities
			uid, ok := supabaseauth.UserIDFromContext(r.Context())
			if !ok {
				uid, _ = supabaseauth.UserIDFromContext(r.Context())
			}
			traceID := r.Header.Get("x-request-id")
			if traceID == "" {
				traceID = r.Header.Get("X-Request-Id")
			}
			next.ServeHTTP(sw, r)
			dur := time.Since(start)
			lg := logger.Get()
			lg.Info().
				Str("service", service).
				Str("method", r.Method).
				Str("path", templatePath(r.URL.Path)).
				Int("status", sw.status).
				Int64("duration_ms", dur.Milliseconds()).
				Str("user_id", uid).
				Str("trace_id", traceID).
				Msg("http_request")
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) { w.status = code; w.ResponseWriter.WriteHeader(code) }

// templatePath reduces label cardinality by masking likely IDs.
func templatePath(p string) string {
	segs := strings.Split(p, "/")
	for i, s := range segs {
		if s == "" {
			continue
		}
		if len(s) > 12 || strings.Count(s, "-") >= 2 {
			segs[i] = ":id"
		}
	}
	out := strings.Join(segs, "/")
	if out == "" {
		return "/"
	}
	return out
}
