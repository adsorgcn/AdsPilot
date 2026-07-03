package telemetryshim

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"net/http"
	"strings"
	"time"
)

var (
	reqDuration *prometheus.HistogramVec
	reqTotal    *prometheus.CounterVec
)

// RegisterDefaultMetrics registers HTTP request metrics with a service label.
func RegisterDefaultMetrics(service string) {
	if reqDuration == nil {
		reqDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		}, []string{"service", "method", "path", "status"})
		_ = prometheus.Register(reqDuration)
	}
	if reqTotal == nil {
		reqTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total HTTP requests",
		}, []string{"service", "method", "path", "status"})
		_ = prometheus.Register(reqTotal)
	}
	_ = service // reserved for future custom metrics
}

// MetricsHandler returns a Prometheus metrics handler.
func MetricsHandler() http.Handler { return promhttp.Handler() }

// Middleware instruments HTTP handlers and records metrics.
func Middleware(service string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sw := &statusWriter{ResponseWriter: w, status: 200}
		start := time.Now()
		next.ServeHTTP(sw, r)
		dur := time.Since(start).Seconds()
		path := templatePath(r.URL.Path)
		method := r.Method
		status := http.StatusText(sw.status)
		if reqDuration != nil {
			reqDuration.WithLabelValues(service, method, path, status).Observe(dur)
		}
		if reqTotal != nil {
			reqTotal.WithLabelValues(service, method, path, status).Inc()
		}
	})
}

// ChiMiddleware adapts for chi.Use(func(next) http.Handler).
func ChiMiddleware(service string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler { return Middleware(service, next) }
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) { w.status = code; w.ResponseWriter.WriteHeader(code) }

// templatePath reduces path cardinality for metrics labels.
func templatePath(p string) string {
	segs := strings.Split(p, "/")
	for i, s := range segs {
		if s == "" {
			continue
		}
		if len(s) >= 8 && (strings.Contains(s, "-") || strings.Count(s, "-") >= 1) {
			segs[i] = ":id"
		}
	}
	out := strings.Join(segs, "/")
	if out == "" {
		return "/"
	}
	return out
}
