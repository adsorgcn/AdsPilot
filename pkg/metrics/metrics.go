package metrics

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds all Prometheus metrics for a service
type Metrics struct {
	// HTTP metrics
	HTTPRequestDuration *prometheus.HistogramVec
	HTTPRequestsTotal   *prometheus.CounterVec
	HTTPErrorsTotal     *prometheus.CounterVec

	// Business metrics (dynamically registered)
	counters map[string]*prometheus.CounterVec
	gauges   map[string]*prometheus.GaugeVec
	cfg      Config
}

// Config holds configuration for metrics
type Config struct {
	ServiceName string
	Namespace   string // e.g., "gm"
}

// New creates a new Metrics instance with Prometheus collectors
func New(cfg Config) *Metrics {
	if cfg.Namespace == "" {
		cfg.Namespace = "gm"
	}

	return &Metrics{
		// HTTP request duration histogram (in seconds)
		HTTPRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: cfg.Namespace,
				Subsystem: cfg.ServiceName,
				Name:      "http_request_duration_seconds",
				Help:      "HTTP request duration in seconds",
				Buckets:   prometheus.DefBuckets, // 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10
			},
			[]string{"method", "path", "status"},
		),

		// HTTP requests total counter
		HTTPRequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: cfg.Namespace,
				Subsystem: cfg.ServiceName,
				Name:      "http_requests_total",
				Help:      "Total number of HTTP requests",
			},
			[]string{"method", "path", "status"},
		),

		// HTTP errors total counter
		HTTPErrorsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: cfg.Namespace,
				Subsystem: cfg.ServiceName,
				Name:      "http_errors_total",
				Help:      "Total number of HTTP errors (4xx, 5xx)",
			},
			[]string{"method", "path", "status"},
		),

		// Initialize business metrics maps
		counters: make(map[string]*prometheus.CounterVec),
		gauges:   make(map[string]*prometheus.GaugeVec),
		cfg:      cfg,
	}
}

// RegisterCounter registers a new counter metric
func (m *Metrics) RegisterCounter(name, help string, labels []string, namespace, subsystem string) {
	if m.counters == nil {
		m.counters = make(map[string]*prometheus.CounterVec)
	}
	m.counters[name] = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      name,
			Help:      help,
		},
		labels,
	)
}

// RegisterGauge registers a new gauge metric
func (m *Metrics) RegisterGauge(name, help string, labels []string, namespace, subsystem string) {
	if m.gauges == nil {
		m.gauges = make(map[string]*prometheus.GaugeVec)
	}
	m.gauges[name] = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      name,
			Help:      help,
		},
		labels,
	)
}

// IncrementCounter increments a counter by 1
func (m *Metrics) IncrementCounter(name string, labels prometheus.Labels) {
	if counter, ok := m.counters[name]; ok {
		counter.With(labels).Inc()
	}
}

// AddCounter adds a value to a counter
func (m *Metrics) AddCounter(name string, value float64, labels map[string]string) {
	if counter, ok := m.counters[name]; ok {
		counter.With(labels).Add(value)
	}
}

// SetGauge sets a gauge value
func (m *Metrics) SetGauge(name string, value float64, labels prometheus.Labels) {
	if gauge, ok := m.gauges[name]; ok {
		gauge.With(labels).Set(value)
	}
}

// RecordHTTPRequest records metrics for an HTTP request
func (m *Metrics) RecordHTTPRequest(method, path, status string, duration time.Duration) {
	// Record duration
	m.HTTPRequestDuration.WithLabelValues(method, path, status).Observe(duration.Seconds())

	// Record total requests
	m.HTTPRequestsTotal.WithLabelValues(method, path, status).Inc()

	// Record errors (4xx and 5xx)
	if len(status) > 0 && (status[0] == '4' || status[0] == '5') {
		m.HTTPErrorsTotal.WithLabelValues(method, path, status).Inc()
	}
}

// Timer is a helper for measuring duration
type Timer struct {
	start time.Time
}

// NewTimer creates a new timer
func NewTimer() *Timer {
	return &Timer{start: time.Now()}
}

// ObserveDuration returns the elapsed duration since timer creation
func (t *Timer) ObserveDuration() time.Duration {
	return time.Since(t.start)
}
