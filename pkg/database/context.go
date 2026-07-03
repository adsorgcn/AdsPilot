package database

import (
	"context"
	"time"
)

// DefaultQueryTimeout is the default timeout for database queries (10 seconds)
const DefaultQueryTimeout = 10 * time.Second

// WithQueryTimeout creates a context with a query timeout
// This prevents one user's slow query from affecting other users
// If timeout is 0, DefaultQueryTimeout is used
func WithQueryTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if timeout == 0 {
		timeout = DefaultQueryTimeout
	}
	return context.WithTimeout(ctx, timeout)
}

// WithShortQueryTimeout creates a context with a 5-second timeout
// Use this for simple queries that should complete quickly
func WithShortQueryTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, 5*time.Second)
}

// WithMediumQueryTimeout creates a context with a 30-second timeout
// Use this for complex queries or batch operations
func WithMediumQueryTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, 30*time.Second)
}

// WithLongQueryTimeout creates a context with a 60-second timeout
// Use this for heavy analytics or bulk operations
func WithLongQueryTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, 60*time.Second)
}
