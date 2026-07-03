# Google-Monetize Cache Package

This package provides a comprehensive caching solution for the Google-Monetize platform, featuring Redis integration, domain-specific caching, and advanced performance optimizations.

## Features

- **Multi-layer Caching**: L1 (Memory) + L2 (Redis) + L3 (Database)
- **Domain-specific Caching**: Separate cache strategies for each business domain
- **Cache Protection**: Built-in protection against cache avalanche, penetration, and breakdown
- **Performance Monitoring**: Comprehensive metrics and health monitoring
- **Easy Integration**: Drop-in replacement for existing services
- **Configuration Management**: Flexible configuration via files or environment variables

## Architecture

```
Service Layer
    ↓
Domain Cache (User, Billing, Offer, Ads, Activity, Admin)
    ↓
Cache Service (Unified Interface)
    ↓
Redis Client (Connection Pool, Health Monitoring)
    ↓
Redis Cluster (Distributed Cache)
```

## Quick Start

### 1. Basic Usage

```go
package main

import (
    "context"
    "log"
    "time"

    "github.com/your-org/gm/pkg/cache"
)

func main() {
    // Initialize cache factory
    factory := cache.NewCacheFactory(log.Default())

    // Load configuration from environment
    if err := factory.LoadConfigFromEnv(); err != nil {
        log.Fatal(err)
    }

    // Get cache service
    cacheService, err := factory.GetCacheService("my-service")
    if err != nil {
        log.Fatal(err)
    }

    // Use cache
    ctx := context.Background()

    // Set value
    err = cacheService.Set(ctx, "user:123", map[string]interface{}{
        "id":    "123",
        "name":  "John Doe",
        "email": "john@example.com",
    }, time.Minute*30)
    if err != nil {
        log.Fatal(err)
    }

    // Get value
    var user map[string]interface{}
    cached, err := cacheService.Get(ctx, "user:123")
    if err == nil && cached != nil {
        user = cached.(map[string]interface{})
        log.Printf("User: %+v", user)
    }
}
```

### 2. Domain-specific Caching

```go
// Get domain cache manager
manager, err := factory.GetDomainCache("my-service")
if err != nil {
    log.Fatal(err)
}

// Get user domain cache
userCache, exists := manager.GetCache(cache.UserDomainCache)
if !exists {
    log.Fatal("User domain cache not found")
}

// Use domain-specific methods
if userDomainCache, ok := userCache.(*cache.UserDomainCache); ok {
    // Get user profile
    profile, err := userDomainCache.GetUserProfile(ctx, "user123")
    if err != nil {
        log.Fatal(err)
    }

    // Set user profile
    err = userDomainCache.SetUserProfile(ctx, "user123", profileData)
    if err != nil {
        log.Fatal(err)
    }

    // Invalidate all user cache
    err = userDomainCache.InvalidateUser(ctx, "user123")
    if err != nil {
        log.Fatal(err)
    }
}
```

### 3. Service Integration

```go
// Create service with caching
service, err := cache.NewExampleService(db, redisConfig, logger)
if err != nil {
    log.Fatal(err)
}

// Use cached operations
user, err := service.GetUserWithCache(ctx, "user123")
if err != nil {
    log.Fatal(err)
}

// Batch operations
users, err := service.GetUsersWithCache(ctx, []string{"user1", "user2", "user3"})
if err != nil {
    log.Fatal(err)
}

// Invalidate cache
err = service.InvalidateUserCache(ctx, "user123")
if err != nil {
    log.Fatal(err)
}
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_ADDRESS=localhost:6379
REDIS_PASSWORD=
REDIS_DATABASE=0
REDIS_MAX_RETRIES=3
REDIS_POOL_SIZE=10
REDIS_DIAL_TIMEOUT=5s
REDIS_READ_TIMEOUT=3s
REDIS_WRITE_TIMEOUT=3s
REDIS_IDLE_TIMEOUT=300s
REDIS_POOL_TIMEOUT=30s
REDIS_MAX_CONN_AGE=1440s

# Cache Configuration
CACHE_DEFAULT_TTL=1h
CACHE_MAX_MEMORY=1073741824
CACHE_EVICTION_POLICY=allkeys-lru
CACHE_COMPRESSION=false
CACHE_ENCRYPTION=false
CACHE_METRICS_ENABLED=true
CACHE_METRICS_INTERVAL=5m
CACHE_METRICS_RETENTION=24h

# Domain-specific Configuration
USER_CACHE_TTL=30m
USER_CACHE_MAX_KEYS=10000
USER_CACHE_PRIORITY=1
USER_CACHE_HOT_KEY_BOOST=1.5
USER_CACHE_COLD_KEY_PENALTY=0.5

BILLING_CACHE_TTL=5m
BILLING_CACHE_MAX_KEYS=5000
BILLING_CACHE_PRIORITY=2

# ... other domains
```

