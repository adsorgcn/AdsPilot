package metrics

import (
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
)

func TestNew(t *testing.T) {
	cfg := Config{
		ServiceName: "test-service-unique",
		Namespace:   "gm-test",
	}

	m := New(cfg)

	assert.NotNil(t, m)
	assert.NotNil(t, m.HTTPRequestDuration)
	assert.NotNil(t, m.HTTPRequestsTotal)
	assert.NotNil(t, m.HTTPErrorsTotal)
}

func TestRecordHTTPRequest_Success(t *testing.T) {
	// Use a unique registry to avoid conflicts
	reg := prometheus.NewRegistry()

	m := &Metrics{
		HTTPRequestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "test_http_request_duration_seconds",
			},
			[]string{"method", "path", "status"},
		),
		HTTPRequestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "test_http_requests_total",
			},
			[]string{"method", "path", "status"},
		),
		HTTPErrorsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "test_http_errors_total",
			},
			[]string{"method", "path", "status"},
		),
	}

	reg.MustRegister(m.HTTPRequestDuration, m.HTTPRequestsTotal, m.HTTPErrorsTotal)

	// Record a successful request
	m.RecordHTTPRequest("GET", "/api/test", "200", 100*time.Millisecond)

	// Verify total requests counter
	count := testutil.ToFloat64(m.HTTPRequestsTotal.WithLabelValues("GET", "/api/test", "200"))
	assert.Equal(t, 1.0, count)

	// Verify errors counter (should be 0 for 2xx)
	errorCount := testutil.ToFloat64(m.HTTPErrorsTotal.WithLabelValues("GET", "/api/test", "200"))
	assert.Equal(t, 0.0, errorCount)
}

func TestRecordHTTPRequest_4xxError(t *testing.T) {
	reg := prometheus.NewRegistry()

	m := &Metrics{
		HTTPRequestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "test_4xx_http_request_duration_seconds",
			},
			[]string{"method", "path", "status"},
		),
		HTTPRequestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "test_4xx_http_requests_total",
			},
			[]string{"method", "path", "status"},
		),
		HTTPErrorsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "test_4xx_http_errors_total",
			},
			[]string{"method", "path", "status"},
		),
	}

	reg.MustRegister(m.HTTPRequestDuration, m.HTTPRequestsTotal, m.HTTPErrorsTotal)

	// Record a 404 error
	m.RecordHTTPRequest("GET", "/api/notfound", "404", 50*time.Millisecond)

	// Verify total requests counter
	count := testutil.ToFloat64(m.HTTPRequestsTotal.WithLabelValues("GET", "/api/notfound", "404"))
	assert.Equal(t, 1.0, count)

	// Verify errors counter (should be 1 for 4xx)
	errorCount := testutil.ToFloat64(m.HTTPErrorsTotal.WithLabelValues("GET", "/api/notfound", "404"))
	assert.Equal(t, 1.0, errorCount)
}

func TestRecordHTTPRequest_5xxError(t *testing.T) {
	reg := prometheus.NewRegistry()

	m := &Metrics{
		HTTPRequestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "test_5xx_http_request_duration_seconds",
			},
			[]string{"method", "path", "status"},
		),
		HTTPRequestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "test_5xx_http_requests_total",
			},
			[]string{"method", "path", "status"},
		),
		HTTPErrorsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "test_5xx_http_errors_total",
			},
			[]string{"method", "path", "status"},
		),
	}

	reg.MustRegister(m.HTTPRequestDuration, m.HTTPRequestsTotal, m.HTTPErrorsTotal)

	// Record a 500 error
	m.RecordHTTPRequest("POST", "/api/error", "500", 200*time.Millisecond)

	// Verify errors counter (should be 1 for 5xx)
	errorCount := testutil.ToFloat64(m.HTTPErrorsTotal.WithLabelValues("POST", "/api/error", "500"))
	assert.Equal(t, 1.0, errorCount)
}

func TestTimer(t *testing.T) {
	timer := NewTimer()
	assert.NotNil(t, timer)

	// Sleep for a known duration
	time.Sleep(10 * time.Millisecond)

	duration := timer.ObserveDuration()

	// Duration should be at least 10ms
	assert.GreaterOrEqual(t, duration, 10*time.Millisecond)
	// Duration should be less than 100ms (generous upper bound)
	assert.Less(t, duration, 100*time.Millisecond)
}

func TestRecordHTTPRequest_MultipleRequests(t *testing.T) {
	reg := prometheus.NewRegistry()

	m := &Metrics{
		HTTPRequestDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name: "test_multi_http_request_duration_seconds",
			},
			[]string{"method", "path", "status"},
		),
		HTTPRequestsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "test_multi_http_requests_total",
			},
			[]string{"method", "path", "status"},
		),
		HTTPErrorsTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "test_multi_http_errors_total",
			},
			[]string{"method", "path", "status"},
		),
	}

	reg.MustRegister(m.HTTPRequestDuration, m.HTTPRequestsTotal, m.HTTPErrorsTotal)

	// Record multiple requests
	m.RecordHTTPRequest("GET", "/api/users", "200", 50*time.Millisecond)
	m.RecordHTTPRequest("GET", "/api/users", "200", 60*time.Millisecond)
	m.RecordHTTPRequest("GET", "/api/users", "404", 30*time.Millisecond)
	m.RecordHTTPRequest("POST", "/api/users", "201", 100*time.Millisecond)

	// Verify total requests for GET 200
	count := testutil.ToFloat64(m.HTTPRequestsTotal.WithLabelValues("GET", "/api/users", "200"))
	assert.Equal(t, 2.0, count)

	// Verify total errors (only 404)
	errorCount := testutil.ToFloat64(m.HTTPErrorsTotal.WithLabelValues("GET", "/api/users", "404"))
	assert.Equal(t, 1.0, errorCount)

	// Verify POST 201
	postCount := testutil.ToFloat64(m.HTTPRequestsTotal.WithLabelValues("POST", "/api/users", "201"))
	assert.Equal(t, 1.0, postCount)
}
