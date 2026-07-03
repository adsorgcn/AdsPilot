// Package cache provides Redis client integration for Google-Monetize
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
)

// RedisConfig holds Redis connection configuration
type RedisConfig struct {
	Addresses    []string `json:"addresses"`
	Password     string   `json:"password"`
	Database     int      `json:"database"`
	MaxRetries   int      `json:"max_retries"`
	PoolSize     int      `json:"pool_size"`
	DialTimeout  int      `json:"dial_timeout"`  // seconds
	ReadTimeout  int      `json:"read_timeout"`  // seconds
	WriteTimeout int      `json:"write_timeout"` // seconds
	IdleTimeout  int      `json:"idle_timeout"`  // seconds
	PoolTimeout  int      `json:"pool_timeout"`  // seconds
	MaxConnAge   int      `json:"max_conn_age"`  // minutes
}

// RedisClient wraps Redis client with enhanced functionality
type RedisClient struct {
	client       *redis.Client
	config       RedisConfig
	logger       Logger
	prefix       string
	keySeparator string
}

// Logger interface for Redis operations
type Logger interface {
	Info(msg string, fields ...interface{})
	Error(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
	Debug(msg string, fields ...interface{})
}

// NewRedisClient creates a new Redis client
func NewRedisClient(config RedisConfig, prefix string, logger Logger) (*RedisClient, error) {
	// Set default values
	if len(config.Addresses) == 0 {
		config.Addresses = []string{"localhost:6379"}
	}
	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}
	if config.PoolSize == 0 {
		config.PoolSize = 10
	}
	if config.DialTimeout == 0 {
		config.DialTimeout = 5
	}
	if config.ReadTimeout == 0 {
		config.ReadTimeout = 3
	}
	if config.WriteTimeout == 0 {
		config.WriteTimeout = 3
	}
	if config.IdleTimeout == 0 {
		config.IdleTimeout = 300
	}
	if config.PoolTimeout == 0 {
		config.PoolTimeout = 30
	}
	if config.MaxConnAge == 0 {
		config.MaxConnAge = 1440 // 24 hours
	}

	// Create Redis client
	rdb := redis.NewClient(&redis.Options{
		Addr:         config.Addresses[0],
		Password:     config.Password,
		DB:           config.Database,
		MaxRetries:   config.MaxRetries,
		PoolSize:     config.PoolSize,
		DialTimeout:  time.Duration(config.DialTimeout) * time.Second,
		ReadTimeout:  time.Duration(config.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(config.WriteTimeout) * time.Second,
		IdleTimeout:  time.Duration(config.IdleTimeout) * time.Second,
		PoolTimeout:  time.Duration(config.PoolTimeout) * time.Second,
		MaxConnAge:   time.Duration(config.MaxConnAge) * time.Minute,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RedisClient{
		client:       rdb,
		config:       config,
		logger:       logger,
		prefix:       prefix,
		keySeparator: ":",
	}, nil
}

// CacheItem represents a cached item with metadata
type CacheItem struct {
	Value      interface{} `json:"value"`
	TTL        int64       `json:"ttl"` // seconds
	CreatedAt  int64       `json:"created_at"`
	AccessedAt int64       `json:"accessed_at"`
	Version    int64       `json:"version"`
	Metadata   interface{} `json:"metadata,omitempty"`
}

// RedisError wraps Redis errors with additional context
type RedisError struct {
	Operation string
	Key       string
	Cause     error
}

func (e *RedisError) Error() string {
	return fmt.Sprintf("Redis operation '%s' on key '%s' failed: %v", e.Operation, e.Key, e.Cause)
}

// GenerateKey creates a cache key with proper prefix and separator
func (r *RedisClient) GenerateKey(parts ...string) string {
	if r.prefix != "" {
		parts = append([]string{r.prefix}, parts...)
	}
	return strings.Join(parts, r.keySeparator)
}

// Set stores a value in Redis with optional TTL
func (r *RedisClient) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	cacheItem := CacheItem{
		Value:      value,
		TTL:        int64(ttl.Seconds()),
		CreatedAt:  time.Now().Unix(),
		AccessedAt: time.Now().Unix(),
		Version:    1,
	}

	jsonData, err := json.Marshal(cacheItem)
	if err != nil {
		return &RedisError{Operation: "SET", Key: key, Cause: err}
	}

	if ttl > 0 {
		return r.client.Set(ctx, key, jsonData, ttl).Err()
	}

	return r.client.Set(ctx, key, jsonData, 0).Err()
}

// Get retrieves a value from Redis
func (r *RedisClient) Get(ctx context.Context, key string) (interface{}, error) {
	jsonData, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Key not found
		}
		return nil, &RedisError{Operation: "GET", Key: key, Cause: err}
	}

	if jsonData == "" {
		return nil, nil
	}

	var cacheItem CacheItem
	if err := json.Unmarshal([]byte(jsonData), &cacheItem); err != nil {
		return nil, &RedisError{Operation: "GET", Key: key, Cause: err}
	}

	// Update accessed time and version
	cacheItem.AccessedAt = time.Now().Unix()
	cacheItem.Version++

	// Re-cache with updated metadata
	go func() {
		updatedData, _ := json.Marshal(cacheItem)
		r.client.Set(context.Background(), key, updatedData, 0)
	}()

	return cacheItem.Value, nil
}

