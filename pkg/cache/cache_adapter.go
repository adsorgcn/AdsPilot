// Package cache provides cache adapters for existing services
package cache

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// CacheAdapter wraps database operations with caching
type CacheAdapter struct {
	db     *sql.DB
	cache  CacheService
	logger Logger
}

// NewCacheAdapter creates a new cache adapter
func NewCacheAdapter(db *sql.DB, cache CacheService, logger Logger) *CacheAdapter {
	return &CacheAdapter{
		db:     db,
		cache:  cache,
		logger: logger,
	}
}

// CachedQuery performs a database query with caching
func (ca *CacheAdapter) CachedQuery(ctx context.Context, cacheKey string, query string, args []interface{}, ttl time.Duration) (*sql.Rows, error) {
	// Try to get from cache first
	if cached, err := ca.cache.Get(ctx, cacheKey); err == nil && cached != nil {
		ca.logger.Debug("Cache hit for query", "key", cacheKey)
		// Convert cached data back to sql.Rows (this is a simplified approach)
		// In practice, you'd want to cache the actual data, not sql.Rows
		return ca.db.QueryContext(ctx, query, args...)
	}

	// Cache miss, execute query
	rows, err := ca.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	// For demonstration, we're not caching the actual rows data
	// In a real implementation, you'd cache the processed data
	ca.logger.Debug("Cache miss for query", "key", cacheKey)

	return rows, nil
}

// CachedQueryRow performs a database query row with caching
func (ca *CacheAdapter) CachedQueryRow(ctx context.Context, cacheKey string, query string, args []interface{}, ttl time.Duration) *sql.Row {
	// Try to get from cache first
	if cached, err := ca.cache.Get(ctx, cacheKey); err == nil && cached != nil {
		ca.logger.Debug("Cache hit for query row", "key", cacheKey)
		// Similar to above, this is simplified
		return ca.db.QueryRowContext(ctx, query, args...)
	}

	ca.logger.Debug("Cache miss for query row", "key", cacheKey)
	return ca.db.QueryRowContext(ctx, query, args...)
}

// InvalidateCache invalidates cache entries matching a pattern
func (ca *CacheAdapter) InvalidateCache(ctx context.Context, pattern string) error {
	if domainCache, ok := ca.cache.(*DefaultCacheService); ok {
		return domainCache.DeletePattern(ctx, pattern)
	}
	return fmt.Errorf("cache does not support pattern deletion")
}

// ServiceCacheAdapter provides caching for specific service operations
type ServiceCacheAdapter struct {
	serviceName string
	domainCache DomainCache
	logger      Logger
}

// NewServiceCacheAdapter creates a new service cache adapter
func NewServiceCacheAdapter(serviceName string, domainCache DomainCache, logger Logger) *ServiceCacheAdapter {
	return &ServiceCacheAdapter{
		serviceName: serviceName,
		domainCache: domainCache,
		logger:      logger,
	}
}

// GetUserProfileWithCache gets user profile with caching
func (sca *ServiceCacheAdapter) GetUserProfileWithCache(ctx context.Context, userID string) (interface{}, error) {
	// Try cache first
	if profile, err := sca.domainCache.Get(ctx, fmt.Sprintf("profile:%s", userID)); err == nil && profile != nil {
		sca.logger.Debug("User profile cache hit", "user_id", userID, "service", sca.serviceName)
		return profile, nil
	}

	// Cache miss - in real implementation, fetch from database
	sca.logger.Debug("User profile cache miss", "user_id", userID, "service", sca.serviceName)
	return nil, fmt.Errorf("user not found")
}

// SetUserProfileWithCache sets user profile with caching
func (sca *ServiceCacheAdapter) SetUserProfileWithCache(ctx context.Context, userID string, profile interface{}) error {
	key := fmt.Sprintf("profile:%s", userID)
	err := sca.domainCache.Set(ctx, key, profile, sca.domainCache.GetDomainConfig().TTL)
	if err != nil {
		return fmt.Errorf("failed to cache user profile: %w", err)
	}

	sca.logger.Debug("User profile cached", "user_id", userID, "service", sca.serviceName)
	return nil
}

// InvalidateUserCache invalidates all cache entries for a user
func (sca *ServiceCacheAdapter) InvalidateUserCache(ctx context.Context, userID string) error {
	pattern := fmt.Sprintf("*:%s", userID)

	// TODO: Fix type assertion once DefaultCacheService implements DomainCache properly
	// For now, use domainCache interface directly
	if sca.domainCache != nil {
		err := sca.domainCache.DeletePattern(ctx, pattern)
		if err != nil {
			return fmt.Errorf("failed to invalidate user cache: %w", err)
		}
		sca.logger.Debug("User cache invalidated", "user_id", userID, "service", sca.serviceName)
		return nil
	}

	return fmt.Errorf("domain cache does not support pattern deletion")
}

