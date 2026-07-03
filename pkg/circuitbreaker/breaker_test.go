package circuitbreaker

import (
	"errors"
	"testing"
	"time"

	"github.com/sony/gobreaker/v2"
)

func TestNewBreaker(t *testing.T) {
	t.Run("creates breaker with default config", func(t *testing.T) {
		cfg := DefaultConfig("test-service")
		breaker := NewBreaker(cfg)

		if breaker == nil {
			t.Fatal("NewBreaker returned nil")
		}

		if breaker.State() != gobreaker.StateClosed {
			t.Errorf("Initial state should be Closed, got %v", breaker.State())
		}
	})

	t.Run("uses provided name", func(t *testing.T) {
		cfg := Config{Name: "custom-service"}
		breaker := NewBreaker(cfg)

		counts := breaker.Counts()
		if counts.Requests != 0 {
			t.Errorf("Initial request count should be 0, got %d", counts.Requests)
		}
	})

	t.Run("sets default values", func(t *testing.T) {
		cfg := Config{}
		breaker := NewBreaker(cfg)

		if breaker == nil {
			t.Fatal("NewBreaker returned nil")
		}

		// Verify default timeout by checking state doesn't change immediately
		state := breaker.State()
		if state != gobreaker.StateClosed {
			t.Errorf("Expected StateClosed, got %v", state)
		}
	})
}

func TestBreakerExecution(t *testing.T) {
	t.Run("successful execution", func(t *testing.T) {
		breaker := NewBreaker(DefaultConfig("test"))

		result, err := breaker.Execute(func() (any, error) {
			return "success", nil
		})

		if err != nil {
			t.Errorf("Execute() error = %v, want nil", err)
		}
		if result != "success" {
			t.Errorf("Execute() result = %v, want 'success'", result)
		}

		counts := breaker.Counts()
		if counts.TotalSuccesses != 1 {
			t.Errorf("TotalSuccesses = %d, want 1", counts.TotalSuccesses)
		}
	})

	t.Run("failed execution", func(t *testing.T) {
		breaker := NewBreaker(DefaultConfig("test"))

		_, err := breaker.Execute(func() (any, error) {
			return nil, errors.New("test error")
		})

		if err == nil {
			t.Error("Execute() expected error, got nil")
		}

		counts := breaker.Counts()
		if counts.TotalFailures != 1 {
			t.Errorf("TotalFailures = %d, want 1", counts.TotalFailures)
		}
	})
}