// Delete removes a key from Redis
func (r *RedisClient) Delete(ctx context.Context, key string) error {
	err := r.client.Del(ctx, key).Err()
	if err != nil {
		return &RedisError{Operation: "DELETE", Key: key, Cause: err}
	}

	r.logger.Debug("Cache item deleted", "key", key)
	return nil
}

// Exists checks if a key exists in Redis
func (r *RedisClient) Exists(ctx context.Context, key string) (bool, error) {
	result, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		return false, &RedisError{Operation: "EXISTS", Key: key, Cause: err}
	}

	return result == 1, nil
}

// TTL returns the remaining time-to-live for a key
func (r *RedisClient) TTL(ctx context.Context, key string) (time.Duration, error) {
	ttl, err := r.client.TTL(ctx, key).Result()
	if err != nil {
		return 0, &RedisError{Operation: "TTL", Key: key, Cause: err}
	}

	return time.Duration(ttl) * time.Second, nil
}

// Expire sets expiration for a key
func (r *RedisClient) Expire(ctx context.Context, key string, ttl time.Duration) error {
	err := r.client.Expire(ctx, key, ttl).Err()
	if err != nil {
		return &RedisError{Operation: "EXPIRE", Key: key, Cause: err}
	}

	r.logger.Debug("Cache item expiration set", "key", key, "ttl", ttl)
	return nil
}

// Increment increments a numeric value
func (r *RedisClient) Increment(ctx context.Context, key string, value int64) (int64, error) {
	result, err := r.client.IncrBy(ctx, key, value).Result()
	if err != nil {
		return 0, &RedisError{Operation: "INCR", Key: key, Cause: err}
	}

	return result, nil
}

// Decrement decrements a numeric value
func (r *RedisClient) Decrement(ctx context.Context, key string, value int64) (int64, error) {
	result, err := r.client.DecrBy(ctx, key, value).Result()
	if err != nil {
		return 0, &RedisError{Operation: "DECR", Key: key, Cause: err}
	}

	return result, nil
}

// Keys returns all keys matching a pattern
func (r *RedisClient) Keys(ctx context.Context, pattern string) ([]string, error) {
	keys, err := r.client.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, &RedisError{Operation: "KEYS", Key: pattern, Cause: err}
	}

	return keys, nil
}

// FlushAll removes all keys from current database (use with caution!)
func (r *RedisClient) FlushAll(ctx context.Context) error {
	err := r.client.FlushDB(ctx).Err()
	if err != nil {
		return &RedisError{Operation: "FLUSHALL", Key: "all", Cause: err}
	}

	r.logger.Warn("All cache items flushed", "database", r.config.Database)
	return nil
}

// Ping checks Redis connection health
func (r *RedisClient) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

// GetInfo returns Redis server information
func (r *RedisClient) GetInfo(ctx context.Context) (map[string]string, error) {
	info, err := r.client.Info(ctx).Result()
	if err != nil {
		return nil, &RedisError{Operation: "INFO", Key: "server", Cause: err}
	}

	// TODO: Parse the info string into a map[string]string
	// For now, return a simple map with the raw info
	return map[string]string{"info": info}, nil
}

