// Package cache provides unified caching service for Google-Monetize
package cache

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// CacheService interface defines unified caching operations
type CacheService interface {
	// Basic operations
	Get(ctx context.Context, key string) (interface{}, error)
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
	Exists(ctx context.Context, key string) (bool, error)

	// Batch operations
	GetMultiple(ctx context.Context, keys []string) (map[string]interface{}, error)
	SetMultiple(ctx context.Context, items map[string]interface{}, ttl time.Duration) error
	DeletePattern(ctx context.Context, pattern string) error

	// Advanced operations
	GetWithVersion(ctx context.Context, key string) (interface{}, int64, error)
	SetWithVersion(ctx context.Context, key string, value interface{}, ttl time.Duration) (int64, error)
	CompareAndSet(ctx context.Context, key string, expected, newValue interface{}) (bool, error)

	// Cache management
	Flush(ctx context.Context) error
	HealthCheck(ctx context.Context) error
	GetStats(ctx context.Context) (CacheStats, error)

	// Lifecycle
	Close() error
}

// CacheStats provides cache performance statistics
type CacheStats struct {
	HitRate       float64                `json:"hit_rate"`
	MissRate      float64                `json:"miss_rate"`
	HitCount      int64                  `json:"hit_count"`
	MissCount     int64                  `json:"miss_count"`
	EvictionCount int64                  `json:"eviction_count"`
	KeyCount      int64                  `json:"key_count"`
	MemoryUsage   int64                  `json:"memory_usage_bytes"`
	Connections   int64                  `json:"active_connections"`
	ResponseTime  time.Duration          `json:"avg_response_time"`
	DomainStats   map[string]DomainStats `json:"domain_stats"`
	LastUpdated   time.Time              `json:"last_updated"`
}

// DomainStats provides per-domain cache statistics
type DomainStats struct {
	Domain        string        `json:"domain"`
	HitRate       float64       `json:"hit_rate"`
	HotKeys       []string      `json:"hot_keys"`
	ColdKeys      []string      `json:"cold_keys"`
	AverageTTL    time.Duration `json:"average_ttl"`
	AccessPattern string        `json:"access_pattern"`
	LastAccess    time.Time     `json:"last_access"`
}

// CacheConfig holds cache service configuration
type CacheConfig struct {
	Redis          RedisConfig             `json:"redis"`
	DefaultTTL     time.Duration           `json:"default_ttl"`
	MaxMemory      int64                   `json:"max_memory_bytes"`
	EvictionPolicy string                  `json:"eviction_policy"`
	Compression    bool                    `json:"compression"`
	Encryption     bool                    `json:"encryption"`
	Metrics        MetricsConfig           `json:"metrics"`
	Domains        map[string]DomainConfig `json:"domains"`
}

// MetricsConfig holds metrics configuration
type MetricsConfig struct {
	Enabled       bool          `json:"enabled"`
	Interval      time.Duration `json:"interval"`
	Retention     time.Duration `json:"retention"`
	ExportFormat  string        `json:"export_format"`
	ExportTargets []string      `json:"export_targets"`
}

// DomainConfig holds domain-specific cache configuration
type DomainConfig struct {
	Name           string        `json:"name"`
	TTL            time.Duration `json:"ttl"`
	MaxKeys        int           `json:"max_keys"`
	Priority       int           `json:"priority"`
	Preload        []string      `json:"preload_keys"`
	HotKeyBoost    float64       `json:"hot_key_boost"`
	ColdKeyPenalty float64       `json:"cold_key_penalty"`
}

// DefaultCacheService implements CacheService with Redis backend
type DefaultCacheService struct {
	redis  *RedisClient
	config CacheConfig
	logger Logger
	stats  *CacheStatistics
	mu     sync.RWMutex
}

// CacheStatistics tracks cache performance metrics
type CacheStatistics struct {
	hits        int64
	misses      int64
	evictions   int64
	operations  int64
	startTime   time.Time
	mu          sync.RWMutex
	domainStats map[string]*DomainStatistics
}

// DomainStatistics tracks per-domain metrics
type DomainStatistics struct {
	domain         string
	hits           int64
	misses         int64
	accessTimes    map[string]time.Time
	keyFrequencies map[string]int64
	mu             sync.RWMutex
}

