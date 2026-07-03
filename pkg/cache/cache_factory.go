// Package cache provides cache factory and configuration management
package cache

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// CacheFactory creates and manages cache instances
type CacheFactory struct {
	configs   map[string]CacheConfig
	logger    Logger
	instances map[string]CacheService
}

// NewCacheFactory creates a new cache factory
func NewCacheFactory(logger Logger) *CacheFactory {
	return &CacheFactory{
		configs:   make(map[string]CacheConfig),
		logger:    logger,
		instances: make(map[string]CacheService),
	}
}

// LoadConfigFromFile loads cache configuration from file
func (cf *CacheFactory) LoadConfigFromFile(configPath string) error {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read cache config file: %w", err)
	}

	var config CacheConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse cache config: %w", err)
	}

	cf.configs["default"] = config
	cf.logger.Info("Cache configuration loaded", "file", configPath)
	return nil
}

// LoadConfigFromEnv loads cache configuration from environment variables
func (cf *CacheFactory) LoadConfigFromEnv() error {
	config := CacheConfig{
		Redis: RedisConfig{
			Addresses:    []string{getEnv("REDIS_ADDRESS", "localhost:6379")},
			Password:     getEnv("REDIS_PASSWORD", ""),
			Database:     getEnvInt("REDIS_DATABASE", 0),
			MaxRetries:   getEnvInt("REDIS_MAX_RETRIES", 3),
			PoolSize:     getEnvInt("REDIS_POOL_SIZE", 10),
			DialTimeout:  getEnvInt("REDIS_DIAL_TIMEOUT", 5),
			ReadTimeout:  getEnvInt("REDIS_READ_TIMEOUT", 3),
			WriteTimeout: getEnvInt("REDIS_WRITE_TIMEOUT", 3),
			IdleTimeout:  getEnvInt("REDIS_IDLE_TIMEOUT", 300),
			PoolTimeout:  getEnvInt("REDIS_POOL_TIMEOUT", 30),
			MaxConnAge:   getEnvInt("REDIS_MAX_CONN_AGE", 1440),
		},
		DefaultTTL:     getEnvDuration("CACHE_DEFAULT_TTL", time.Hour),
		MaxMemory:      getEnvInt64("CACHE_MAX_MEMORY", 1024*1024*1024), // 1GB
		EvictionPolicy: getEnv("CACHE_EVICTION_POLICY", "allkeys-lru"),
		Compression:    getEnvBool("CACHE_COMPRESSION", false),
		Encryption:     getEnvBool("CACHE_ENCRYPTION", false),
		Metrics: MetricsConfig{
			Enabled:      getEnvBool("CACHE_METRICS_ENABLED", true),
			Interval:     getEnvDuration("CACHE_METRICS_INTERVAL", time.Minute*5),
			Retention:    getEnvDuration("CACHE_METRICS_RETENTION", time.Hour*24),
			ExportFormat: getEnv("CACHE_METRICS_EXPORT_FORMAT", "json"),
		},
		Domains: make(map[string]DomainConfig),
	}

	// Load domain-specific configurations
	cf.loadDomainConfigs(&config)

	cf.configs["default"] = config
	cf.logger.Info("Cache configuration loaded from environment", "domains", len(config.Domains))
	return nil
}