### Configuration File

```json
{
  "redis": {
    "addresses": ["localhost:6379"],
    "password": "",
    "database": 0,
    "max_retries": 3,
    "pool_size": 10
  },
  "default_ttl": "1h",
  "max_memory": 1073741824,
  "domains": {
    "user": {
      "name": "user",
      "ttl": "30m",
      "max_keys": 10000,
      "priority": 1
    }
  }
}
```

## Domain Caching Strategies

### User Domain
- **TTL**: 30 minutes
- **Priority**: High (1)
- **Use Cases**: User profiles, preferences, permissions
- **Cache Keys**: `user:profile:{user_id}`, `user:permissions:{user_id}`

### Billing Domain
- **TTL**: 5 minutes
- **Priority**: High (2)
- **Use Cases**: Token balances, transaction history, subscription status
- **Cache Keys**: `billing:balance:{user_id}:{token_type}`, `billing:transactions:{user_id}`

### Offer Domain
- **TTL**: 10 minutes
- **Priority**: Medium (3)
- **Use Cases**: Offer details, analysis results, keywords
- **Cache Keys**: `offer:details:{offer_id}`, `offer:analysis:{offer_id}:{type}`

### Ads Domain
- **TTL**: 1 hour
- **Priority**: Low (4)
- **Use Cases**: Account connections, performance data, campaigns
- **Cache Keys**: `ads:accounts:{user_id}`, `ads:performance:{account_id}:{date}`

### Activity Domain
- **TTL**: 1 minute
- **Priority**: High (2)
- **Use Cases**: Notifications, events, user statistics
- **Cache Keys**: `activity:notifications:{user_id}`, `activity:stats:{user_id}:{date}`

### Admin Domain
- **TTL**: 15 minutes
- **Priority**: Highest (5)
- **Use Cases**: System configuration, metrics, admin data
- **Cache Keys**: `admin:config:{key}`, `admin:metrics:{type}`

## Advanced Features

### Cache Middleware

```go
// Create middleware
middleware := cache.NewCacheMiddleware(cacheService, logger)

// Execute cached operation
result, err := middleware.Execute(ctx, cache.CacheOperation{
    Key: "expensive_operation",
    Operation: func(ctx context.Context) (interface{}, error) {
        // Expensive operation here
        return performExpensiveOperation()
    },
    TTL: time.Minute * 10,
})
```

### Batch Operations

```go
// Batch cache operations
operations := []cache.CacheOperation{
    {
        Key:       "item1",
        Operation: getItem1Operation,
        TTL:       time.Minute * 5,
    },
    {
        Key:       "item2",
        Operation: getItem2Operation,
        TTL:       time.Minute * 5,
    },
}

batch := cache.BatchCacheOperation{Operations: operations}
results, err := middleware.ExecuteBatch(ctx, batch)
```

### Cache Warmup

```go
// Create cache warmer
warmer := cache.NewCacheWarmer(cacheService, logger)

// Add warmup jobs
warmer.AddWarmupJob(cache.WarmupJob{
    Name:      "admin_user",
    Key:       "user:admin",
    TTL:       time.Hour,
    Operation: getAdminUserOperation,
    Priority:  1,
})

// Execute warmup
err = warmer.Warmup(ctx)
```