// NewCacheService creates a new cache service instance
func NewCacheService(config CacheConfig, logger Logger) (CacheService, error) {
	// Create Redis client
	redisClient, err := NewRedisClient(config.Redis, "gm", logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create Redis client: %w", err)
	}

	service := &DefaultCacheService{
		redis:  redisClient,
		config: config,
		logger: logger,
		stats: &CacheStatistics{
			startTime:   time.Now(),
			domainStats: make(map[string]*DomainStatistics),
		},
	}

	// Initialize domain statistics
	for domainName := range config.Domains {
		service.stats.domainStats[domainName] = &DomainStatistics{
			domain:         domainName,
			accessTimes:    make(map[string]time.Time),
			keyFrequencies: make(map[string]int64),
		}
	}

	// Start metrics collection if enabled
	if config.Metrics.Enabled {
		go service.startMetricsCollection()
	}

	logger.Info("Cache service initialized", "redis_config", config.Redis, "domains", len(config.Domains))
	return service, nil
}

// Get retrieves a value from cache
func (c *DefaultCacheService) Get(ctx context.Context, key string) (interface{}, error) {
	start := time.Now()
	defer func() {
		c.recordOperation(time.Since(start))
	}()

	value, err := c.redis.Get(ctx, key)
	if err != nil {
		c.recordMiss(key)
		return nil, err
	}

	if value == nil {
		c.recordMiss(key)
		return nil, nil
	}

	c.recordHit(key)
	c.logger.Debug("Cache hit", "key", key, "value_type", fmt.Sprintf("%T", value))
	return value, nil
}

// Set stores a value in cache
func (c *DefaultCacheService) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	start := time.Now()
	defer func() {
		c.recordOperation(time.Since(start))
	}()

	// Use default TTL if not specified
	if ttl <= 0 {
		ttl = c.config.DefaultTTL
	}

	err := c.redis.Set(ctx, key, value, ttl)
	if err != nil {
		c.logger.Error("Failed to set cache", "key", key, "error", err)
		return err
	}

	c.recordAccess(key)
	c.logger.Debug("Cache set", "key", key, "ttl", ttl)
	return nil
}

// Delete removes a key from cache
func (c *DefaultCacheService) Delete(ctx context.Context, key string) error {
	err := c.redis.Delete(ctx, key)
	if err != nil {
		c.logger.Error("Failed to delete cache", "key", key, "error", err)
		return err
	}

	c.recordDeletion(key)
	c.logger.Debug("Cache deleted", "key", key)
	return nil
}

// Exists checks if a key exists in cache
func (c *DefaultCacheService) Exists(ctx context.Context, key string) (bool, error) {
	return c.redis.Exists(ctx, key)
}

// GetMultiple retrieves multiple keys in parallel
func (c *DefaultCacheService) GetMultiple(ctx context.Context, keys []string) (map[string]interface{}, error) {
	start := time.Now()
	defer func() {
		c.recordOperation(time.Since(start))
	}()

	results, err := c.redis.GetMultiple(ctx, keys)
	if err != nil {
		c.logger.Error("Failed to get multiple keys", "keys", keys, "error", err)
		return nil, err
	}

	// Record statistics for each key
	for _, key := range keys {
		if value, exists := results[key]; exists && value != nil {
			c.recordHit(key)
		} else {
			c.recordMiss(key)
		}
	}

	c.logger.Debug("Cache get multiple", "keys_requested", len(keys), "keys_found", len(results))
	return results, nil
}

// SetMultiple sets multiple keys in parallel
func (c *DefaultCacheService) SetMultiple(ctx context.Context, items map[string]interface{}, ttl time.Duration) error {
	start := time.Now()
	defer func() {
		c.recordOperation(time.Since(start))
	}()

	// Use default TTL if not specified
	if ttl <= 0 {
		ttl = c.config.DefaultTTL
	}

	err := c.redis.SetMultiple(ctx, items, ttl)
	if err != nil {
		c.logger.Error("Failed to set multiple keys", "items_count", len(items), "error", err)
		return err
	}

	// Record access for all keys
	for key := range items {
		c.recordAccess(key)
	}

	c.logger.Debug("Cache set multiple", "items_count", len(items), "ttl", ttl)
	return nil
}

// DeletePattern removes keys matching a pattern
func (c *DefaultCacheService) DeletePattern(ctx context.Context, pattern string) error {
	keys, err := c.redis.Keys(ctx, pattern)
	if err != nil {
		return err
	}

	for _, key := range keys {
		if err := c.Delete(ctx, key); err != nil {
			c.logger.Error("Failed to delete key in pattern", "key", key, "pattern", pattern, "error", err)
		}
	}

	c.logger.Debug("Cache delete pattern", "pattern", pattern, "deleted_count", len(keys))
	return nil
}

// GetWithVersion retrieves a value and its version
func (c *DefaultCacheService) GetWithVersion(ctx context.Context, key string) (interface{}, int64, error) {
	return c.redis.GetWithVersion(ctx, key)
}

