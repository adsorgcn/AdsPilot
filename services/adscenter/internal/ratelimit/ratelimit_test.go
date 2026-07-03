package ratelimit

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNewLimiter tests limiter creation
func TestNewLimiter(t *testing.T) {
	tests := []struct {
		name string
		rpm  int
		conc int
	}{
		{
			name: "with rate and concurrency limits",
			rpm:  60,
			conc: 10,
		},
		{
			name: "with only rate limit",
			rpm:  60,
			conc: 0,
		},
		{
			name: "with only concurrency limit",
			rpm:  0,
			conc: 10,
		},
		{
			name: "no limits",
			rpm:  0,
			conc: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limiter := NewLimiter(tt.rpm, tt.conc)

			assert.NotNil(t, limiter)
			assert.Equal(t, tt.rpm, limiter.rpm)

			if tt.rpm > 0 {
				assert.NotNil(t, limiter.rateCh)
			} else {
				assert.Nil(t, limiter.rateCh)
			}

			if tt.conc > 0 {
				assert.NotNil(t, limiter.sem)
			} else {
				assert.Nil(t, limiter.sem)
			}
		})
	}
}

// TestLimiter_StartStop tests starting and stopping the limiter
func TestLimiter_StartStop(t *testing.T) {
	limiter := NewLimiter(60, 10)

	// Start should be idempotent
	limiter.Start()
	assert.True(t, limiter.started)

	limiter.Start() // Second call should be no-op
	assert.True(t, limiter.started)

	// Stop
	limiter.Stop()
}

// TestLimiter_Acquire tests acquiring rate and concurrency slots
func TestLimiter_Acquire(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping limiter acquire test in short mode")
	}

	t.Run("no limits", func(t *testing.T) {
		limiter := NewLimiter(0, 0)
		limiter.Start()
		defer limiter.Stop()

		ctx := context.Background()
		release, err := limiter.Acquire(ctx)

		require.NoError(t, err)
		assert.NotNil(t, release)
		release()
	})

	t.Run("with rate limit", func(t *testing.T) {
		limiter := NewLimiter(60, 0)
		limiter.Start()
		defer limiter.Stop()

		// Give it a moment to fill the channel
		time.Sleep(100 * time.Millisecond)

		ctx := context.Background()
		release, err := limiter.Acquire(ctx)

		require.NoError(t, err)
		assert.NotNil(t, release)
		release()
	})

	t.Run("with concurrency limit", func(t *testing.T) {
		limiter := NewLimiter(0, 2)
		limiter.Start()
		defer limiter.Stop()

		ctx := context.Background()

		// Acquire first slot
		release1, err := limiter.Acquire(ctx)
		require.NoError(t, err)

		// Acquire second slot
		release2, err := limiter.Acquire(ctx)
		require.NoError(t, err)

		// Release slots
		release1()
		release2()
	})

	t.Run("context cancellation", func(t *testing.T) {
		limiter := NewLimiter(1, 0) // Very low rate
		limiter.Start()
		defer limiter.Stop()

		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately

		_, err := limiter.Acquire(ctx)
		assert.Error(t, err)
		assert.Equal(t, context.Canceled, err)
	})
}

// TestRetry tests the retry mechanism
func TestRetry(t *testing.T) {
	tests := []struct {
		name         string
		attempts     int
		fn           func(context.Context) error
		wantError    bool
		wantAttempts int
	}{
		{
			name:     "success on first attempt",
			attempts: 3,
			fn: func(ctx context.Context) error {
				return nil
			},
			wantError:    false,
			wantAttempts: 1,
		},
		{
			name:     "non-retryable error",
			attempts: 3,
			fn: func(ctx context.Context) error {
				return errors.New("permanent error")
			},
			wantError:    true,
			wantAttempts: 1,
		},
		{
			name:     "retryable error exhausts attempts",
			attempts: 3,
			fn: func(ctx context.Context) error {
				return errors.New("timeout error")
			},
			wantError:    true,
			wantAttempts: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			attemptCount := 0

			fn := func(ctx context.Context) error {
				attemptCount++
				return tt.fn(ctx)
			}

			err := Retry(ctx, tt.attempts, 1*time.Millisecond, 10*time.Millisecond, fn)

			if tt.wantError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.wantAttempts, attemptCount)
		})
	}
}

// TestRetry_SuccessAfterRetries tests successful retry after failures
func TestRetry_SuccessAfterRetries(t *testing.T) {
	ctx := context.Background()
	attemptCount := 0

	fn := func(ctx context.Context) error {
		attemptCount++
		if attemptCount < 3 {
			return errors.New("timeout error") // Retryable
		}
		return nil // Success on third attempt
	}

	err := Retry(ctx, 5, 1*time.Millisecond, 10*time.Millisecond, fn)

	assert.NoError(t, err)
	assert.Equal(t, 3, attemptCount)
}

