package circuitbreaker

import (
	"fmt"
	"time"

	"github.com/sony/gobreaker/v2"
)

// Breaker wraps gobreaker.CircuitBreaker with simplified configuration
type Breaker struct {
	*gobreaker.CircuitBreaker[any]
}

// Config holds circuit breaker configuration
type Config struct {
	// Name is the circuit breaker name for monitoring
	Name string

	// MaxRequests is the maximum number of requests allowed to pass through
	// when the circuit breaker is half-open (default: 1)
	MaxRequests uint32

	// Interval is the cyclic period of the closed state for the circuit breaker
	// to clear the internal counts. If Interval is 0, the circuit breaker doesn't
	// clear internal counts during the closed state (default: 0)
	Interval time.Duration

	// Timeout is the period of the open state, after which the state becomes half-open
	// If Timeout is 0, the timeout value is 60 seconds (default: 60s)
	Timeout time.Duration

	// ReadyToTrip is called with a copy of Counts whenever a request fails in the closed state.
	// If ReadyToTrip returns true, the circuit breaker will be placed into the open state.
	// If ReadyToTrip is nil, default ReadyToTrip is used (default: 5 consecutive failures)
	ReadyToTrip func(counts gobreaker.Counts) bool

	// OnStateChange is called whenever the state of the circuit breaker changes
	OnStateChange func(name string, from gobreaker.State, to gobreaker.State)
}

// NewBreaker creates a new circuit breaker with the given configuration
func NewBreaker(cfg Config) *Breaker {
	if cfg.Name == "" {
		cfg.Name = "default"
	}

	// Set defaults
	if cfg.MaxRequests == 0 {
		cfg.MaxRequests = 1
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 60 * time.Second
	}

	// Default ReadyToTrip: trip after 5 consecutive failures
	if cfg.ReadyToTrip == nil {
		cfg.ReadyToTrip = func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 3 && failureRatio >= 0.6
		}
	}

	settings := gobreaker.Settings{
		Name:        cfg.Name,
		MaxRequests: cfg.MaxRequests,
		Interval:    cfg.Interval,
		Timeout:     cfg.Timeout,
		ReadyToTrip: cfg.ReadyToTrip,
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			if cfg.OnStateChange != nil {
				cfg.OnStateChange(name, from, to)
			}
		},
	}

	return &Breaker{
		CircuitBreaker: gobreaker.NewCircuitBreaker[any](settings),
	}
}

// Execute runs the given function with circuit breaker protection
func (b *Breaker) Execute(fn func() (any, error)) (any, error) {
	return b.CircuitBreaker.Execute(fn)
}

// State returns the current state of the circuit breaker
func (b *Breaker) State() gobreaker.State {
	return b.CircuitBreaker.State()
}

// Counts returns a copy of the internal counts
func (b *Breaker) Counts() gobreaker.Counts {
	return b.CircuitBreaker.Counts()
}

// DefaultConfig returns a sensible default configuration for HTTP clients
func DefaultConfig(name string) Config {
	return Config{
		Name:        name,
		MaxRequests: 3,
		Interval:    60 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			// Trip if:
			// - At least 5 requests have been made
			// - Failure rate is >= 50%
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 5 && failureRatio >= 0.5
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			// Default logging (can be overridden)
			fmt.Printf("[CircuitBreaker] %s state changed: %s -> %s\n", name, from, to)
		},
	}
}