// SetWithVersion sets a value with version control
func (c *DefaultCacheService) SetWithVersion(ctx context.Context, key string, value interface{}, ttl time.Duration) (int64, error) {
	if ttl <= 0 {
		ttl = c.config.DefaultTTL
	}

	version, err := c.redis.SetWithVersion(ctx, key, value, ttl)
	if err != nil {
		return 0, err
	}

	c.recordAccess(key)
	c.logger.Debug("Cache set with version", "key", key, "version", version, "ttl", ttl)
	return version, nil
}

// CompareAndSet performs a compare-and-set operation
func (c *DefaultCacheService) CompareAndSet(ctx context.Context, key string, expected, newValue interface{}) (bool, error) {
	success, err := c.redis.CompareAndSet(ctx, key, expected, newValue)
	if err != nil {
		return false, err
	}

	if success {
		c.recordAccess(key)
		c.logger.Debug("Cache compare-and-set success", "key", key)
	} else {
		c.logger.Debug("Cache compare-and-set failed", "key", key)
	}

	return success, nil
}

// Flush removes all keys from cache
func (c *DefaultCacheService) Flush(ctx context.Context) error {
	err := c.redis.FlushAll(ctx)
	if err != nil {
		return err
	}

	c.resetStatistics()
	c.logger.Info("Cache flushed")
	return nil
}

// HealthCheck performs cache health check
func (c *DefaultCacheService) HealthCheck(ctx context.Context) error {
	return c.redis.HealthCheck(ctx)
}

// GetStats returns cache statistics
func (c *DefaultCacheService) GetStats(ctx context.Context) (CacheStats, error) {
	c.stats.mu.RLock()
	defer c.stats.mu.RUnlock()

	totalOps := c.stats.hits + c.stats.misses
	hitRate := 0.0
	if totalOps > 0 {
		hitRate = float64(c.stats.hits) / float64(totalOps)
	}

	// Get Redis stats
	memoryUsage, _ := c.redis.GetMemoryUsage(ctx)
	poolStats, _ := c.redis.GetConnectionPoolStats(ctx)

	// Build domain statistics
	domainStats := make(map[string]DomainStats)
	for domain, domainStatsImpl := range c.stats.domainStats {
		domainStatsImpl.mu.RLock()
		domainTotal := domainStatsImpl.hits + domainStatsImpl.misses
		domainHitRate := 0.0
		if domainTotal > 0 {
			domainHitRate = float64(domainStatsImpl.hits) / float64(domainTotal)
		}

		domainStats[domain] = DomainStats{
			Domain:     domain,
			HitRate:    domainHitRate,
			HotKeys:    c.getHotKeys(domain),
			ColdKeys:   c.getColdKeys(domain),
			LastAccess: c.getLastAccess(domain),
		}
		domainStatsImpl.mu.RUnlock()
	}

	stats := CacheStats{
		HitRate:       hitRate,
		MissRate:      1.0 - hitRate,
		HitCount:      c.stats.hits,
		MissCount:     c.stats.misses,
		EvictionCount: c.stats.evictions,
		KeyCount:      int64(len(c.stats.domainStats)),
		MemoryUsage:   c.extractMemoryUsage(memoryUsage),
		DomainStats:   domainStats,
		LastUpdated:   time.Now(),
	}

	// Extract connection stats
	if _, ok := poolStats["connected_clients"].(string); ok {
		// Parse connection count from string if needed
		stats.Connections = 0 // Default value
	}

	return stats, nil
}

// Close closes the cache service
func (c *DefaultCacheService) Close() error {
	return c.redis.Close()
}

// Helper methods for statistics tracking

func (c *DefaultCacheService) recordHit(key string) {
	c.stats.mu.Lock()
	c.stats.hits++
	c.stats.mu.Unlock()

	domain := c.extractDomain(key)
	if domainStats, exists := c.stats.domainStats[domain]; exists {
		domainStats.mu.Lock()
		domainStats.hits++
		domainStats.keyFrequencies[key]++
		domainStats.accessTimes[key] = time.Now()
		domainStats.mu.Unlock()
	}
}

func (c *DefaultCacheService) recordMiss(key string) {
	c.stats.mu.Lock()
	c.stats.misses++
	c.stats.mu.Unlock()

	domain := c.extractDomain(key)
	if domainStats, exists := c.stats.domainStats[domain]; exists {
		domainStats.mu.Lock()
		domainStats.misses++
		domainStats.mu.Unlock()
	}
}

