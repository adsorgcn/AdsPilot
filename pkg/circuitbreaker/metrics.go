package circuitbreaker

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/sony/gobreaker/v2"
)

// MetricsBreaker is a circuit breaker with Prometheus metrics support
type MetricsBreaker struct {
	*Breaker
	stateGauge       prometheus.Gauge
	requestsCounter  *prometheus.CounterVec
	failuresCounter  *prometheus.CounterVec
	successesCounter *prometheus.CounterVec
}

// NewMetricsBreaker creates a circuit breaker with Prometheus metrics
func NewMetricsBreaker(cfg Config, namespace, subsystem string) *MetricsBreaker {
	if namespace == "" {
		namespace = "gm"
	}

	// Create state gauge (0=closed, 1=half-open, 2=open)
	stateGauge := promauto.NewGauge(prometheus.GaugeOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "circuit_breaker_state",
		Help:      "Circuit breaker state (0=closed, 1=half-open, 2=open)",
		ConstLabels: prometheus.Labels{
			"breaker": cfg.Name,
		},
	})

	// Create requests counter
	requestsCounter := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "circuit_breaker_requests_total",
			Help:      "Total number of circuit breaker requests",
			ConstLabels: prometheus.Labels{
				"breaker": cfg.Name,
			},
		},
		[]string{"result"}, // "success" or "failure"
	)

	// Create failures counter
	failuresCounter := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "circuit_breaker_failures_total",
			Help:      "Total number of circuit breaker failures",
			ConstLabels: prometheus.Labels{
				"breaker": cfg.Name,
			},
		},
		[]string{"type"}, // "consecutive" or "total"
	)

	// Create successes counter
	successesCounter := promauto.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "circuit_breaker_successes_total",
			Help:      "Total number of circuit breaker successes",
			ConstLabels: prometheus.Labels{
				"breaker": cfg.Name,
			},
		},
		[]string{"type"}, // "consecutive" or "total"
	)

	// Wrap OnStateChange to update metrics
	originalOnStateChange := cfg.OnStateChange
	cfg.OnStateChange = func(name string, from gobreaker.State, to gobreaker.State) {
		// Update state gauge
		switch to {
		case gobreaker.StateClosed:
			stateGauge.Set(0)
		case gobreaker.StateHalfOpen:
			stateGauge.Set(1)
		case gobreaker.StateOpen:
			stateGauge.Set(2)
		}

		// Call original callback if exists
		if originalOnStateChange != nil {
			originalOnStateChange(name, from, to)
		}
	}

	breaker := NewBreaker(cfg)

	// Set initial state
	switch breaker.State() {
	case gobreaker.StateClosed:
		stateGauge.Set(0)
	case gobreaker.StateHalfOpen:
		stateGauge.Set(1)
	case gobreaker.StateOpen:
		stateGauge.Set(2)
	}

	return &MetricsBreaker{
		Breaker:          breaker,
		stateGauge:       stateGauge,
		requestsCounter:  requestsCounter,
		failuresCounter:  failuresCounter,
		successesCounter: successesCounter,
	}
}

// Execute wraps the parent Execute with metrics recording
func (mb *MetricsBreaker) Execute(fn func() (any, error)) (any, error) {
	result, err := mb.Breaker.Execute(fn)

	// Record request metrics
	if err != nil {
		mb.requestsCounter.WithLabelValues("failure").Inc()
	} else {
		mb.requestsCounter.WithLabelValues("success").Inc()
	}

	// Record detailed counts
	counts := mb.Counts()
	mb.failuresCounter.WithLabelValues("total").Add(float64(counts.TotalFailures))
	mb.failuresCounter.WithLabelValues("consecutive").Add(float64(counts.ConsecutiveFailures))
	mb.successesCounter.WithLabelValues("total").Add(float64(counts.TotalSuccesses))
	mb.successesCounter.WithLabelValues("consecutive").Add(float64(counts.ConsecutiveSuccesses))

	return result, err
}

// GetStateValue returns numeric value for current state (for testing)
func (mb *MetricsBreaker) GetStateValue() float64 {
	switch mb.State() {
	case gobreaker.StateClosed:
		return 0
	case gobreaker.StateHalfOpen:
		return 1
	case gobreaker.StateOpen:
		return 2
	default:
		return -1
	}
}
