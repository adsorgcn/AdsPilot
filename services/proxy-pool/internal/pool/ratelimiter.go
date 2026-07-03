package pool

import (
	"sync"
	"time"
)

// RateLimiter implements token bucket algorithm
type RateLimiter struct {
	interval    time.Duration
	lastRequest time.Time
	mu          sync.Mutex
}

func NewRateLimiter(intervalMs int) *RateLimiter {
	return &RateLimiter{
		interval:    time.Duration(intervalMs) * time.Millisecond,
		lastRequest: time.Time{},
	}
}

// Acquire blocks until rate limit allows next request
func (r *RateLimiter) Acquire() {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(r.lastRequest)

	if elapsed < r.interval {
		waitTime := r.interval - elapsed
		time.Sleep(waitTime)
	}

	r.lastRequest = time.Now()
}