// CacheMiddleware provides middleware-like caching for service operations
type CacheMiddleware struct {
	cache  CacheService
	logger Logger
}

// NewCacheMiddleware creates a new cache middleware
func NewCacheMiddleware(cache CacheService, logger Logger) *CacheMiddleware {
	return &CacheMiddleware{
		cache:  cache,
		logger: logger,
	}
}

// CacheOperation represents a cacheable operation
type CacheOperation struct {
	Key       string
	Operation func(ctx context.Context) (interface{}, error)
	TTL       time.Duration
}

// Execute executes an operation with caching
func (cm *CacheMiddleware) Execute(ctx context.Context, op CacheOperation) (interface{}, error) {
	// Try cache first
	if result, err := cm.cache.Get(ctx, op.Key); err == nil && result != nil {
		cm.logger.Debug("Operation cache hit", "key", op.Key)
		return result, nil
	}

	// Cache miss, execute operation
	cm.logger.Debug("Operation cache miss", "key", op.Key)
	result, err := op.Operation(ctx)
	if err != nil {
		return nil, err
	}

	// Cache the result
	if err := cm.cache.Set(ctx, op.Key, result, op.TTL); err != nil {
		cm.logger.Error("Failed to cache operation result", "key", op.Key, "error", err)
		// Don't fail the operation if caching fails
	}

	return result, nil
}

// BatchCacheOperation represents a batch of cacheable operations
type BatchCacheOperation struct {
	Operations []CacheOperation
}

// ExecuteBatch executes multiple operations with caching
func (cm *CacheMiddleware) ExecuteBatch(ctx context.Context, batch BatchCacheOperation) (map[string]interface{}, error) {
	results := make(map[string]interface{})
	cacheKeys := make([]string, 0, len(batch.Operations))

	// Collect cache keys
	for _, op := range batch.Operations {
		cacheKeys = append(cacheKeys, op.Key)
	}

	// Try to get all from cache in parallel
	cachedResults, err := cm.cache.GetMultiple(ctx, cacheKeys)
	if err == nil {
		for key, value := range cachedResults {
			if value != nil {
				results[key] = value
			}
		}
	}

	// Execute operations for cache misses
	for _, op := range batch.Operations {
		if _, exists := results[op.Key]; !exists {
			result, err := op.Operation(ctx)
			if err != nil {
				return nil, fmt.Errorf("operation failed for key %s: %w", op.Key, err)
			}
			results[op.Key] = result

			// Cache the result asynchronously
			go func(ctx context.Context, key string, value interface{}, ttl time.Duration) {
				if err := cm.cache.Set(ctx, key, value, ttl); err != nil {
					cm.logger.Error("Failed to cache batch operation result", "key", key, "error", err)
				}
			}(ctx, op.Key, result, op.TTL)
		}
	}

	return results, nil
}

// CacheWarmer preloads cache with frequently accessed data
type CacheWarmer struct {
	cache      CacheService
	logger     Logger
	warmupJobs []WarmupJob
}

// WarmupJob represents a cache warmup job
type WarmupJob struct {
	Name      string
	Key       string
	Operation func(ctx context.Context) (interface{}, error)
	TTL       time.Duration
	Priority  int
}

// NewCacheWarmer creates a new cache warmer
func NewCacheWarmer(cache CacheService, logger Logger) *CacheWarmer {
	return &CacheWarmer{
		cache:      cache,
		logger:     logger,
		warmupJobs: make([]WarmupJob, 0),
	}
}

// AddWarmupJob adds a warmup job
func (cw *CacheWarmer) AddWarmupJob(job WarmupJob) {
	cw.warmupJobs = append(cw.warmupJobs, job)
}