func (c *DefaultCacheService) recordAccess(key string) {
	domain := c.extractDomain(key)
	if domainStats, exists := c.stats.domainStats[domain]; exists {
		domainStats.mu.Lock()
		domainStats.keyFrequencies[key]++
		domainStats.accessTimes[key] = time.Now()
		domainStats.mu.Unlock()
	}
}

func (c *DefaultCacheService) recordDeletion(key string) {
	domain := c.extractDomain(key)
	if domainStats, exists := c.stats.domainStats[domain]; exists {
		domainStats.mu.Lock()
		delete(domainStats.keyFrequencies, key)
		delete(domainStats.accessTimes, key)
		domainStats.mu.Unlock()
	}
}

func (c *DefaultCacheService) recordOperation(duration time.Duration) {
	c.stats.mu.Lock()
	c.stats.operations++
	c.stats.mu.Unlock()
}

func (c *DefaultCacheService) resetStatistics() {
	c.stats.mu.Lock()
	c.stats.hits = 0
	c.stats.misses = 0
	c.stats.evictions = 0
	c.stats.operations = 0
	c.stats.startTime = time.Now()
	c.stats.mu.Unlock()

	for _, domainStats := range c.stats.domainStats {
		domainStats.mu.Lock()
		domainStats.hits = 0
		domainStats.misses = 0
		domainStats.accessTimes = make(map[string]time.Time)
		domainStats.keyFrequencies = make(map[string]int64)
		domainStats.mu.Unlock()
	}
}

func (c *DefaultCacheService) extractDomain(key string) string {
	// Extract domain from key format: domain:entity:id:...
	parts := []rune(key)
	if len(parts) > 0 && parts[0] == '_' {
		// Skip prefix if present
		parts = parts[1:]
	}

	for i, char := range parts {
		if char == ':' && i > 0 {
			return string(parts[:i])
		}
	}
	return "unknown"
}

func (c *DefaultCacheService) getHotKeys(domain string) []string {
	domainStats, exists := c.stats.domainStats[domain]
	if !exists {
		return nil
	}

	domainStats.mu.RLock()
	defer domainStats.mu.RUnlock()

	// Return top 5 most accessed keys
	type keyFreq struct {
		key  string
		freq int64
	}

	var keyFreqs []keyFreq
	for key, freq := range domainStats.keyFrequencies {
		keyFreqs = append(keyFreqs, keyFreq{key, freq})
	}

	// Simple selection of top keys (in production, use proper sorting)
	hotKeys := make([]string, 0, 5)
	for _, kf := range keyFreqs {
		if len(hotKeys) < 5 {
			hotKeys = append(hotKeys, kf.key)
		}
	}

	return hotKeys
}

func (c *DefaultCacheService) getColdKeys(domain string) []string {
	domainStats, exists := c.stats.domainStats[domain]
	if !exists {
		return nil
	}

	domainStats.mu.RLock()
	defer domainStats.mu.RUnlock()

	// Return keys with low access frequency (simplified implementation)
	coldKeys := make([]string, 0)
	for key, freq := range domainStats.keyFrequencies {
		if freq < 5 { // Define cold keys as accessed less than 5 times
			coldKeys = append(coldKeys, key)
		}
	}

	return coldKeys
}

func (c *DefaultCacheService) getLastAccess(domain string) time.Time {
	domainStats, exists := c.stats.domainStats[domain]
	if !exists {
		return time.Time{}
	}

	domainStats.mu.RLock()
	defer domainStats.mu.RUnlock()

	var lastAccess time.Time
	for _, accessTime := range domainStats.accessTimes {
		if accessTime.After(lastAccess) {
			lastAccess = accessTime
		}
	}

	return lastAccess
}

func (c *DefaultCacheService) extractMemoryUsage(memoryUsage map[string]interface{}) int64 {
	if usedMemory, ok := memoryUsage["used_memory"]; ok {
		if memStr, ok := usedMemory.(string); ok {
			// Parse memory string to bytes (simplified)
			return int64(len(memStr) * 1024) // Placeholder implementation
		}
	}
	return 0
}

func (c *DefaultCacheService) startMetricsCollection() {
	ticker := time.NewTicker(c.config.Metrics.Interval)
	defer ticker.Stop()

	for range ticker.C {
		stats, err := c.GetStats(context.Background())
		if err != nil {
			c.logger.Error("Failed to collect metrics", "error", err)
			continue
		}

		c.logger.Debug("Cache metrics collected",
			"hit_rate", stats.HitRate,
			"key_count", stats.KeyCount,
			"memory_usage", stats.MemoryUsage)
	}
}
