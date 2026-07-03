package httpclient

import "time"

// CircuitBreaker is a minimal, process-local circuit breaker.
// It opens after N consecutive failures, then cools down for a period.
type CircuitBreaker struct {
	failThreshold int
	cooldown      time.Duration
	state         int // 0=closed,1=open
	fails         int
	openedAt      time.Time
}

func (cb *CircuitBreaker) Allow() bool {
	if cb == nil {
		return true
	}
	if cb.state == 0 {
		return true
	}
	// open: allow after cooldown (half-open probe)
	if time.Since(cb.openedAt) > cb.cooldown {
		return true
	}
	return false
}

func (cb *CircuitBreaker) Record(success bool) {
	if cb == nil {
		return
	}
	if success {
		cb.fails = 0
		cb.state = 0
		return
	}
	cb.fails++
	if cb.fails >= cb.failThreshold {
		cb.state = 1
		cb.openedAt = time.Now()
	}
}