// loadDomainConfigs loads domain-specific configurations from environment
func (cf *CacheFactory) loadDomainConfigs(config *CacheConfig) {
	// User Domain
	config.Domains["user"] = DomainConfig{
		Name:           "user",
		TTL:            getEnvDuration("USER_CACHE_TTL", time.Minute*30),
		MaxKeys:        getEnvInt("USER_CACHE_MAX_KEYS", 10000),
		Priority:       getEnvInt("USER_CACHE_PRIORITY", 1),
		HotKeyBoost:    getEnvFloat64("USER_CACHE_HOT_KEY_BOOST", 1.5),
		ColdKeyPenalty: getEnvFloat64("USER_CACHE_COLD_KEY_PENALTY", 0.5),
	}

	// Billing Domain
	config.Domains["billing"] = DomainConfig{
		Name:           "billing",
		TTL:            getEnvDuration("BILLING_CACHE_TTL", time.Minute*5),
		MaxKeys:        getEnvInt("BILLING_CACHE_MAX_KEYS", 5000),
		Priority:       getEnvInt("BILLING_CACHE_PRIORITY", 2), // Higher priority for financial data
		HotKeyBoost:    getEnvFloat64("BILLING_CACHE_HOT_KEY_BOOST", 2.0),
		ColdKeyPenalty: getEnvFloat64("BILLING_CACHE_COLD_KEY_PENALTY", 0.3),
	}

	// Offer Domain
	config.Domains["offer"] = DomainConfig{
		Name:           "offer",
		TTL:            getEnvDuration("OFFER_CACHE_TTL", time.Minute*10),
		MaxKeys:        getEnvInt("OFFER_CACHE_MAX_KEYS", 15000),
		Priority:       getEnvInt("OFFER_CACHE_PRIORITY", 3),
		HotKeyBoost:    getEnvFloat64("OFFER_CACHE_HOT_KEY_BOOST", 1.2),
		ColdKeyPenalty: getEnvFloat64("OFFER_CACHE_COLD_KEY_PENALTY", 0.7),
	}

	// Ads Domain
	config.Domains["ads"] = DomainConfig{
		Name:           "ads",
		TTL:            getEnvDuration("ADS_CACHE_TTL", time.Hour),
		MaxKeys:        getEnvInt("ADS_CACHE_MAX_KEYS", 20000),
		Priority:       getEnvInt("ADS_CACHE_PRIORITY", 4),
		HotKeyBoost:    getEnvFloat64("ADS_CACHE_HOT_KEY_BOOST", 1.0),
		ColdKeyPenalty: getEnvFloat64("ADS_CACHE_COLD_KEY_PENALTY", 0.8),
	}

	// Activity Domain
	config.Domains["activity"] = DomainConfig{
		Name:           "activity",
		TTL:            getEnvDuration("ACTIVITY_CACHE_TTL", time.Minute),
		MaxKeys:        getEnvInt("ACTIVITY_CACHE_MAX_KEYS", 8000),
		Priority:       getEnvInt("ACTIVITY_CACHE_PRIORITY", 2),
		HotKeyBoost:    getEnvFloat64("ACTIVITY_CACHE_HOT_KEY_BOOST", 1.8),
		ColdKeyPenalty: getEnvFloat64("ACTIVITY_CACHE_COLD_KEY_PENALTY", 0.4),
	}

	// Admin Domain
	config.Domains["admin"] = DomainConfig{
		Name:           "admin",
		TTL:            getEnvDuration("ADMIN_CACHE_TTL", time.Minute*15),
		MaxKeys:        getEnvInt("ADMIN_CACHE_MAX_KEYS", 1000),
		Priority:       getEnvInt("ADMIN_CACHE_PRIORITY", 5), // Highest priority
		HotKeyBoost:    getEnvFloat64("ADMIN_CACHE_HOT_KEY_BOOST", 1.3),
		ColdKeyPenalty: getEnvFloat64("ADMIN_CACHE_COLD_KEY_PENALTY", 0.6),
	}
}

// GetCacheService creates or returns a cache service instance
func (cf *CacheFactory) GetCacheService(name string) (CacheService, error) {
	if instance, exists := cf.instances[name]; exists {
		return instance, nil
	}

	config, exists := cf.configs[name]
	if !exists {
		// Fallback to default configuration
		config = cf.configs["default"]
	}

	service, err := NewCacheService(config, cf.logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create cache service '%s': %w", name, err)
	}

	cf.instances[name] = service
	cf.logger.Info("Cache service created", "name", name)
	return service, nil
}

// GetDomainCache creates or returns a domain cache instance
func (cf *CacheFactory) GetDomainCache(name string) (*CacheManager, error) {
	_, err := cf.GetCacheService(name)
	if err != nil {
		return nil, err
	}

	// Get the service's config
	config := cf.configs[name]
	if config.Domains == nil {
		config = cf.configs["default"]
	}

	manager, err := NewCacheManager(config, cf.logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create cache manager '%s': %w", name, err)
	}

	cf.logger.Info("Domain cache manager created", "name", name)
	return manager, nil
}

// RegisterConfig registers a custom cache configuration
func (cf *CacheFactory) RegisterConfig(name string, config CacheConfig) {
	cf.configs[name] = config
	cf.logger.Info("Cache configuration registered", "name", name)
}

// Close closes all cache instances
func (cf *CacheFactory) Close() error {
	for name, instance := range cf.instances {
		if err := instance.Close(); err != nil {
			cf.logger.Error("Failed to close cache instance", "name", name, "error", err)
		}
	}
	cf.instances = make(map[string]CacheService)
	return nil
}