### Cache Invalidation

```go
// Create invalidator
invalidator := cache.NewCacheInvalidator(cacheService, logger)

// Invalidate by pattern
err = invalidator.InvalidateByPattern(ctx, "user:*")

// Invalidate by key
err = invalidator.InvalidateByKey(ctx, "user:123", "user:124")

// Invalidate by tags
err = invalidator.InvalidateByTags(ctx, "user", "billing")
```

### Health Monitoring

```go
// Create health checker
healthChecker := cache.NewCacheHealthChecker(cacheService, logger)

// Check health
err = healthChecker.CheckHealth(ctx)

// Simple health check
if healthChecker.IsHealthy(ctx) {
    log.Println("Cache is healthy")
} else {
    log.Println("Cache is unhealthy")
}
```

## Performance Monitoring

The cache package provides comprehensive performance monitoring:

### Cache Statistics
- Hit rate and miss rate
- Key count and memory usage
- Response times
- Domain-specific statistics

### Metrics Collection
- Automatic metrics collection
- Configurable intervals
- Multiple export formats (JSON, Prometheus)
- Retention policies

### Health Monitoring
- Connection health checks
- Cache operation validation
- Performance thresholds
- Automatic alerting

## Best Practices

### 1. Cache Key Design
- Use consistent naming patterns: `domain:entity:id`
- Include versioning for cache invalidation
- Use hierarchical key structure
- Avoid overly generic or specific keys

### 2. TTL Management
- Set appropriate TTL based on data volatility
- Use shorter TTL for frequently changing data
- Implement cache warming for critical data
- Monitor cache hit rates and adjust TTL

### 3. Cache Invalidation
- Invalidate on data changes
- Use pattern-based invalidation for related data
- Implement cache versioning for complex invalidation
- Monitor invalidation effectiveness

### 4. Performance Optimization
- Use batch operations for multiple cache accesses
- Implement cache warming for frequently accessed data
- Monitor cache performance metrics
- Optimize cache key distribution

### 5. Error Handling
- Gracefully handle cache failures
- Implement fallback mechanisms
- Monitor cache errors and alerts
- Log cache operations for debugging

## Testing

```go
// Run example cache warmup
go cache.CacheWarmupExample()

// Run health check example
go cache.HealthCheckExample()

// Create test service
service, err := cache.ServiceStartupExample()
if err != nil {
    log.Fatal(err)
}
```

## Migration Guide

### From No Cache

1. Add cache configuration
2. Initialize cache factory
3. Add cache operations to critical paths
4. Monitor performance and adjust TTL

### From Simple Cache

1. Replace existing cache implementation
2. Migrate cache keys to new format
3. Add domain-specific caching strategies
4. Implement cache invalidation patterns

### Configuration Migration

1. Export existing cache configuration
2. Map to new configuration format
3. Test with new configuration
4. Gradually migrate services

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis configuration
   - Verify network connectivity
   - Validate authentication credentials

2. **Cache Hit Rate Low**
   - Review cache key patterns
   - Adjust TTL settings
   - Implement cache warming

3. **Memory Usage High**
   - Monitor cache key count
   - Adjust eviction policies
   - Implement cache size limits

4. **Performance Degradation**
   - Check cache operation latency
   - Monitor connection pool usage
   - Review cache key distribution

### Debug Tools

```go
// Get cache statistics
stats, err := cacheService.GetStats(ctx)
if err != nil {
    log.Printf("Failed to get stats: %v", err)
} else {
    log.Printf("Cache stats: %+v", stats)
}

// Check domain statistics
if domainCache, ok := cache.(*cache.UserDomainCache); ok {
    domainStats, err := domainCache.GetDomainStats(ctx)
    if err == nil {
        log.Printf("Domain stats: %+v", domainStats)
    }
}
```

## License

This package is part of the Google-Monetize platform and follows the project's licensing terms.