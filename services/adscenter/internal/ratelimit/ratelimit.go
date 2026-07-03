package ratelimit

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"
)

// Limiter provides a simple RPM token bucket + concurrency semaphore.
type Limiter struct {
	rpm     int
	rateCh  chan struct{}
	sem     chan struct{}
	stopCh  chan struct{}
	started bool
	mu      sync.Mutex
}

// NewLimiter creates a limiter with tokens-per-minute and max concurrency.
// rpm<=0 disables rate limiting; conc<=0 disables concurrency limiting.
func NewLimiter(rpm, conc int) *Limiter {
	l := &Limiter{rpm: rpm}
	if rpm > 0 {
		l.rateCh = make(chan struct{}, rpm)
	}
	if conc > 0 {
		l.sem = make(chan struct{}, conc)
	}
	l.stopCh = make(chan struct{})
	return l
}

// Start launches the refill goroutine for RPM limiting. Idempotent.
func (l *Limiter) Start() {
	l.mu.Lock()
	if l.started {
		l.mu.Unlock()
		return
	}
	l.started = true
	l.mu.Unlock()
	if l.rpm <= 0 || l.rateCh == nil {
		return
	}
	go func() {
		// Try to distribute tokens evenly across the minute
		interval := time.Minute
		if l.rpm > 0 {
			interval = time.Duration(int(time.Minute) / l.rpm)
		}
		if interval <= 0 {
			interval = time.Second
		}
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-l.stopCh:
				return
			case <-t.C:
				select {
				case l.rateCh <- struct{}{}:
				default:
				}
			}
		}
	}()
}

// Stop signals the refill goroutine to stop.
func (l *Limiter) Stop() { close(l.stopCh) }

// Acquire blocks until both a rate token and concurrency slot are available (if configured), or ctx cancels.
// Returns a release function to free the concurrency slot.
func (l *Limiter) Acquire(ctx context.Context) (func(), error) {
	// rate
	if l.rateCh != nil {
		select {
		case <-ctx.Done():
			return func() {}, ctx.Err()
		case <-l.rateCh:
		}
	}
	// concurrency
	if l.sem != nil {
		select {
		case <-ctx.Done():
			return func() {}, ctx.Err()
		case l.sem <- struct{}{}:
			return func() { <-l.sem }, nil
		}
	}
	return func() {}, nil
}

// Retry executes fn with simple exponential backoff on retryable errors.
// attempts>=1; base is initial backoff; max is maximum backoff per step.
func Retry(ctx context.Context, attempts int, base, max time.Duration, fn func(context.Context) error) error {
	if attempts < 1 {
		attempts = 1
	}
	var err error
	d := base
	for i := 0; i < attempts; i++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err = fn(ctx); err == nil {
			return nil
		}
		if !Retryable(err) || i == attempts-1 {
			break
		}
		// sleep with backoff or until ctx cancel
		wait := d
		if wait > max {
			wait = max
		}
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
		d *= 2
	}
	return err
}

// Retryable heuristically decides whether an error is transient.
func Retryable(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	if strings.Contains(s, "timeout") || strings.Contains(s, "deadline") {
		return true
	}
	if strings.Contains(s, "http 429") {
		return true
	}
	if strings.Contains(s, "http 5") {
		return true
	} // 5xx family
	return false
}

var ErrCanceled = errors.New("canceled")