// Helper functions for environment variable parsing

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := parseInt(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := parseInt64(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvFloat64(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := parseFloat64(value); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := parseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

// Simple parsing functions
func parseInt(s string) (int, error) {
	var i int
	_, err := fmt.Sscanf(s, "%d", &i)
	return i, err
}

func parseInt64(s string) (int64, error) {
	var i int64
	_, err := fmt.Sscanf(s, "%d", &i)
	return i, err
}

func parseFloat64(s string) (float64, error) {
	var f float64
	_, err := fmt.Sscanf(s, "%f", &f)
	return f, err
}

func parseBool(s string) (bool, error) {
	switch s {
	case "true", "1", "yes", "on":
		return true, nil
	case "false", "0", "no", "off":
		return false, nil
	default:
		return false, fmt.Errorf("invalid boolean value: %s", s)
	}
}

// CacheConfigBuilder provides fluent configuration building
type CacheConfigBuilder struct {
	config CacheConfig
}

// NewCacheConfigBuilder creates a new cache configuration builder
func NewCacheConfigBuilder() *CacheConfigBuilder {
	return &CacheConfigBuilder{
		config: CacheConfig{
			Redis: RedisConfig{
				Addresses:    []string{"localhost:6379"},
				MaxRetries:   3,
				PoolSize:     10,
				DialTimeout:  5,
				ReadTimeout:  3,
				WriteTimeout: 3,
				IdleTimeout:  300,
				PoolTimeout:  30,
				MaxConnAge:   1440,
			},
			DefaultTTL:     time.Hour,
			MaxMemory:      1024 * 1024 * 1024, // 1GB
			EvictionPolicy: "allkeys-lru",
			Compression:    false,
			Encryption:     false,
			Metrics: MetricsConfig{
				Enabled:      true,
				Interval:     time.Minute * 5,
				Retention:    time.Hour * 24,
				ExportFormat: "json",
			},
			Domains: make(map[string]DomainConfig),
		},
	}
}

// WithRedis configures Redis connection
func (ccb *CacheConfigBuilder) WithRedis(addresses []string, password string, database int) *CacheConfigBuilder {
	ccb.config.Redis.Addresses = addresses
	ccb.config.Redis.Password = password
	ccb.config.Redis.Database = database
	return ccb
}

// WithDefaultTTL sets the default TTL
func (ccb *CacheConfigBuilder) WithDefaultTTL(ttl time.Duration) *CacheConfigBuilder {
	ccb.config.DefaultTTL = ttl
	return ccb
}

// WithMaxMemory sets the maximum memory usage
func (ccb *CacheConfigBuilder) WithMaxMemory(maxMemory int64) *CacheConfigBuilder {
	ccb.config.MaxMemory = maxMemory
	return ccb
}

// WithCompression enables/disables compression
func (ccb *CacheConfigBuilder) WithCompression(enabled bool) *CacheConfigBuilder {
	ccb.config.Compression = enabled
	return ccb
}

// WithEncryption enables/disables encryption
func (ccb *CacheConfigBuilder) WithEncryption(enabled bool) *CacheConfigBuilder {
	ccb.config.Encryption = enabled
	return ccb
}

// WithMetrics configures metrics collection
func (ccb *CacheConfigBuilder) WithMetrics(enabled bool, interval time.Duration) *CacheConfigBuilder {
	ccb.config.Metrics.Enabled = enabled
	ccb.config.Metrics.Interval = interval
	return ccb
}

// AddDomain adds a domain configuration
func (ccb *CacheConfigBuilder) AddDomain(name string, config DomainConfig) *CacheConfigBuilder {
	ccb.config.Domains[name] = config
	return ccb
}

// Build creates the final cache configuration
func (ccb *CacheConfigBuilder) Build() CacheConfig {
	return ccb.config
}

// Global cache factory instance
var globalCacheFactory *CacheFactory

// InitializeGlobalCacheFactory initializes the global cache factory
func InitializeGlobalCacheFactory(logger Logger) error {
	globalCacheFactory = NewCacheFactory(logger)
	return globalCacheFactory.LoadConfigFromEnv()
}

// GetGlobalCacheFactory returns the global cache factory
func GetGlobalCacheFactory() *CacheFactory {
	return globalCacheFactory
}

// GetGlobalCacheService returns a cache service from the global factory
func GetGlobalCacheService(name string) (CacheService, error) {
	if globalCacheFactory == nil {
		return nil, fmt.Errorf("global cache factory not initialized")
	}
	return globalCacheFactory.GetCacheService(name)
}

// GetGlobalDomainCache returns a domain cache manager from the global factory
func GetGlobalDomainCache(name string) (*CacheManager, error) {
	if globalCacheFactory == nil {
		return nil, fmt.Errorf("global cache factory not initialized")
	}
	return globalCacheFactory.GetDomainCache(name)
}
