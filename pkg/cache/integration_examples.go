// Package cache provides integration examples for existing services
package cache

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"
)

// StdLoggerAdapter wraps standard log.Logger to implement Logger interface
type StdLoggerAdapter struct {
	logger *log.Logger
}

func (s *StdLoggerAdapter) Debug(msg string, args ...interface{}) {
	s.logger.Printf("[DEBUG] "+msg, args...)
}

func (s *StdLoggerAdapter) Info(msg string, args ...interface{}) {
	s.logger.Printf("[INFO] "+msg, args...)
}

func (s *StdLoggerAdapter) Warn(msg string, args ...interface{}) {
	s.logger.Printf("[WARN] "+msg, args...)
}

func (s *StdLoggerAdapter) Error(msg string, args ...interface{}) {
	s.logger.Printf("[ERROR] "+msg, args...)
}

// ExampleService demonstrates how to integrate caching into an existing service
type ExampleService struct {
	db           *sql.DB
	cacheManager *CacheManager
	logger       Logger
	middleware   *CacheMiddleware
}

// NewExampleService creates a new example service with caching
func NewExampleService(db *sql.DB, redisConfig RedisConfig, logger Logger) (*ExampleService, error) {
	// Create cache configuration
	cacheConfig := CacheConfig{
		Redis:      redisConfig,
		DefaultTTL: time.Hour,
		Metrics: MetricsConfig{
			Enabled:  true,
			Interval: time.Minute * 5,
		},
		Domains: map[string]DomainConfig{
			"example": {
				Name: "example",
				TTL:  time.Minute * 30,
			},
		},
	}

	// Create cache manager
	cacheManager, err := NewCacheManager(cacheConfig, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create cache manager: %w", err)
	}

	// Create base cache service
	cacheService, err := NewCacheService(cacheConfig, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create cache service: %w", err)
	}

	// Create middleware
	middleware := NewCacheMiddleware(cacheService, logger)

	return &ExampleService{
		db:           db,
		cacheManager: cacheManager,
		logger:       logger,
		middleware:   middleware,
	}, nil
}

// GetUserWithCache demonstrates cached user retrieval
func (es *ExampleService) GetUserWithCache(ctx context.Context, userID string) (map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("user:%s", userID)

	operation := func(ctx context.Context) (interface{}, error) {
		// Simulate database query
		query := `SELECT id, email, name, created_at FROM users WHERE id = $1`
		row := es.db.QueryRowContext(ctx, query, userID)

		var user map[string]interface{}
		user = make(map[string]interface{})

		var id, email, name, createdAt string
		if err := row.Scan(&id, &email, &name, &createdAt); err != nil {
			if err == sql.ErrNoRows {
				return nil, fmt.Errorf("user not found")
			}
			return nil, err
		}

		user["id"] = id
		user["email"] = email
		user["name"] = name
		user["created_at"] = createdAt

		return user, nil
	}

	result, err := es.middleware.Execute(ctx, CacheOperation{
		Key:       cacheKey,
		Operation: operation,
		TTL:       time.Minute * 30,
	})

	if err != nil {
		return nil, err
	}

	userData, ok := result.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid user data type")
	}

	return userData, nil
}

// GetUsersWithCache demonstrates cached batch user retrieval
func (es *ExampleService) GetUsersWithCache(ctx context.Context, userIDs []string) (map[string]interface{}, error) {
	operations := make([]CacheOperation, 0, len(userIDs))

	for _, userID := range userIDs {
		cacheKey := fmt.Sprintf("user:%s", userID)

		operation := func(ctx context.Context) (interface{}, error) {
			// Simulate database query
			query := `SELECT id, email, name FROM users WHERE id = $1`
			row := es.db.QueryRowContext(ctx, query, userID)

			var id, email, name string
			if err := row.Scan(&id, &email, &name); err != nil {
				if err == sql.ErrNoRows {
					return nil, nil // Return nil for not found
				}
				return nil, err
			}

			return map[string]interface{}{
				"id":    id,
				"email": email,
				"name":  name,
			}, nil
		}

		operations = append(operations, CacheOperation{
			Key:       cacheKey,
			Operation: operation,
			TTL:       time.Minute * 30,
		})
	}

	batch := BatchCacheOperation{Operations: operations}
	return es.middleware.ExecuteBatch(ctx, batch)
}

