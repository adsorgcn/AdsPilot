package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Cache provides Redis caching functionality
type Cache struct {
	client     *redis.Client
	defaultTTL time.Duration
	prefixKey  string
}

// CacheConfig holds cache configuration
type CacheConfig struct {
	SubscriptionTTL time.Duration
	PermissionsTTL  time.Duration
	TokenBalanceTTL time.Duration
}

// NewCache creates a new Redis cache client
func NewCache(client *redis.Client, config *CacheConfig) *Cache {
	return &Cache{
		client:     client,
		defaultTTL: 5 * time.Minute,
		prefixKey:  "gateway",
	}
}

// Subscription represents cached subscription information
type Subscription struct {
	UserID           string    `json:"userId"`
	Tier             string    `json:"tier"` // starter, professional, pro, max, elite
	Status           string    `json:"status"`
	PlanID           string    `json:"planId"`
	CurrentPeriodEnd time.Time `json:"currentPeriodEnd"`
}

// TokenBalance represents cached token balance
type TokenBalance struct {
	UserID    string    `json:"userId"`
	Available int       `json:"available"`
	Reserved  int       `json:"reserved"`
	Total     int       `json:"total"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// TokenReservation represents cached token reservation
type TokenReservation struct {
	ReservationID  string    `json:"reservationId"`
	UserID         string    `json:"userId"`
	Amount         int       `json:"amount"`
	IdempotencyKey string    `json:"idempotencyKey"`
	ExpiresAt      time.Time `json:"expiresAt"`
}

// GetSubscription retrieves cached subscription information
func (c *Cache) GetSubscription(ctx context.Context, userID string) (*Subscription, error) {
	key := c.makeKey("subscription", userID)

	data, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil // Cache miss
	}
	if err != nil {
		return nil, fmt.Errorf("redis get failed: %w", err)
	}

	var sub Subscription
	if err := json.Unmarshal([]byte(data), &sub); err != nil {
		return nil, fmt.Errorf("failed to unmarshal subscription: %w", err)
	}

	return &sub, nil
}

// SetSubscription caches subscription information
func (c *Cache) SetSubscription(ctx context.Context, sub *Subscription, ttl time.Duration) error {
	key := c.makeKey("subscription", sub.UserID)

	data, err := json.Marshal(sub)
	if err != nil {
		return fmt.Errorf("failed to marshal subscription: %w", err)
	}

	if ttl == 0 {
		ttl = c.defaultTTL
	}

	if err := c.client.Set(ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("redis set failed: %w", err)
	}

	return nil
}

// GetPermissions retrieves cached permissions for a tier
func (c *Cache) GetPermissions(ctx context.Context, tier string) ([]string, error) {
	key := c.makeKey("permissions", tier)

	data, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil // Cache miss
	}
	if err != nil {
		return nil, fmt.Errorf("redis get failed: %w", err)
	}

	var permissions []string
	if err := json.Unmarshal([]byte(data), &permissions); err != nil {
		return nil, fmt.Errorf("failed to unmarshal permissions: %w", err)
	}

	return permissions, nil
}

// SetPermissions caches permissions for a tier
func (c *Cache) SetPermissions(ctx context.Context, tier string, permissions []string, ttl time.Duration) error {
	key := c.makeKey("permissions", tier)

	data, err := json.Marshal(permissions)
	if err != nil {
		return fmt.Errorf("failed to marshal permissions: %w", err)
	}

	if ttl == 0 {
		ttl = c.defaultTTL
	}

	if err := c.client.Set(ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("redis set failed: %w", err)
	}

	return nil
}

// GetTokenBalance retrieves cached token balance
func (c *Cache) GetTokenBalance(ctx context.Context, userID string) (*TokenBalance, error) {
	key := c.makeKey("token_balance", userID)

	data, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil // Cache miss
	}
	if err != nil {
		return nil, fmt.Errorf("redis get failed: %w", err)
	}

	var balance TokenBalance
	if err := json.Unmarshal([]byte(data), &balance); err != nil {
		return nil, fmt.Errorf("failed to unmarshal token balance: %w", err)
	}

	return &balance, nil
}

// SetTokenBalance caches token balance
func (c *Cache) SetTokenBalance(ctx context.Context, balance *TokenBalance, ttl time.Duration) error {
	key := c.makeKey("token_balance", balance.UserID)

	data, err := json.Marshal(balance)
	if err != nil {
		return fmt.Errorf("failed to marshal token balance: %w", err)
	}

	if ttl == 0 {
		ttl = 1 * time.Minute // Shorter TTL for token balance
	}

	if err := c.client.Set(ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("redis set failed: %w", err)
	}

	return nil
}

// GetTokenReservation retrieves cached token reservation by idempotency key
func (c *Cache) GetTokenReservation(ctx context.Context, idempotencyKey string) (*TokenReservation, error) {
	key := c.makeKey("token_reservation", idempotencyKey)

	data, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, nil // Cache miss
	}
	if err != nil {
		return nil, fmt.Errorf("redis get error: %w", err)
	}

	var reservation TokenReservation
	if err := json.Unmarshal([]byte(data), &reservation); err != nil {
		return nil, fmt.Errorf("json unmarshal error: %w", err)
	}

	return &reservation, nil
}

// SetTokenReservation caches token reservation by idempotency key
func (c *Cache) SetTokenReservation(ctx context.Context, reservation *TokenReservation, ttl time.Duration) error {
	key := c.makeKey("token_reservation", reservation.IdempotencyKey)

	data, err := json.Marshal(reservation)
	if err != nil {
		return fmt.Errorf("json marshal error: %w", err)
	}

	if err := c.client.Set(ctx, key, data, ttl).Err(); err != nil {
		return fmt.Errorf("redis set error: %w", err)
	}

	return nil
}

// InvalidateTokenReservation removes token reservation from cache
func (c *Cache) InvalidateTokenReservation(ctx context.Context, idempotencyKey string) error {
	key := c.makeKey("token_reservation", idempotencyKey)
	return c.client.Del(ctx, key).Err()
}

// InvalidateSubscription removes subscription from cache
func (c *Cache) InvalidateSubscription(ctx context.Context, userID string) error {
	key := c.makeKey("subscription", userID)
	return c.client.Del(ctx, key).Err()
}

// InvalidateTokenBalance removes token balance from cache
func (c *Cache) InvalidateTokenBalance(ctx context.Context, userID string) error {
	key := c.makeKey("token_balance", userID)
	return c.client.Del(ctx, key).Err()
}

// InvalidatePermissions removes permissions from cache
func (c *Cache) InvalidatePermissions(ctx context.Context, tier string) error {
	key := c.makeKey("permissions", tier)
	return c.client.Del(ctx, key).Err()
}

// IncrementRateLimit increments a rate limit counter with TTL
// Returns the current count after increment
func (c *Cache) IncrementRateLimit(ctx context.Context, key string, ttl time.Duration) (int, error) {
	// Use Redis INCR for atomic increment
	count, err := c.client.Incr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("redis incr error: %w", err)
	}

	// Set expiration on first increment
	if count == 1 {
		if err := c.client.Expire(ctx, key, ttl).Err(); err != nil {
			return int(count), fmt.Errorf("redis expire error: %w", err)
		}
	}

	return int(count), nil
}

// makeKey creates a namespaced cache key
func (c *Cache) makeKey(category, identifier string) string {
	return fmt.Sprintf("%s:%s:%s", c.prefixKey, category, identifier)
}

// Ping checks if Redis connection is alive
func (c *Cache) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

// Close closes the Redis connection
func (c *Cache) Close() error {
	return c.client.Close()
}