// GetMemoryUsage returns memory usage statistics
func (r *RedisClient) GetMemoryUsage(ctx context.Context) (map[string]interface{}, error) {
	info, err := r.client.Info(ctx).Result()
	if err != nil {
		return nil, &RedisError{Operation: "INFO", Key: "memory", Cause: err}
	}

	result := make(map[string]interface{})

	// Parse memory information
	for _, line := range strings.Split(info, "\r\n") {
		if strings.Contains(line, "used_memory:") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				result["used_memory"] = parts[1]
			}
		}
		if strings.Contains(line, "used_memory_human:") {
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				result["used_memory_human"] = parts[2]
			}
		}
		if strings.Contains(line, "used_memory_peak:") {
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				result["used_memory_peak"] = parts[2]
			}
		}
		if strings.Contains(line, "total_system_memory:") {
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				result["total_system_memory"] = parts[2]
			}
		}
	}

	return result, nil
}

// GetConnectionPoolStats returns connection pool statistics
func (r *RedisClient) GetConnectionPoolStats(ctx context.Context) (map[string]interface{}, error) {
	info, err := r.client.Info(ctx).Result()
	if err != nil {
		return nil, &RedisError{Operation: "INFO", Key: "pool", Cause: err}
	}

	result := make(map[string]interface{})

	// Parse connection pool information
	for _, line := range strings.Split(info, "\r\n") {
		if strings.Contains(line, "connected_clients:") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				result["connected_clients"] = parts[1]
			}
		}
		if strings.Contains(line, "client_recent_max_input_buffer:") {
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				result["max_input_buffer"] = parts[2]
			}
		}
		if strings.Contains(line, "client_recent_max_output_buffer:") {
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				result["max_output_buffer"] = parts[2]
			}
		}
	}

	return result, nil
}

// Hash operations

// HashSet sets a field in a hash
func (r *RedisClient) HashSet(ctx context.Context, key, field string, value interface{}) error {
	return r.client.HSet(ctx, key, field, value).Err()
}

// HashGet gets a field from a hash
func (r *RedisClient) HashGet(ctx context.Context, key, field string) (string, error) {
	result, err := r.client.HGet(ctx, key, field).Result()
	if err != nil {
		if err == redis.Nil {
			return "", nil
		}
		return "", &RedisError{Operation: "HGET", Key: key, Cause: err}
	}

	return result, nil
}

// HashGetAll gets all fields and values from a hash
func (r *RedisClient) HashGetAll(ctx context.Context, key string) (map[string]string, error) {
	result, err := r.client.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, &RedisError{Operation: "HGETALL", Key: key, Cause: err}
	}

	return result, nil
}

// HashDelete deletes a field from a hash
func (r *RedisClient) HashDelete(ctx context.Context, key, field string) error {
	return r.client.HDel(ctx, key, field).Err()
}

// HashDeleteAll deletes a hash entirely
func (r *RedisClient) HashDeleteAll(ctx context.Context, key string) error {
	return r.client.Del(ctx, key).Err()
}

// HashExists checks if a field exists in a hash
func (r *RedisClient) HashExists(ctx context.Context, key, field string) (bool, error) {
	result, err := r.client.HExists(ctx, key, field).Result()
	if err != nil {
		return false, &RedisError{Operation: "HEXISTS", Key: key, Cause: err}
	}

	return result, nil
}

// List operations

// ListPush adds items to the left of a list
func (r *RedisClient) ListPush(ctx context.Context, key string, values ...interface{}) error {
	return r.client.LPush(ctx, key, values...).Err()
}

// ListPushRight adds items to the right of a list
func (r *RedisClient) ListPushRight(ctx context.Context, key string, values ...interface{}) error {
	return r.client.RPush(ctx, key, values...).Err()
}

// ListPop removes and returns the first item from a list
func (r *RedisClient) ListPop(ctx context.Context, key string) (string, error) {
	result, err := r.client.LPop(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return "", nil
		}
		return "", &RedisError{Operation: "LPOP", Key: key, Cause: err}
	}

	return result, nil
}

