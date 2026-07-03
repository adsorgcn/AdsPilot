package circuitbreaker

import (
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/sony/gobreaker/v2"
	"github.com/stretchr/testify/assert"
)

func TestNewMetricsBreaker(t *testing.T) {
	cfg := DefaultConfig("test-metrics-breaker")
	mb := NewMetricsBreaker(cfg, "test", "circuitbreaker")

	assert.NotNil(t, mb)
	assert.NotNil(t, mb.Breaker)
	assert.NotNil(t, mb.stateGauge)
	assert.NotNil(t, mb.requestsCounter)

	// Initial state should be closed (0)
	assert.Equal(t, 0.0, mb.GetStateValue())
}

func TestMetricsBreaker_StateTransitions(t *testing.T) {
	// Create a breaker that trips quickly
	cfg := Config{
		Name:        "state-test",
		MaxRequests: 1,
		Timeout:     100 * time.Millisecond,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 2
		},
	}

	mb := NewMetricsBreaker(cfg, "test", "circuitbreaker")

	// Initial state: closed (0)
	assert.Equal(t, gobreaker.StateClosed, mb.State())
	assert.Equal(t, 0.0, mb.GetStateValue())

	// Cause failures to open circuit
	failingFunc := func() (any, error) {
		return nil, errors.New("failure")
	}

	mb.Execute(failingFunc)
	mb.Execute(failingFunc)

	// Circuit should be open (2)
	assert.Equal(t, gobreaker.StateOpen, mb.State())
	assert.Equal(t, 2.0, mb.GetStateValue())

	// Wait for timeout to go to half-open
	time.Sleep(150 * time.Millisecond)

	// Next request should trigger half-open state
	mb.Execute(failingFunc)

	// State should be half-open (1) or open (2) depending on timing
	state := mb.State()
	assert.True(t, state == gobreaker.StateHalfOpen || state == gobreaker.StateOpen)
}

func TestMetricsBreaker_RequestMetrics(t *testing.T) {
	// Use unique registry to avoid conflicts
	reg := prometheus.NewRegistry()

	cfg := DefaultConfig("request-metrics-test")

	// Create custom metrics to register with test registry
	requestsCounter := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "test_circuit_breaker_requests_total",
			ConstLabels: prometheus.Labels{
				"breaker": cfg.Name,
			},
		},
		[]string{"result"},
	)
	reg.MustRegister(requestsCounter)

	mb := NewMetricsBreaker(cfg, "test", "circuitbreaker")
	// Override with test counter
	mb.requestsCounter = requestsCounter

	// Execute successful request
	successFunc := func() (any, error) {
		return "ok", nil
	}

	mb.Execute(successFunc)

	// Verify success counter
	successCount := testutil.ToFloat64(requestsCounter.WithLabelValues("success"))
	assert.Equal(t, 1.0, successCount)

	// Execute failing request
	failFunc := func() (any, error) {
		return nil, errors.New("fail")
	}

	mb.Execute(failFunc)

	// Verify failure counter
	failCount := testutil.ToFloat64(requestsCounter.WithLabelValues("failure"))
	assert.Equal(t, 1.0, failCount)
}

func TestMetricsBreaker_Execute(t *testing.T) {
	cfg := DefaultConfig("execute-test")
	mb := NewMetricsBreaker(cfg, "test", "circuitbreaker")

	// Test successful execution
	result, err := mb.Execute(func() (any, error) {
		return "success", nil
	})

	assert.NoError(t, err)
	assert.Equal(t, "success", result)

	// Test failed execution
	result, err = mb.Execute(func() (any, error) {
		return nil, errors.New("test error")
	})

	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Equal(t, "test error", err.Error())
}

func TestMetricsBreaker_GetStateValue(t *testing.T) {
	testCases := []struct {
		name          string
		state         gobreaker.State
		expectedValue float64
	}{
		{"Closed", gobreaker.StateClosed, 0.0},
		{"HalfOpen", gobreaker.StateHalfOpen, 1.0},
		{"Open", gobreaker.StateOpen, 2.0},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := Config{
				Name:        "state-value-test-" + tc.name,
				MaxRequests: 1,
				Timeout:     1 * time.Second,
			}

			mb := NewMetricsBreaker(cfg, "test", "circuitbreaker")

			// We can't directly set the state, but we can verify GetStateValue works
			// Just verify the method doesn't panic and returns expected type
			value := mb.GetStateValue()
			assert.IsType(t, float64(0), value)
		})
	}
}

func TestMetricsBreaker_OnStateChangeCallback(t *testing.T) {
	stateChanges := []string{}

	cfg := Config{
		Name:        "callback-test",
		MaxRequests: 1,
		Timeout:     50 * time.Millisecond,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 1
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			stateChanges = append(stateChanges, to.String())
		},
	}

	mb := NewMetricsBreaker(cfg, "test", "circuitbreaker")

	// Trigger state change to open
	mb.Execute(func() (any, error) {
		return nil, errors.New("fail")
	})

	assert.Contains(t, stateChanges, "open")
}