// InvalidateUserCache demonstrates cache invalidation
func (es *ExampleService) InvalidateUserCache(ctx context.Context, userID string) error {
	cacheKey := fmt.Sprintf("user:%s")

	// Create invalidator
	invalidator := NewCacheInvalidator(es.middleware.cache, es.logger)

	// Invalidate specific user cache
	if err := invalidator.InvalidateByKey(ctx, cacheKey); err != nil {
		return fmt.Errorf("failed to invalidate user cache: %w", err)
	}

	// Invalidate related patterns
	pattern := fmt.Sprintf("user:%s:*", userID)
	if err := invalidator.InvalidateByPattern(ctx, pattern); err != nil {
		es.logger.Error("Failed to invalidate user cache pattern", "pattern", pattern, "error", err)
	}

	es.logger.Info("User cache invalidated", "user_id", userID)
	return nil
}

// UserServiceIntegration demonstrates user service specific caching
type UserServiceIntegration struct {
	*ExampleService
	userCache DomainCache
}

// NewUserServiceIntegration creates a user service with domain-specific caching
func NewUserServiceIntegration(db *sql.DB, redisConfig RedisConfig, logger Logger) (*UserServiceIntegration, error) {
	baseService, err := NewExampleService(db, redisConfig, logger)
	if err != nil {
		return nil, err
	}

	// Get user domain cache
	userCache, exists := baseService.cacheManager.GetCache(UserDomainCacheType)
	if !exists {
		return nil, fmt.Errorf("user domain cache not found")
	}

	return &UserServiceIntegration{
		ExampleService: baseService,
		userCache:      userCache,
	}, nil
}

// GetUserProfile demonstrates domain-specific cache usage
func (usi *UserServiceIntegration) GetUserProfile(ctx context.Context, userID string) (map[string]interface{}, error) {
	// Use domain-specific cache method
	if userDomainCache, ok := usi.userCache.(*UserDomainCache); ok {
		profile, err := userDomainCache.GetUserProfile(ctx, userID)
		if err == nil && profile != nil {
			if userProfile, ok := profile.(map[string]interface{}); ok {
				usi.logger.Debug("User profile cache hit", "user_id", userID)
				return userProfile, nil
			}
		}
	}

	// Cache miss - fetch from database
	usi.logger.Debug("User profile cache miss", "user_id", userID)
	query := `SELECT id, email, name, status, preferences FROM user_domain.users WHERE id = $1`
	row := usi.db.QueryRowContext(ctx, query, userID)

	var id, email, name, status string
	var preferences string

	if err := row.Scan(&id, &email, &name, &status, &preferences); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}

	profile := map[string]interface{}{
		"id":          id,
		"email":       email,
		"name":        name,
		"status":      status,
		"preferences": preferences,
	}

	// Cache the profile
	if userDomainCache, ok := usi.userCache.(*UserDomainCache); ok {
		if err := userDomainCache.SetUserProfile(ctx, userID, profile); err != nil {
			usi.logger.Error("Failed to cache user profile", "user_id", userID, "error", err)
		}
	}

	return profile, nil
}

// UpdateUserProfile demonstrates cache invalidation on update
func (usi *UserServiceIntegration) UpdateUserProfile(ctx context.Context, userID string, updates map[string]interface{}) error {
	// Update database
	query := `UPDATE user_domain.users SET updated_at = NOW()`
	args := []interface{}{}
	argIndex := 1

	for field, value := range updates {
		if field == "email" {
			query += fmt.Sprintf(", email = $%d", argIndex)
			args = append(args, value)
			argIndex++
		} else if field == "name" {
			query += fmt.Sprintf(", name = $%d", argIndex)
			args = append(args, value)
			argIndex++
		}
		// Add other fields as needed
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIndex)
	args = append(args, userID)

	_, err := usi.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update user profile: %w", err)
	}

	// Invalidate cache
	if userDomainCache, ok := usi.userCache.(*UserDomainCache); ok {
		if err := userDomainCache.InvalidateUser(ctx, userID); err != nil {
			usi.logger.Error("Failed to invalidate user cache", "user_id", userID, "error", err)
		}
	}

	usi.logger.Info("User profile updated", "user_id", userID)
	return nil
}

