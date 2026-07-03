package cache

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"testing"
	"time"
)

// BenchmarkCacheSet benchmarks cache set operations
func BenchmarkCacheSet(b *testing.B) {
	cache := setupTestCache(b)
	ctx := context.Background()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			key := fmt.Sprintf("benchmark_key_%d", i)
			value := fmt.Sprintf("benchmark_value_%d", i)
			err := cache.Set(ctx, key, value, time.Hour)
			if err != nil {
				b.Fatal(err)
			}
			i++
		}
	})
}

// BenchmarkCacheGet benchmarks cache get operations
func BenchmarkCacheGet(b *testing.B) {
	cache := setupTestCache(b)
	ctx := context.Background()

	// Pre-populate cache
	for i := 0; i < 1000; i++ {
		key := fmt.Sprintf("benchmark_key_%d", i)
		value := fmt.Sprintf("benchmark_value_%d", i)
		cache.Set(ctx, key, value, time.Hour)
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			key := fmt.Sprintf("benchmark_key_%d", rand.Intn(1000))
			_, err := cache.Get(ctx, key)
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}

// BenchmarkCacheMixed benchmarks mixed cache operations
func BenchmarkCacheMixed(b *testing.B) {
	cache := setupTestCache(b)
	ctx := context.Background()

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			// 70% reads, 30% writes
			if rand.Float64() < 0.7 {
				// Read operation
				key := fmt.Sprintf("benchmark_key_%d", rand.Intn(1000))
				cache.Get(ctx, key)
			} else {
				// Write operation
				key := fmt.Sprintf("benchmark_key_%d", i)
				value := fmt.Sprintf("benchmark_value_%d", i)
				cache.Set(ctx, key, value, time.Hour)
				i++
			}
		}
	})
}

// BenchmarkCacheGetMultiple benchmarks batch get operations
func BenchmarkCacheGetMultiple(b *testing.B) {
	cache := setupTestCache(b)
	ctx := context.Background()

	// Pre-populate cache
	for i := 0; i < 100; i++ {
		key := fmt.Sprintf("batch_key_%d", i)
		value := fmt.Sprintf("batch_value_%d", i)
		cache.Set(ctx, key, value, time.Hour)
	}

	keys := make([]string, 100)
	for i := 0; i < 100; i++ {
		keys[i] = fmt.Sprintf("batch_key_%d", i)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := cache.GetMultiple(ctx, keys)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkCacheSetMultiple benchmarks batch set operations
func BenchmarkCacheSetMultiple(b *testing.B) {
	cache := setupTestCache(b)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		items := make(map[string]interface{})
		for j := 0; j < 100; j++ {
			key := fmt.Sprintf("batch_key_%d_%d", i, j)
			value := fmt.Sprintf("batch_value_%d_%d", i, j)
			items[key] = value
		}

		err := cache.SetMultiple(ctx, items, time.Hour)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// TestCacheConcurrency tests concurrent cache operations
func TestCacheConcurrency(t *testing.T) {
	cache := setupTestCache(t)
	ctx := context.Background()

	const numGoroutines = 100
	const numOperations = 1000

	var wg sync.WaitGroup
	wg.Add(numGoroutines * 2) // readers + writers

	// Writer goroutines
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numOperations; j++ {
				key := fmt.Sprintf("concurrent_key_%d_%d", id, j)
				value := fmt.Sprintf("concurrent_value_%d_%d", id, j)
				err := cache.Set(ctx, key, value, time.Hour)
				if err != nil {
					t.Errorf("Writer %d failed to set key %s: %v", id, key, err)
				}
			}
		}(i)
	}

	// Reader goroutines
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numOperations; j++ {
				key := fmt.Sprintf("concurrent_key_%d_%d", rand.Intn(numGoroutines), rand.Intn(numOperations))
				_, err := cache.Get(ctx, key)
				if err != nil {
					t.Errorf("Reader %d failed to get key %s: %v", id, key, err)
				}
			}
		}(i)
	}

	wg.Wait()
}

