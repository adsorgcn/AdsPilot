package telemetry

import (
	"context"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

var (
	reqDuration *prometheus.HistogramVec
	reqTotal    *prometheus.CounterVec
	traceOn     atomic.Bool
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
	_ = service // kept for future custom metrics
	// enable trace based on env
	if v := strings.ToLower(strings.TrimSpace(os.Getenv("TRACE_ENABLED"))); v == "1" || v == "true" || v == "yes" {
		traceOn.Store(true)
	}
}

// MetricsHandler returns a Prometheus metrics handler.
func MetricsHandler() http.Handler { return promhttp.Handler() }

// Middleware instruments HTTP handlers and records metrics.
func Middleware(service string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sw := &statusWriter{ResponseWriter: w, status: 200}
		start := time.Now()
		h := next
		if traceOn.Load() {
			// Wrap with otelhttp to emit spans when global tracer is configured
			h = otelhttp.NewHandler(next, service+" http")
		}
		h.ServeHTTP(sw, r)
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
	// extremely simple normalization: collapse IDs to ":id"
	segs := strings.Split(p, "/")
	for i, s := range segs {
		if s == "" {
			continue
		}
		// heuristic: if contains dash or is UUID-like or is long, replace
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

// SetupTracing initializes a global OTel TracerProvider when TRACES_ENABLED=1/true.
// Configs:
// - OTEL_EXPORTER_OTLP_ENDPOINT (default http://127.0.0.1:4318)
// - TRACES_SAMPLER_RATIO (default 0.01)
// - OTEL_SERVICE_NAME (overrides provided service name)
// Returns a shutdown func; no-op when disabled or on init failure.
func SetupTracing(service string) func(context.Context) error {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("TRACES_ENABLED")))
	if !(v == "1" || v == "true" || v == "yes") {
		return func(context.Context) error { return nil }
	}
	endpoint := strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))
	if endpoint == "" {
		endpoint = "http://127.0.0.1:4318"
	}
	ratio := 0.01
	if s := strings.TrimSpace(os.Getenv("TRACES_SAMPLER_RATIO")); s != "" {
		if f, err := strconv.ParseFloat(s, 64); err == nil && f >= 0 && f <= 1 {
			ratio = f
		}
	}
	if s := strings.TrimSpace(os.Getenv("OTEL_SERVICE_NAME")); s != "" {
		service = s
	}
	// exporter (http/protobuf)
	exp, err := otlptracehttp.New(context.Background(), otlptracehttp.WithEndpointURL(endpoint))
	if err != nil {
		return func(context.Context) error { return nil }
	}
	res, _ := resource.Merge(resource.Default(), resource.NewWithAttributes(
		"",
		attribute.String("service.name", service),
	))
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(ratio))),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	return tp.Shutdown
}