// BillingServiceIntegration demonstrates billing service specific caching
type BillingServiceIntegration struct {
	*ExampleService
	billingCache DomainCache
}

// NewBillingServiceIntegration creates a billing service with domain-specific caching
func NewBillingServiceIntegration(db *sql.DB, redisConfig RedisConfig, logger Logger) (*BillingServiceIntegration, error) {
	baseService, err := NewExampleService(db, redisConfig, logger)
	if err != nil {
		return nil, err
	}

	// Get billing domain cache
	billingCache, exists := baseService.cacheManager.GetCache(BillingDomainCacheType)
	if !exists {
		return nil, fmt.Errorf("billing domain cache not found")
	}

	return &BillingServiceIntegration{
		ExampleService: baseService,
		billingCache:   billingCache,
	}, nil
}

// GetTokenBalance demonstrates billing cache usage
func (bsi *BillingServiceIntegration) GetTokenBalance(ctx context.Context, userID, tokenType string) (int64, error) {
	// Use domain-specific cache method
	if billingDomainCache, ok := bsi.billingCache.(*BillingDomainCache); ok {
		balance, err := billingDomainCache.GetTokenBalance(ctx, userID, tokenType)
		if err == nil && balance != nil {
			if balanceInt, ok := balance.(int64); ok {
				bsi.logger.Debug("Token balance cache hit", "user_id", userID, "token_type", tokenType)
				return balanceInt, nil
			}
		}
	}

	// Cache miss - fetch from database
	bsi.logger.Debug("Token balance cache miss", "user_id", userID, "token_type", tokenType)
	query := `SELECT balance FROM billing_domain.token_balances WHERE user_id = $1 AND token_type = $2`
	row := bsi.db.QueryRowContext(ctx, query, userID, tokenType)

	var balance int64
	if err := row.Scan(&balance); err != nil {
		if err == sql.ErrNoRows {
			return 0, nil // Return 0 for no balance
		}
		return 0, err
	}

	// Cache the balance
	if billingDomainCache, ok := bsi.billingCache.(*BillingDomainCache); ok {
		if err := billingDomainCache.SetTokenBalance(ctx, userID, tokenType, balance); err != nil {
			bsi.logger.Error("Failed to cache token balance", "user_id", userID, "token_type", tokenType, "error", err)
		}
	}

	return balance, nil
}

// UpdateTokenBalance demonstrates cache invalidation on update
func (bsi *BillingServiceIntegration) UpdateTokenBalance(ctx context.Context, userID, tokenType string, newBalance int64) error {
	// Update database
	query := `UPDATE billing_domain.token_balances SET balance = $1, updated_at = NOW() WHERE user_id = $2 AND token_type = $3`
	_, err := bsi.db.ExecContext(ctx, query, newBalance, userID, tokenType)
	if err != nil {
		return fmt.Errorf("failed to update token balance: %w", err)
	}

	// Invalidate cache
	if _, ok := bsi.billingCache.(*BillingDomainCache); ok {
		cacheKey := fmt.Sprintf("balance:%s:%s", userID, tokenType)
		if err := bsi.billingCache.Delete(ctx, cacheKey); err != nil {
			bsi.logger.Error("Failed to invalidate token balance cache", "user_id", userID, "token_type", tokenType, "error", err)
		}
	}

	bsi.logger.Info("Token balance updated", "user_id", userID, "token_type", tokenType, "new_balance", newBalance)
	return nil
}