// TestCachePerformanceUnderLoad tests cache performance under high load
func TestCachePerformanceUnderLoad(t *testing.T) {
	cache := setupTestCache(t)
	ctx := context.Background()

	const numOperations = 10000
	const numWorkers = 50

	operations := make(chan int, numOperations)
	for i := 0; i < numOperations; i++ {
		operations <- i
	}
	close(operations)

	var wg sync.WaitGroup
	wg.Add(numWorkers)

	start := time.Now()

	// Worker goroutines
	for i := 0; i < numWorkers; i++ {
		go func() {
			defer wg.Done()
			for op := range operations {
				key := fmt.Sprintf("load_test_key_%d", op)
				value := fmt.Sprintf("load_test_value_%d", op)

				if op%2 == 0 {
					// Write operation
					err := cache.Set(ctx, key, value, time.Hour)
					if err != nil {
						t.Errorf("Failed to set key %s: %v", key, err)
					}
				} else {
					// Read operation
					_, err := cache.Get(ctx, key)
					if err != nil {
						// It's okay if reads miss during load test
					}
				}
			}
		}()
	}

	wg.Wait()
	duration := time.Since(start)

	opsPerSecond := float64(numOperations) / duration.Seconds()
	t.Logf("Completed %d operations in %v (%.2f ops/sec)", numOperations, duration, opsPerSecond)

	// Performance assertions
	if opsPerSecond < 1000 {
		t.Errorf("Performance too low: %.2f ops/sec (expected > 1000)", opsPerSecond)
	}

	if duration > time.Minute {
		t.Errorf("Test took too long: %v (expected < 1 minute)", duration)
	}
}

// TestCacheMemoryUsage tests cache memory usage patterns
func TestCacheMemoryUsage(t *testing.T) {
	cache := setupTestCache(t)
	ctx := context.Background()

	const numItems = 10000
	const valueSize = 1024 // 1KB per value

	// Create large values
	value := make([]byte, valueSize)
	for i := range value {
		value[i] = byte(i % 256)
	}

	// Fill cache
	for i := 0; i < numItems; i++ {
		key := fmt.Sprintf("memory_test_key_%d", i)
		err := cache.Set(ctx, key, value, time.Hour)
		if err != nil {
			t.Errorf("Failed to set key %s: %v", key, err)
		}
	}

	// Check cache stats
	stats, err := cache.GetStats(ctx)
	if err != nil {
		t.Fatalf("Failed to get cache stats: %v", err)
	}

	t.Logf("Cache stats: HitRate=%.2f, KeyCount=%d, MemoryUsage=%d bytes",
		stats.HitRate, stats.KeyCount, stats.MemoryUsage)

	// Memory usage should be reasonable (less than 500MB for 10K items of 1KB each)
	const maxExpectedMemory = 500 * 1024 * 1024 // 500MB
	if stats.MemoryUsage > maxExpectedMemory {
		t.Errorf("Memory usage too high: %d bytes (expected < %d)", stats.MemoryUsage, maxExpectedMemory)
	}
}

// TestCacheEviction tests cache eviction behavior
func TestCacheEviction(t *testing.T) {
	cache := setupTestCache(t)
	ctx := context.Background()

	const numItems = 20000 // More than typical cache capacity

	// Fill cache beyond capacity
	for i := 0; i < numItems; i++ {
		key := fmt.Sprintf("eviction_test_key_%d", i)
		value := fmt.Sprintf("eviction_test_value_%d", i)
		err := cache.Set(ctx, key, value, time.Hour)
		if err != nil {
			t.Errorf("Failed to set key %s: %v", key, err)
		}
	}

	// Check that some items were evicted
	stats, err := cache.GetStats(ctx)
	if err != nil {
		t.Fatalf("Failed to get cache stats: %v", err)
	}

	if stats.EvictionCount == 0 {
		t.Error("Expected some evictions but none occurred")
	}

	t.Logf("Cache evictions: %d, Keys in cache: %d", stats.EvictionCount, stats.KeyCount)

	// Verify that recently added items are still in cache
	recentlyAdded := fmt.Sprintf("eviction_test_key_%d", numItems-1)
	_, err = cache.Get(ctx, recentlyAdded)
	if err != nil {
		t.Errorf("Recently added item was evicted: %v", err)
	}
}

