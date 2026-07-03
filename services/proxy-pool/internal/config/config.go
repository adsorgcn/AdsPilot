package config

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port              string
	RedisURL          string
	ProxyProviderURLs map[string]string // country -> provider URL template
	BatchSize         int
	ProxyTTL          int
	LowWaterMark      int
	RateLimitInterval int // milliseconds
}

func Load() *Config {
	batchSize, _ := strconv.Atoi(getEnv("PROXY_BATCH_SIZE", "50"))
	proxyTTL, _ := strconv.Atoi(getEnv("PROXY_TTL", "900"))
	lowWaterMark, _ := strconv.Atoi(getEnv("PROXY_LOW_WATER_MARK", "50"))
	rateLimitInterval, _ := strconv.Atoi(getEnv("RATE_LIMIT_INTERVAL_MS", "10000"))

	// Support both REDIS_URL and legacy REDIS_HOST/REDIS_PORT
	redisURL := strings.TrimSpace(os.Getenv("REDIS_URL"))
	if redisURL == "" {
		host := strings.TrimSpace(os.Getenv("REDIS_HOST"))
		if host != "" {
			port := strings.TrimSpace(getEnv("REDIS_PORT", "6379"))
			if port == "" {
				port = "6379"
			}
			redisURL = fmt.Sprintf("redis://%s:%s", host, port)
		}
	}

	// Parse proxy provider URLs (supports JSON or single URL for backward compatibility)
	proxyURLs := parseProxyURLs()

	return &Config{
		Port:              getEnv("PORT", "8080"),
		RedisURL:          redisURL,
		ProxyProviderURLs: proxyURLs,
		BatchSize:         batchSize,
		ProxyTTL:          proxyTTL,
		LowWaterMark:      lowWaterMark,
		RateLimitInterval: rateLimitInterval,
	}
}

// parseProxyURLs parses PROXY_URLS (JSON) or falls back to legacy PROXY_PROVIDER_URL
func parseProxyURLs() map[string]string {
	// Try JSON format first: {"US": "url1", "UK": "url2", "ROW": "url3"}
	jsonURLs := getEnv("PROXY_URLS", "")
	if jsonURLs != "" {
		var urls map[string]string
		if err := json.Unmarshal([]byte(jsonURLs), &urls); err == nil && len(urls) > 0 {
			return urls
		}
	}

	// Fallback to legacy single URL (default country: ROW)
	singleURL := getEnv("PROXY_PROVIDER_URL", "")
	if singleURL == "" {
		singleURL = getEnv("Proxy_URL_US", "") // Backward compatibility
	}

	if singleURL != "" {
		// Auto-detect country from URL parameter or use ROW as default
		country := "ROW"
		if strings.Contains(singleURL, "cc=US") || strings.Contains(singleURL, "&cc=US") {
			country = "US"
		} else if strings.Contains(singleURL, "cc=UK") {
			country = "UK"
		}
		return map[string]string{country: singleURL}
	}

	return map[string]string{}
}

// ParseRedisURL parses Redis URL and returns host:port
func (c *Config) ParseRedisURL() (string, error) {
	if strings.TrimSpace(c.RedisURL) == "" {
		return "", nil
	}
	u, err := url.Parse(c.RedisURL)
	if err != nil {
		return "", err
	}
	return u.Host, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