func TestBreakerStateTransitions(t *testing.T) {
	t.Run("transitions to open after failures", func(t *testing.T) {
		stateChanges := []gobreaker.State{}
		cfg := Config{
			Name:        "test",
			MaxRequests: 1,
			Timeout:     100 * time.Millisecond,
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				// Trip after 3 failures
				return counts.ConsecutiveFailures >= 3
			},
			OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
				stateChanges = append(stateChanges, to)
			},
		}
		breaker := NewBreaker(cfg)

		// Trigger 3 failures to open the circuit
		for i := 0; i < 3; i++ {
			_, _ = breaker.Execute(func() (any, error) {
				return nil, errors.New("fail")
			})
		}

		if breaker.State() != gobreaker.StateOpen {
			t.Errorf("State should be Open after failures, got %v", breaker.State())
		}

		if len(stateChanges) == 0 || stateChanges[0] != gobreaker.StateOpen {
			t.Errorf("Expected state change to Open, got %v", stateChanges)
		}
	})

	t.Run("transitions to half-open after timeout", func(t *testing.T) {
		cfg := Config{
			Name:        "test",
			MaxRequests: 1,
			Timeout:     50 * time.Millisecond,
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				return counts.ConsecutiveFailures >= 2
			},
		}
		breaker := NewBreaker(cfg)

		// Open the circuit
		for i := 0; i < 2; i++ {
			_, _ = breaker.Execute(func() (any, error) {
				return nil, errors.New("fail")
			})
		}

		if breaker.State() != gobreaker.StateOpen {
			t.Errorf("State should be Open, got %v", breaker.State())
		}

		// Wait for timeout
		time.Sleep(60 * time.Millisecond)

		// Execute should transition to half-open
		_, err := breaker.Execute(func() (any, error) {
			return "test", nil
		})

		if err != nil {
			t.Errorf("Execute() in half-open should succeed, got error: %v", err)
		}

		// After successful execution in half-open, should be closed
		if breaker.State() != gobreaker.StateClosed {
			t.Errorf("State should be Closed after successful half-open execution, got %v", breaker.State())
		}
	})

	t.Run("rejects requests when open", func(t *testing.T) {
		cfg := Config{
			Name:    "test",
			Timeout: 1 * time.Second, // Long timeout to keep it open
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				return counts.ConsecutiveFailures >= 1
			},
		}
		breaker := NewBreaker(cfg)

		// Open the circuit
		_, _ = breaker.Execute(func() (any, error) {
			return nil, errors.New("fail")
		})

		// Try to execute when open
		_, err := breaker.Execute(func() (any, error) {
			t.Error("Function should not be called when circuit is open")
			return nil, nil
		})

		if err == nil {
			t.Error("Execute() should return error when circuit is open")
		}

		if !errors.Is(err, gobreaker.ErrOpenState) {
			t.Errorf("Expected ErrOpenState, got %v", err)
		}
	})
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig("test-service")

	if cfg.Name != "test-service" {
		t.Errorf("Name = %s, want 'test-service'", cfg.Name)
	}

	if cfg.MaxRequests != 3 {
		t.Errorf("MaxRequests = %d, want 3", cfg.MaxRequests)
	}

	if cfg.Interval != 60*time.Second {
		t.Errorf("Interval = %v, want 60s", cfg.Interval)
	}

	if cfg.Timeout != 30*time.Second {
		t.Errorf("Timeout = %v, want 30s", cfg.Timeout)
	}

	if cfg.ReadyToTrip == nil {
		t.Error("ReadyToTrip should not be nil")
	}

	if cfg.OnStateChange == nil {
		t.Error("OnStateChange should not be nil")
	}
}

func TestDefaultReadyToTrip(t *testing.T) {
	cfg := DefaultConfig("test")

	tests := []struct {
		name     string
		counts   gobreaker.Counts
		wantTrip bool
	}{
		{
			name: "not enough requests",
			counts: gobreaker.Counts{
				Requests:      3,
				TotalFailures: 3,
			},
			wantTrip: false,
		},
		{
			name: "50% failure rate with enough requests",
			counts: gobreaker.Counts{
				Requests:      10,
				TotalFailures: 5,
			},
			wantTrip: true,
		},
		{
			name: "less than 50% failure rate",
			counts: gobreaker.Counts{
				Requests:      10,
				TotalFailures: 4,
			},
			wantTrip: false,
		},
		{
			name: "all failures",
			counts: gobreaker.Counts{
				Requests:      5,
				TotalFailures: 5,
			},
			wantTrip: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := cfg.ReadyToTrip(tt.counts)
			if got != tt.wantTrip {
				t.Errorf("ReadyToTrip() = %v, want %v", got, tt.wantTrip)
			}
		})
	}
}

func TestBreakerCounts(t *testing.T) {
	breaker := NewBreaker(DefaultConfig("test"))

	// Execute some requests
	_, _ = breaker.Execute(func() (any, error) { return "ok", nil })
	_, _ = breaker.Execute(func() (any, error) { return nil, errors.New("fail") })
	_, _ = breaker.Execute(func() (any, error) { return "ok", nil })

	counts := breaker.Counts()

	if counts.Requests != 3 {
		t.Errorf("Requests = %d, want 3", counts.Requests)
	}
	if counts.TotalSuccesses != 2 {
		t.Errorf("TotalSuccesses = %d, want 2", counts.TotalSuccesses)
	}
	if counts.TotalFailures != 1 {
		t.Errorf("TotalFailures = %d, want 1", counts.TotalFailures)
	}
}