// CacheWarmupExample demonstrates cache warmup strategies
func CacheWarmupExample() {
	// Initialize cache factory
	factory := NewCacheFactory(&StdLoggerAdapter{logger: log.Default()})

	// Load configuration from environment
	if err := factory.LoadConfigFromEnv(); err != nil {
		log.Printf("Failed to load cache config: %v", err)
		return
	}

	// Get cache service
	cacheService, err := factory.GetCacheService("example")
	if err != nil {
		log.Printf("Failed to get cache service: %v", err)
		return
	}

	// Create cache warmer
	warmer := NewCacheWarmer(cacheService, &StdLoggerAdapter{logger: log.Default()})

	// Add warmup jobs for frequently accessed data
	warmer.AddWarmupJob(WarmupJob{
		Name: "admin_user_profile",
		Key:  "user:admin",
		TTL:  time.Hour,
		Operation: func(ctx context.Context) (interface{}, error) {
			// Simulate fetching admin user profile
			return map[string]interface{}{
				"id":    "admin",
				"email": "admin@example.com",
				"role":  "administrator",
			}, nil
		},
		Priority: 1,
	})

	warmer.AddWarmupJob(WarmupJob{
		Name: "system_config",
		Key:  "admin:config:system",
		TTL:  time.Hour * 2,
		Operation: func(ctx context.Context) (interface{}, error) {
			// Simulate fetching system configuration
			return map[string]interface{}{
				"maintenance_mode": false,
				"max_users":        10000,
				"feature_flags":    map[string]bool{"new_ui": true},
			}, nil
		},
		Priority: 2,
	})

	// Execute warmup
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute*5)
	defer cancel()

	if err := warmer.Warmup(ctx); err != nil {
		log.Printf("Cache warmup failed: %v", err)
	} else {
		log.Println("Cache warmup completed successfully")
	}
}

// HealthCheckExample demonstrates cache health monitoring
func HealthCheckExample() {
	// Initialize cache factory
	factory := NewCacheFactory(&StdLoggerAdapter{logger: log.Default()})

	// Load configuration
	if err := factory.LoadConfigFromEnv(); err != nil {
		log.Printf("Failed to load cache config: %v", err)
		return
	}

	// Get cache service
	cacheService, err := factory.GetCacheService("health_check")
	if err != nil {
		log.Printf("Failed to get cache service: %v", err)
		return
	}

	// Create health checker
	healthChecker := NewCacheHealthChecker(cacheService, &StdLoggerAdapter{logger: log.Default()})

	// Perform health check
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()

	if err := healthChecker.CheckHealth(ctx); err != nil {
		log.Printf("Cache health check failed: %v", err)
	} else {
		log.Println("Cache health check passed")
	}

	// Simple health check
	if healthChecker.IsHealthy(ctx) {
		log.Println("Cache is healthy")
	} else {
		log.Println("Cache is unhealthy")
	}
}

// ServiceStartupExample demonstrates how to initialize caching in a service
func ServiceStartupExample() (*ExampleService, error) {
	// Initialize database connection
	db, err := sql.Open("postgres", "your-connection-string")
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	defer db.Close()

	// Configure Redis
	redisConfig := RedisConfig{
		Addresses:    []string{"localhost:6379"},
		Password:     "",
		Database:     0,
		MaxRetries:   3,
		PoolSize:     10,
		DialTimeout:  5,
		ReadTimeout:  3,
		WriteTimeout: 3,
		IdleTimeout:  300,
		PoolTimeout:  30,
		MaxConnAge:   1440,
	}

	// Create logger
	logger := &DefaultLogger{} // Implement Logger interface

	// Create service with caching
	service, err := NewExampleService(db, redisConfig, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create service: %w", err)
	}

	// Initialize cache warmup
	go CacheWarmupExample()

	// Start health monitoring
	go func() {
		ticker := time.NewTicker(time.Minute * 5)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
			healthChecker := NewCacheHealthChecker(service.middleware.cache, logger)
			if !healthChecker.IsHealthy(ctx) {
				logger.Error("Cache health check failed", nil)
			}
			cancel()
		}
	}()

	return service, nil
}

// DefaultLogger implements the Logger interface for examples
type DefaultLogger struct{}

func (dl *DefaultLogger) Info(msg string, fields ...interface{}) {
	log.Printf("[INFO] %s %v", msg, fields)
}

func (dl *DefaultLogger) Error(msg string, fields ...interface{}) {
	log.Printf("[ERROR] %s %v", msg, fields)
}

func (dl *DefaultLogger) Warn(msg string, fields ...interface{}) {
	log.Printf("[WARN] %s %v", msg, fields)
}

func (dl *DefaultLogger) Debug(msg string, fields ...interface{}) {
	log.Printf("[DEBUG] %s %v", msg, fields)
}