// TestRetry_ContextCancellation tests retry with context cancellation
func TestRetry_ContextCancellation(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping context cancellation test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	fn := func(ctx context.Context) error {
		time.Sleep(100 * time.Millisecond)
		return errors.New("timeout error")
	}

	err := Retry(ctx, 10, 10*time.Millisecond, 100*time.Millisecond, fn)

	assert.Error(t, err)
	assert.Equal(t, context.DeadlineExceeded, err)
}

// TestRetryable tests the retryable error detection
func TestRetryable(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "nil error",
			err:  nil,
			want: false,
		},
		{
			name: "timeout error",
			err:  errors.New("connection timeout"),
			want: true,
		},
		{
			name: "deadline error",
			err:  errors.New("deadline exceeded"),
			want: true,
		},
		{
			name: "429 error",
			err:  errors.New("http 429 too many requests"),
			want: true,
		},
		{
			name: "500 error",
			err:  errors.New("http 500 internal server error"),
			want: true,
		},
		{
			name: "503 error",
			err:  errors.New("http 503 service unavailable"),
			want: true,
		},
		{
			name: "400 error",
			err:  errors.New("http 400 bad request"),
			want: false,
		},
		{
			name: "404 error",
			err:  errors.New("http 404 not found"),
			want: false,
		},
		{
			name: "generic error",
			err:  errors.New("something went wrong"),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Retryable(tt.err)
			assert.Equal(t, tt.want, got)
		})
	}
}

// TestRetry_BackoffBehavior tests exponential backoff
func TestRetry_BackoffBehavior(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping backoff test in short mode")
	}

	ctx := context.Background()
	attemptTimes := []time.Time{}

	fn := func(ctx context.Context) error {
		attemptTimes = append(attemptTimes, time.Now())
		return errors.New("timeout error") // Always fail
	}

	base := 10 * time.Millisecond
	max := 50 * time.Millisecond

	_ = Retry(ctx, 4, base, max, fn)

	// Verify we made 4 attempts
	assert.Equal(t, 4, len(attemptTimes))

	// Verify backoff increases (with some tolerance for timing)
	if len(attemptTimes) >= 3 {
		delay1 := attemptTimes[1].Sub(attemptTimes[0])
		delay2 := attemptTimes[2].Sub(attemptTimes[1])

		// Second delay should be roughly 2x first delay (exponential backoff)
		// Allow for timing variance
		assert.True(t, delay2 >= delay1, "backoff should increase")
	}
}

// TestRetry_MaxBackoff tests that backoff respects max duration
func TestRetry_MaxBackoff(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping max backoff test in short mode")
	}

	ctx := context.Background()
	attemptTimes := []time.Time{}

	fn := func(ctx context.Context) error {
		attemptTimes = append(attemptTimes, time.Now())
		return errors.New("timeout error")
	}

	base := 10 * time.Millisecond
	max := 20 * time.Millisecond

	_ = Retry(ctx, 5, base, max, fn)

	// Verify delays don't exceed max
	for i := 1; i < len(attemptTimes); i++ {
		delay := attemptTimes[i].Sub(attemptTimes[i-1])
		// Allow some tolerance for timing
		assert.True(t, delay <= max+5*time.Millisecond, "delay should not exceed max")
	}
}

// TestRetry_MinAttempts tests that at least one attempt is made
func TestRetry_MinAttempts(t *testing.T) {
	ctx := context.Background()
	attemptCount := 0

	fn := func(ctx context.Context) error {
		attemptCount++
		return errors.New("error")
	}

	// Even with 0 attempts, should make at least 1
	_ = Retry(ctx, 0, 1*time.Millisecond, 10*time.Millisecond, fn)
	assert.Equal(t, 1, attemptCount)

	// Negative attempts should also make at least 1
	attemptCount = 0
	_ = Retry(ctx, -5, 1*time.Millisecond, 10*time.Millisecond, fn)
	assert.Equal(t, 1, attemptCount)
}

// BenchmarkLimiter_Acquire benchmarks the acquire operation
func BenchmarkLimiter_Acquire(b *testing.B) {
	limiter := NewLimiter(1000, 100)
	limiter.Start()
	defer limiter.Stop()

	// Give it time to fill
	time.Sleep(100 * time.Millisecond)

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		release, _ := limiter.Acquire(ctx)
		release()
	}
}

// BenchmarkRetryable benchmarks the retryable check
func BenchmarkRetryable(b *testing.B) {
	err := errors.New("http 500 internal server error")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = Retryable(err)
	}
}