// TestCacheTTLBehavior tests cache TTL behavior
func TestCacheTTLBehavior(t *testing.T) {
	cache := setupTestCache(t)
	ctx := context.Background()

	// Set items with different TTLs
	err := cache.Set(ctx, "short_ttl", "value", time.Millisecond*100)
	if err != nil {
		t.Fatalf("Failed to set short TTL item: %v", err)
	}

	err = cache.Set(ctx, "long_ttl", "value", time.Hour)
	if err != nil {
		t.Fatalf("Failed to set long TTL item: %v", err)
	}

	// Verify both items exist initially
	_, err = cache.Get(ctx, "short_ttl")
	if err != nil {
		t.Errorf("Short TTL item not found immediately: %v", err)
	}

	_, err = cache.Get(ctx, "long_ttl")
	if err != nil {
		t.Errorf("Long TTL item not found immediately: %v", err)
	}

	// Wait for short TTL item to expire
	time.Sleep(time.Millisecond * 150)

	// Short TTL item should be gone
	_, err = cache.Get(ctx, "short_ttl")
	if err == nil {
		t.Error("Short TTL item should have expired but was found")
	}

	// Long TTL item should still exist
	_, err = cache.Get(ctx, "long_ttl")
	if err != nil {
		t.Errorf("Long TTL item should still exist: %v", err)
	}
}

// TestCacheInvalidation tests cache invalidation patterns
func TestCacheInvalidation(t *testing.T) {
	// Use a cache implementation that supports pattern deletion
	if defaultCache, ok := setupTestCache(t).(*DefaultCacheService); ok {
		ctx := context.Background()

		// Set multiple items with pattern
		for i := 0; i < 10; i++ {
			key := fmt.Sprintf("pattern:test_%d", i)
			value := fmt.Sprintf("value_%d", i)
			err := defaultCache.Set(ctx, key, value, time.Hour)
			if err != nil {
				t.Fatalf("Failed to set key %s: %v", key, err)
			}
		}

		// Verify items exist
		for i := 0; i < 10; i++ {
			key := fmt.Sprintf("pattern:test_%d", i)
			_, err := defaultCache.Get(ctx, key)
			if err != nil {
				t.Errorf("Item %s not found before invalidation: %v", key, err)
			}
		}

		// Delete by pattern
		err := defaultCache.DeletePattern(ctx, "pattern:test_*")
		if err != nil {
			t.Fatalf("Failed to delete by pattern: %v", err)
		}

		// Verify items are deleted
		for i := 0; i < 10; i++ {
			key := fmt.Sprintf("pattern:test_%d", i)
			_, err := defaultCache.Get(ctx, key)
			if err == nil {
				t.Errorf("Item %s found after pattern deletion", key)
			}
		}
	} else {
		t.Skip("Pattern deletion not supported by cache implementation")
	}
}

// setupTestCache creates a test cache instance
func setupTestCache(tb testing.TB) CacheService {
	// Create test configuration
	config := CacheConfig{
		Redis: RedisConfig{
			Addresses:    []string{"localhost:6379"},
			Database:     1, // Use database 1 for tests
			MaxRetries:   1,
			PoolSize:     5,
			DialTimeout:  1,
			ReadTimeout:  1,
			WriteTimeout: 1,
			IdleTimeout:  60,
			PoolTimeout:  5,
			MaxConnAge:   300,
		},
		DefaultTTL: time.Hour,
		Metrics: MetricsConfig{
			Enabled: false, // Disable metrics for tests
		},
		Domains: map[string]DomainConfig{
			"test": {
				Name: "test",
				TTL:  time.Hour,
			},
		},
	}

	logger := &testLogger{tb: tb}

	cache, err := NewCacheService(config, logger)
	if err != nil {
		tb.Fatalf("Failed to create test cache: %v", err)
	}

	// Clean up cache before test
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()
	cache.Flush(ctx)

	return cache
}

// testLogger implements Logger interface for testing
type testLogger struct {
	tb testing.TB
}

func (tl *testLogger) Info(msg string, fields ...interface{}) {
	tl.tb.Logf("[INFO] %s %v", msg, fields)
}

func (tl *testLogger) Error(msg string, fields ...interface{}) {
	tl.tb.Logf("[ERROR] %s %v", msg, fields)
}

func (tl *testLogger) Warn(msg string, fields ...interface{}) {
	tl.tb.Logf("[WARN] %s %v", msg, fields)
}

func (tl *testLogger) Debug(msg string, fields ...interface{}) {
	// Suppress debug logs in tests unless verbose
	if testing.Verbose() {
		tl.tb.Logf("[DEBUG] %s %v", msg, fields)
	}
}
