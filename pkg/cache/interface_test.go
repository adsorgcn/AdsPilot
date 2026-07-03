package cache

import (
	"context"
	"testing"
	"time"
)

// TestCacheImplementsStore verifies that Cache implements the Store interface
func TestCacheImplementsStore(t *testing.T) {
	var _ Store = (*Cache)(nil) // Compile-time interface check
}

// TestStoreInterface tests the Store interface contract
func TestStoreInterface(t *testing.T) {
	// Test with in-memory cache (no Redis)
	t.Setenv("REDIS_URL", "")
	cache := NewFromEnv()
	testStore(t, cache)
}

func testStore(t *testing.T, store Store) {
	ctx := context.Background()

	t.Run("Get non-existent key", func(t *testing.T) {
		val, ok := store.Get(ctx, "nonexistent")
		if ok {
			t.Errorf("Get() returned true for non-existent key, got value: %s", val)
		}
		if val != "" {
			t.Errorf("Get() returned non-empty value for non-existent key: %s", val)
		}
	})

	t.Run("Set and Get", func(t *testing.T) {
		key := "test_key"
		value := "test_value"

		store.Set(ctx, key, value, 1*time.Hour)

		got, ok := store.Get(ctx, key)
		if !ok {
			t.Error("Get() returned false for existing key")
		}
		if got != value {
			t.Errorf("Get() = %s, want %s", got, value)
		}
	})

	t.Run("SetNX - key does not exist", func(t *testing.T) {
		key := "nx_test_new"
		value := "value1"

		// Delete first to ensure clean state
		store.Del(ctx, key)

		ok, err := store.SetNX(ctx, key, value, 1*time.Hour)
		if err != nil {
			t.Errorf("SetNX() error = %v", err)
		}
		if !ok {
			t.Error("SetNX() should return true for new key")
		}

		got, exists := store.Get(ctx, key)
		if !exists || got != value {
			t.Errorf("SetNX() did not set value correctly, got %s, want %s", got, value)
		}
	})

	t.Run("SetNX - key exists", func(t *testing.T) {
		key := "nx_test_existing"
		value1 := "value1"
		value2 := "value2"

		// Set initial value
		store.Set(ctx, key, value1, 1*time.Hour)

		// Try to set again with SetNX
		ok, err := store.SetNX(ctx, key, value2, 1*time.Hour)
		if err != nil {
			t.Errorf("SetNX() error = %v", err)
		}
		if ok {
			t.Error("SetNX() should return false for existing key")
		}

		// Value should still be value1
		got, exists := store.Get(ctx, key)
		if !exists || got != value1 {
			t.Errorf("SetNX() modified existing value, got %s, want %s", got, value1)
		}
	})

	t.Run("Del", func(t *testing.T) {
		key := "del_test"
		value := "value"

		store.Set(ctx, key, value, 1*time.Hour)
		store.Del(ctx, key)

		_, ok := store.Get(ctx, key)
		if ok {
			t.Error("Get() returned true for deleted key")
		}
	})

	t.Run("TTL expiration", func(t *testing.T) {
		key := "ttl_test"
		value := "value"

		// Set with very short TTL
		store.Set(ctx, key, value, 50*time.Millisecond)

		// Should exist immediately
		_, ok := store.Get(ctx, key)
		if !ok {
			t.Error("Get() returned false immediately after Set()")
		}

		// Wait for expiration
		time.Sleep(100 * time.Millisecond)

		// Should not exist after expiration
		_, ok = store.Get(ctx, key)
		if ok {
			t.Error("Get() returned true after TTL expiration")
		}
	})

	t.Run("Ready", func(t *testing.T) {
		// For in-memory cache, Ready() may return false (no Redis)
		// Just verify it doesn't panic
		_ = store.Ready()
	})
}

// TestCacheReady tests the Ready() method behavior
func TestCacheReady(t *testing.T) {
	t.Run("In-memory cache not ready", func(t *testing.T) {
		t.Setenv("REDIS_URL", "")
		cache := NewFromEnv()
		if cache.Ready() {
			t.Error("In-memory cache should not be ready (no Redis)")
		}
	})

	t.Run("Invalid Redis URL", func(t *testing.T) {
		t.Setenv("REDIS_URL", "invalid://url")
		cache := NewFromEnv()
		if cache.Ready() {
			t.Error("Cache with invalid Redis URL should not be ready")
		}
	})
}

// BenchmarkCacheOperations benchmarks basic cache operations
func BenchmarkCacheOperations(b *testing.B) {
	cache := NewFromEnv()
	ctx := context.Background()

	b.Run("Set", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			cache.Set(ctx, "bench_key", "bench_value", 1*time.Hour)
		}
	})

	b.Run("Get", func(b *testing.B) {
		cache.Set(ctx, "bench_key", "bench_value", 1*time.Hour)
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			cache.Get(ctx, "bench_key")
		}
	})

	b.Run("SetNX", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			cache.SetNX(ctx, "bench_nx_key", "bench_value", 1*time.Hour)
		}
	})

	b.Run("Del", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			cache.Set(ctx, "bench_del_key", "bench_value", 1*time.Hour)
			cache.Del(ctx, "bench_del_key")
		}
	})
}
