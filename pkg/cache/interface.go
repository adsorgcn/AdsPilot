package cache

import (
	"context"
	"time"
)

// Store defines the interface for cache operations.
// Implementations must be safe for concurrent use.
type Store interface {
	// Get retrieves a value from cache. Returns (value, true) if found, ("", false) otherwise.
	Get(ctx context.Context, key string) (string, bool)

	// Set stores a value in cache with the given TTL.
	Set(ctx context.Context, key, value string, ttl time.Duration)

	// SetNX sets key only if it doesn't exist. Returns true if set, false if key already exists.
	// This operation should be atomic when possible.
	SetNX(ctx context.Context, key, value string, ttl time.Duration) (bool, error)

	// Del deletes a key from cache.
	Del(ctx context.Context, key string)

	// Ready returns true if the cache backend is available and healthy.
	Ready() bool
}