// ListPopRight removes and returns the last item from a list
func (r *RedisClient) ListPopRight(ctx context.Context, key string) (string, error) {
	result, err := r.client.RPop(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return "", nil
		}
		return "", &RedisError{Operation: "RPOP", Key: key, Cause: err}
	}

	return result, nil
}

// ListLen returns the length of a list
func (r *RedisClient) ListLen(ctx context.Context, key string) (int64, error) {
	result, err := r.client.LLen(ctx, key).Result()
	if err != nil {
		return 0, &RedisError{Operation: "LLEN", Key: key, Cause: err}
	}

	return result, nil
}

// ListRange returns a range of items from a list
func (r *RedisClient) ListRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	result, err := r.client.LRange(ctx, key, start, stop).Result()
	if err != nil {
		return nil, &RedisError{Operation: "LRANGE", Key: key, Cause: err}
	}

	return result, nil
}

// Set operations

// SetAdd adds members to a set
func (r *RedisClient) SetAdd(ctx context.Context, key string, members ...interface{}) error {
	return r.client.SAdd(ctx, key, members...).Err()
}

// SetRemove removes members from a set
func (r *RedisClient) SetRemove(ctx context.Context, key string, members ...interface{}) error {
	return r.client.SRem(ctx, key, members...).Err()
}

// SetMembers returns all members of a set
func (r *RedisClient) SetMembers(ctx context.Context, key string) ([]string, error) {
	result, err := r.client.SMembers(ctx, key).Result()
	if err != nil {
		return nil, &RedisError{Operation: "SMEMBERS", Key: key, Cause: err}
	}

	return result, nil
}

// SetIsMember checks if a member exists in a set
func (r *RedisClient) SetIsMember(ctx context.Context, key string, member interface{}) (bool, error) {
	result, err := r.client.SIsMember(ctx, key, member).Result()
	if err != nil {
		return false, &RedisError{Operation: "SISMEMBER", Key: key, Cause: err}
	}

	return result, nil
}

// SetCardinality returns the number of members in a set
func (r *RedisClient) SetCardinality(ctx context.Context, key string) (int64, error) {
	result, err := r.client.SCard(ctx, key).Result()
	if err != nil {
		return 0, &RedisError{Operation: "SCARD", Key: key, Cause: err}
	}

	return result, nil
}

// Advanced operations

// SetWithRandomTTL sets a value with random TTL for cache avalanche protection
func (r *RedisClient) SetWithRandomTTL(ctx context.Context, key string, value interface{}, baseTTL time.Duration) error {
	// Add random offset up to 10% of base TTL
	randomOffsetSeconds := rand.Intn(int(baseTTL.Seconds() / 10))
	randomOffset := time.Duration(randomOffsetSeconds) * time.Second
	finalTTL := baseTTL + randomOffset

	return r.Set(ctx, key, value, finalTTL)
}

// SetWithVersion sets a value with version control
func (r *RedisClient) SetWithVersion(ctx context.Context, key string, value interface{}, ttl time.Duration) (int64, error) {
	version := time.Now().Unix()

	cacheItem := CacheItem{
		Value:      value,
		TTL:        int64(ttl.Seconds()),
		CreatedAt:  time.Now().Unix(),
		AccessedAt: time.Now().Unix(),
		Version:    version,
	}

	jsonData, err := json.Marshal(cacheItem)
	if err != nil {
		return 0, &RedisError{Operation: "SET_WITH_VERSION", Key: key, Cause: err}
	}

	if ttl > 0 {
		err = r.client.Set(ctx, key, jsonData, ttl).Err()
	} else {
		err = r.client.Set(ctx, key, jsonData, 0).Err()
	}

	if err != nil {
		return 0, err
	}

	return version, nil
}

// GetWithVersion gets a value and its version
func (r *RedisClient) GetWithVersion(ctx context.Context, key string) (interface{}, int64, error) {
	jsonData, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, 0, nil
		}
		return nil, 0, &RedisError{Operation: "GET_WITH_VERSION", Key: key, Cause: err}
	}

	if jsonData == "" {
		return nil, 0, nil
	}

	var cacheItem CacheItem
	if err := json.Unmarshal([]byte(jsonData), &cacheItem); err != nil {
		return nil, 0, &RedisError{Operation: "GET_WITH_VERSION", Key: key, Cause: err}
	}

	// Update accessed time and version
	cacheItem.AccessedAt = time.Now().Unix()
	cacheItem.Version++

	// Re-cache with updated metadata
	go func() {
		updatedData, _ := json.Marshal(cacheItem)
		r.client.Set(context.Background(), key, updatedData, 0)
	}()

	return cacheItem.Value, cacheItem.Version, nil
}