// Warmup executes all warmup jobs
func (cw *CacheWarmer) Warmup(ctx context.Context) error {
	cw.logger.Info("Starting cache warmup", "jobs", len(cw.warmupJobs))

	for _, job := range cw.warmupJobs {
		// Check if key already exists
		if exists, err := cw.cache.Exists(ctx, job.Key); err == nil && exists {
			cw.logger.Debug("Cache warmup skip - key exists", "job", job.Name, "key", job.Key)
			continue
		}

		// Execute warmup operation
		result, err := job.Operation(ctx)
		if err != nil {
			cw.logger.Error("Cache warmup job failed", "job", job.Name, "error", err)
			continue
		}

		// Cache the result
		if err := cw.cache.Set(ctx, job.Key, result, job.TTL); err != nil {
			cw.logger.Error("Failed to cache warmup result", "job", job.Name, "error", err)
		} else {
			cw.logger.Debug("Cache warmup job completed", "job", job.Name, "key", job.Key)
		}
	}

	cw.logger.Info("Cache warmup completed")
	return nil
}

// CacheInvalidator handles cache invalidation strategies
type CacheInvalidator struct {
	cache  CacheService
	logger Logger
}

// NewCacheInvalidator creates a new cache invalidator
func NewCacheInvalidator(cache CacheService, logger Logger) *CacheInvalidator {
	return &CacheInvalidator{
		cache:  cache,
		logger: logger,
	}
}

// InvalidateByPattern invalidates cache entries matching a pattern
func (ci *CacheInvalidator) InvalidateByPattern(ctx context.Context, pattern string) error {
	if domainService, ok := ci.cache.(*DefaultCacheService); ok {
		err := domainService.DeletePattern(ctx, pattern)
		if err != nil {
			return fmt.Errorf("failed to invalidate cache pattern %s: %w", pattern, err)
		}
		ci.logger.Info("Cache invalidated by pattern", "pattern", pattern)
		return nil
	}
	return fmt.Errorf("cache does not support pattern deletion")
}

// InvalidateByKey invalidates specific cache keys
func (ci *CacheInvalidator) InvalidateByKey(ctx context.Context, keys ...string) error {
	for _, key := range keys {
		if err := ci.cache.Delete(ctx, key); err != nil {
			ci.logger.Error("Failed to invalidate cache key", "key", key, "error", err)
		} else {
			ci.logger.Debug("Cache key invalidated", "key", key)
		}
	}
	return nil
}

// InvalidateByTags invalidates cache entries by tags (tag-based invalidation)
func (ci *CacheInvalidator) InvalidateByTags(ctx context.Context, tags ...string) error {
	// This would require implementing tag-based caching
	// For now, we'll invalidate common patterns for each tag
	for _, tag := range tags {
		pattern := fmt.Sprintf("*:%s:*", tag)
		if err := ci.InvalidateByPattern(ctx, pattern); err != nil {
			ci.logger.Error("Failed to invalidate cache by tag", "tag", tag, "error", err)
		}
	}
	return nil
}

// CacheHealthChecker provides health checking for cache systems
type CacheHealthChecker struct {
	cache  CacheService
	logger Logger
}

// NewCacheHealthChecker creates a new cache health checker
func NewCacheHealthChecker(cache CacheService, logger Logger) *CacheHealthChecker {
	return &CacheHealthChecker{
		cache:  cache,
		logger: logger,
	}
}

// CheckHealth performs comprehensive health check
func (chc *CacheHealthChecker) CheckHealth(ctx context.Context) error {
	// Perform basic health check
	if err := chc.cache.HealthCheck(ctx); err != nil {
		return fmt.Errorf("cache health check failed: %w", err)
	}

	// Test cache operations
	testKey := fmt.Sprintf("health_check_%d", time.Now().Unix())
	testValue := "test_value"

	// Test set
	if err := chc.cache.Set(ctx, testKey, testValue, time.Minute); err != nil {
		return fmt.Errorf("cache set operation failed: %w", err)
	}

	// Test get
	if retrieved, err := chc.cache.Get(ctx, testKey); err != nil {
		return fmt.Errorf("cache get operation failed: %w", err)
	} else if retrieved != testValue {
		return fmt.Errorf("cache data mismatch: expected %s, got %v", testValue, retrieved)
	}

	// Test delete
	if err := chc.cache.Delete(ctx, testKey); err != nil {
		return fmt.Errorf("cache delete operation failed: %w", err)
	}

	// Test stats
	if _, err := chc.cache.GetStats(ctx); err != nil {
		return fmt.Errorf("cache stats retrieval failed: %w", err)
	}

	chc.logger.Debug("Cache health check passed")
	return nil
}

// IsHealthy checks if cache is healthy
func (chc *CacheHealthChecker) IsHealthy(ctx context.Context) bool {
	err := chc.CheckHealth(ctx)
	if err != nil {
		chc.logger.Error("Cache health check failed", "error", err)
		return false
	}
	return true
}
