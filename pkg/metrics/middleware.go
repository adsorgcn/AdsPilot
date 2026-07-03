package metrics

import (
	"net/http"
	"strconv"
)

// Middleware creates an HTTP middleware that records metrics for each request
func (m *Metrics) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		timer := NewTimer()

		// Wrap ResponseWriter to capture status code
		wrapped := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK, // Default to 200
		}

		// Call next handler
		next.ServeHTTP(wrapped, r)

		// Record metrics
		duration := timer.ObserveDuration()
		status := strconv.Itoa(wrapped.statusCode)
		path := r.URL.Path
		method := r.Method

		m.RecordHTTPRequest(method, path, status, duration)
	})
}

// responseWriter wraps http.ResponseWriter to capture the status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    bool
}

// WriteHeader captures the status code
func (rw *responseWriter) WriteHeader(code int) {
	if !rw.written {
		rw.statusCode = code
		rw.written = true
	}
	rw.ResponseWriter.WriteHeader(code)
}

// Write ensures status code is captured even if WriteHeader wasn't called
func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.written {
		rw.written = true
	}
	return rw.ResponseWriter.Write(b)
}