// CompareAndSet performs a compare-and-set operation
func (r *RedisClient) CompareAndSet(ctx context.Context, key string, expected, newValue interface{}) (bool, error) {
	script := `
		if redis.call("GET", KEYS[1]) == ARGV[1] then
			return redis.call("SET", KEYS[1], ARGV[2])
		else
			return redis.call("GET", KEYS[1])
		end
	`

	result, err := r.client.Eval(ctx, script, []string{key, expected.(string), newValue.(string)}, []string{key}).Result()
	if err != nil {
		return false, &RedisError{Operation: "COMPARE_AND_SET", Key: key, Cause: err}
	}

	return result == "1", nil
}

// GetMultiple retrieves multiple keys in parallel
func (r *RedisClient) GetMultiple(ctx context.Context, keys []string) (map[string]interface{}, error) {
	results := make(map[string]interface{})
	errors := make([]error, 0)

	// Create a pipeline for parallel operations
	pipe := r.client.Pipeline()
	defer pipe.Close()

	// Queue get operations
	getCmds := make([]*redis.StringCmd, len(keys))
	for i, key := range keys {
		getCmds[i] = pipe.Get(ctx, key)
	}

	// Execute pipeline
	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, err
	}

	// Process results
	for i, cmd := range getCmds {
		val, err := cmd.Result()
		if err != nil {
			errors = append(errors, err)
			continue
		}

		if val != "" {
			var cacheItem CacheItem
			if err := json.Unmarshal([]byte(val), &cacheItem); err == nil {
				results[keys[i]] = cacheItem.Value
			} else {
				// Fallback to raw string if JSON parsing fails
				results[keys[i]] = val
			}
		} else {
			results[keys[i]] = nil
		}
	}

	if len(errors) > 0 {
		return results, fmt.Errorf("multiple Redis errors occurred: %v", errors)
	}

	return results, nil
}

// SetMultiple sets multiple keys in parallel
func (r *RedisClient) SetMultiple(ctx context.Context, items map[string]interface{}, ttl time.Duration) error {
	pipe := r.client.Pipeline()
	defer pipe.Close()

	// Queue set operations
	for key, value := range items {
		cacheItem := CacheItem{
			Value:      value,
			TTL:        int64(ttl.Seconds()),
			CreatedAt:  time.Now().Unix(),
			AccessedAt: time.Now().Unix(),
			Version:    1,
		}

		jsonData, err := json.Marshal(cacheItem)
		if err != nil {
			return err
		}

		if ttl > 0 {
			pipe.Set(ctx, key, jsonData, ttl)
		} else {
			pipe.Set(ctx, key, jsonData, 0)
		}
	}

	// Execute pipeline
	_, err := pipe.Exec(ctx)
	if err != nil {
		return err
	}

	r.logger.Debug("Multiple cache items set", "count", len(items), "ttl", ttl)
	return nil
}

// Health check function
func (r *RedisClient) HealthCheck(ctx context.Context) error {
	// Ping Redis
	if err := r.Ping(ctx); err != nil {
		return fmt.Errorf("Redis ping failed: %w", err)
	}

	// Check memory usage
	if info, err := r.GetMemoryUsage(ctx); err == nil {
		if usedMemory, ok := info["used_memory"]; ok {
			r.logger.Debug("Redis memory usage", "used_memory", usedMemory)
		}
	}

	// Check connection pool stats
	if poolStats, err := r.GetConnectionPoolStats(ctx); err == nil {
		if connectedClients, ok := poolStats["connected_clients"]; ok {
			r.logger.Debug("Redis connection pool", "connected_clients", connectedClients)
		}
	}

	return nil
}

// Close closes the Redis client
func (r *RedisClient) Close() error {
	return r.client.Close()
}
