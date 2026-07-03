package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// Config represents the gateway middleware configuration
type Config struct {
	Environment        string              `yaml:"environment"`
	Backends           map[string]string   `yaml:"backends"`
	Routes             []RouteConfig       `yaml:"routes"`
	DefaultPermissions map[string][]string `yaml:"defaultPermissions"`
	Redis              RedisConfig         `yaml:"redis"`
	JWT                JWTConfig           `yaml:"jwt"`
	RateLimit          RateLimitConfig     `yaml:"rateLimit"`
}

// RouteConfig defines a single route mapping
type RouteConfig struct {
	Prefix            string   `yaml:"prefix"`
	Backend           string   `yaml:"backend"`
	Methods           []string `yaml:"methods"`
	TokenCost         int      `yaml:"tokenCost"`
	RequireAuth       bool     `yaml:"requireAuth"`
	RequirePermission string   `yaml:"requirePermission"`
	RequireTier       []string `yaml:"requireTier"`
	Description       string   `yaml:"description"`
}

// RedisConfig represents Redis cache configuration
type RedisConfig struct {
	Address     string      `yaml:"address"`
	Password    string      `yaml:"password"`
	DB          int         `yaml:"db"`
	CacheExpiry CacheExpiry `yaml:"cacheExpiry"`
}

// CacheExpiry defines TTL for different cache types
type CacheExpiry struct {
	Subscription time.Duration `yaml:"subscription"`
	Permissions  time.Duration `yaml:"permissions"`
	TokenBalance time.Duration `yaml:"tokenBalance"`
}

// JWTConfig represents JWT validation configuration
type JWTConfig struct {
	ProjectURL string `yaml:"projectURL"`
	Issuer     string `yaml:"issuer"`
	Audience   string `yaml:"audience"`
	Secret     string `yaml:"secret"`
}

// RateLimitConfig represents rate limiting configuration
type RateLimitConfig struct {
	Enabled           bool           `yaml:"enabled"`
	RequestsPerMinute int            `yaml:"requestsPerMinute"`
	BurstSize         int            `yaml:"burstSize"`
	WhitelistIPs      []string       `yaml:"whitelistIPs"`
	BlacklistIPs      []string       `yaml:"blacklistIPs"`
	EndpointLimits    map[string]int `yaml:"endpointLimits"`
}

// Equals compares two RateLimitConfig structs
func (r *RateLimitConfig) Equals(other *RateLimitConfig) bool {
	if r == nil && other == nil {
		return true
	}
	if r == nil || other == nil {
		return false
	}

	if r.Enabled != other.Enabled ||
		r.RequestsPerMinute != other.RequestsPerMinute ||
		r.BurstSize != other.BurstSize ||
		len(r.WhitelistIPs) != len(other.WhitelistIPs) ||
		len(r.BlacklistIPs) != len(other.BlacklistIPs) ||
		len(r.EndpointLimits) != len(other.EndpointLimits) {
		return false
	}

	// Compare slices
	for i, ip := range r.WhitelistIPs {
		if i >= len(other.WhitelistIPs) || ip != other.WhitelistIPs[i] {
			return false
		}
	}

	for i, ip := range r.BlacklistIPs {
		if i >= len(other.BlacklistIPs) || ip != other.BlacklistIPs[i] {
			return false
		}
	}

	// Compare endpoint limits
	for endpoint, limit := range r.EndpointLimits {
		if other.EndpointLimits[endpoint] != limit {
			return false
		}
	}

	return true
}

// Load reads and parses the configuration file
func Load(configPath string) (*Config, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	return parseConfig(data)
}

// parseConfig parses configuration from byte slice
func parseConfig(data []byte) (*Config, error) {
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	// Validate configuration
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &cfg, nil
}

// Validate checks if the configuration is valid
func (c *Config) Validate() error {
	if c.Environment == "" {
		return fmt.Errorf("environment is required")
	}

	if len(c.Backends) == 0 {
		return fmt.Errorf("at least one backend must be configured")
	}

	if len(c.Routes) == 0 {
		return fmt.Errorf("at least one route must be configured")
	}

	// Validate each route
	for i, route := range c.Routes {
		if route.Prefix == "" {
			return fmt.Errorf("route %d: prefix is required", i)
		}
		if route.Backend == "" {
			return fmt.Errorf("route %d: backend is required", i)
		}
		if len(route.Methods) == 0 {
			return fmt.Errorf("route %d: at least one method is required", i)
		}
		// Check if backend exists
		if _, ok := c.Backends[route.Backend]; !ok {
			return fmt.Errorf("route %d: backend '%s' not found in backends", i, route.Backend)
		}
	}

	return nil
}

// FindRoute finds the matching route configuration for the given path and method
func (c *Config) FindRoute(path, method string) *RouteConfig {
	// Simple prefix matching (in production, use a router library)
	var bestMatch *RouteConfig
	longestMatch := 0

	for i := range c.Routes {
		route := &c.Routes[i]
		if len(route.Prefix) > longestMatch && matchesPrefix(path, route.Prefix) {
			// Check if method is allowed
			for _, m := range route.Methods {
				if m == method {
					bestMatch = route
					longestMatch = len(route.Prefix)
					break
				}
			}
		}
	}

	return bestMatch
}

// matchesPrefix checks if path matches the prefix pattern
func matchesPrefix(path, prefix string) bool {
	if len(path) < len(prefix) {
		return false
	}
	// Exact match
	if path[:len(prefix)] == prefix {
		// Either exact match or followed by /
		if len(path) == len(prefix) || (len(path) > len(prefix) && path[len(prefix)] == '/') {
			return true
		}
	}
	return false
}

// GetBackendURL returns the backend URL for the given backend name
func (c *Config) GetBackendURL(backendName string) string {
	return c.Backends[backendName]
}
