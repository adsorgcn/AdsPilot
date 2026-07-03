package pool

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type Manager struct {
	rdb               *redis.Client
	rateLimiter       *RateLimiter
	proxyProviderURLs map[string]string // country -> provider URL
	batchSize         int
	proxyTTL          int
	lowWaterMark      int
	isRefilling       map[string]bool // country -> refilling status
	refillingMu       sync.Mutex
	ctx               context.Context
}

var _ ManagerInterface = (*Manager)(nil)

type ProxyWithScore struct {
	Proxy string
	Score int
}

func NewManager(ctx context.Context, rdb *redis.Client, providerURLs map[string]string, batchSize, proxyTTL, lowWaterMark, rateLimitMs int) *Manager {
	m := &Manager{
		rdb:               rdb,
		rateLimiter:       NewRateLimiter(rateLimitMs),
		proxyProviderURLs: providerURLs,
		batchSize:         batchSize,
		proxyTTL:          proxyTTL,
		lowWaterMark:      lowWaterMark,
		isRefilling:       make(map[string]bool),
		ctx:               ctx,
	}

	// Prefill pools for all configured countries
	for country := range providerURLs {
		go m.prefillPool(country)
	}

	// Periodic refill checker for all countries
	go m.periodicRefillChecker()

	return m
}

// prefillPool fills 200 proxies on startup for a specific country
func (m *Manager) prefillPool(country string) {
	poolKey := "proxy:available:" + country
	available, _ := m.rdb.LLen(m.ctx, poolKey).Result()
	target := 200

	if available >= 100 {
		log.Printf("[ProxyPool:%s] Pool already filled: %d proxies available", country, available)
		return
	}

	needed := (target - int(available) + m.batchSize - 1) / m.batchSize
	log.Printf("[ProxyPool:%s] Prefilling proxy pool: %d → %d (%d batches)", country, available, target, needed)

	for i := 0; i < needed; i++ {
		m.rateLimiter.Acquire()
		if err := m.RefillProxies(country); err != nil {
			log.Printf("[ProxyPool:%s] Prefill error: %v", country, err)
			break
		}

		current, _ := m.rdb.LLen(m.ctx, poolKey).Result()
		log.Printf("[ProxyPool:%s] Prefill progress: %d/%d", country, current, target)

		if current >= int64(target) {
			break
		}
	}

	final, _ := m.rdb.LLen(m.ctx, poolKey).Result()
	log.Printf("[ProxyPool:%s] Prefill completed: %d proxies ready", country, final)
}

// periodicRefillChecker checks pool water level every 5 seconds for all countries
func (m *Manager) periodicRefillChecker() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		for country := range m.proxyProviderURLs {
			poolKey := "proxy:available:" + country
			available, err := m.rdb.LLen(m.ctx, poolKey).Result()
			if err != nil {
				continue
			}

			m.refillingMu.Lock()
			isRefilling := m.isRefilling[country]
			m.refillingMu.Unlock()

			if available < int64(m.lowWaterMark) && !isRefilling {
				log.Printf("[ProxyPool:%s] Periodic check: low water mark (%d < %d), refilling...", country, available, m.lowWaterMark)
				go m.backgroundRefill(country)
			}
		}
	}
}

// GetProxy allocates best proxy for target URL with optional country filter
func (m *Manager) GetProxy(targetURL string, country string) (string, error) {
	// Default to first available country if not specified
	if country == "" {
		for c := range m.proxyProviderURLs {
			country = c
			break
		}
	}

	// Validate country is configured
	if _, exists := m.proxyProviderURLs[country]; !exists {
		return "", fmt.Errorf("country %s not configured", country)
	}

	poolKey := "proxy:available:" + country

	// Get all available proxies for this country
	proxies, err := m.rdb.LRange(m.ctx, poolKey, 0, -1).Result()
	if err != nil {
		return "", err
	}

	// Trigger background refill if low
	m.refillingMu.Lock()
	isRefilling := m.isRefilling[country]
	m.refillingMu.Unlock()

	if len(proxies) < m.lowWaterMark && !isRefilling {
		log.Printf("[ProxyPool:%s] Low water mark triggered (%d < %d), background refilling...", country, len(proxies), m.lowWaterMark)
		go m.backgroundRefill(country)
	}

	// If pool empty, refill synchronously
	if len(proxies) == 0 {
		log.Printf("[ProxyPool:%s] Pool empty, refilling...", country)
		m.rateLimiter.Acquire()
		if err := m.RefillProxies(country); err != nil {
			return "", fmt.Errorf("failed to refill: %w", err)
		}
		return m.GetProxy(targetURL, country)
	}

	// Get URL's used proxies history
	urlHash := hashURL(targetURL)
	usedProxies, _ := m.rdb.SMembers(m.ctx, "url:"+urlHash+":used_proxies").Result()
	usedSet := make(map[string]bool)
	for _, p := range usedProxies {
		usedSet[p] = true
	}

	// Filter out already used proxies
	var candidates []string
	for _, p := range proxies {
		if !usedSet[p] {
			candidates = append(candidates, p)
		}
	}

	if len(candidates) == 0 {
		log.Printf("[ProxyPool:%s] All %d proxies used for %s, resetting history", country, len(proxies), extractHostname(targetURL))
		m.rdb.Del(m.ctx, "url:"+urlHash+":used_proxies")
		candidates = proxies
	}

	// Score and sort candidates
	var withScores []ProxyWithScore
	for _, proxy := range candidates {
		score, _ := GetProxyHealthScore(m.ctx, m.rdb, proxy)
		withScores = append(withScores, ProxyWithScore{Proxy: proxy, Score: score})
	}

	sort.Slice(withScores, func(i, j int) bool {
		return withScores[i].Score > withScores[j].Score
	})

	selected := withScores[0].Proxy

	// Remove from available pool
	m.rdb.LRem(m.ctx, poolKey, 1, selected)

	// Mark as used for this URL (24h TTL)
	m.rdb.SAdd(m.ctx, "url:"+urlHash+":used_proxies", selected)
	m.rdb.Expire(m.ctx, "url:"+urlHash+":used_proxies", 24*time.Hour)

	// Mark as locked globally (2min TTL)
	lockKey := "proxy:" + selected + ":locked"
	lockData := map[string]interface{}{
		"targetUrl": targetURL,
		"urlHash":   urlHash,
		"country":   country,
		"timestamp": time.Now().Unix(),
	}
	jsonData, _ := json.Marshal(lockData)
	m.rdb.Set(m.ctx, lockKey, jsonData, 2*time.Minute)

	log.Printf("[ProxyPool:%s] Allocated proxy: %s... for %s (score: %d, available: %d)",
		country, selected[:min(20, len(selected))], extractHostname(targetURL), withScores[0].Score, len(proxies))

	return selected, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ReleaseProxy returns proxy to pool or discards if unhealthy
func (m *Manager) ReleaseProxy(proxy string, country string, success bool, responseTimeMs int) error {
	// Get country from lock metadata if not provided
	if country == "" {
		lockKey := "proxy:" + proxy + ":locked"
		lockData, err := m.rdb.Get(m.ctx, lockKey).Result()
		if err == nil {
			var metadata map[string]interface{}
			if json.Unmarshal([]byte(lockData), &metadata) == nil {
				if c, ok := metadata["country"].(string); ok {
					country = c
				}
			}
		}
		// Default to first available country if still empty
		if country == "" {
			for c := range m.proxyProviderURLs {
				country = c
				break
			}
		}
	}

	poolKey := "proxy:available:" + country

	// Remove lock
	lockKey := "proxy:" + proxy + ":locked"
	m.rdb.Del(m.ctx, lockKey)

	// Update health data
	if err := UpdateProxyHealth(m.ctx, m.rdb, proxy, success, responseTimeMs); err != nil {
		return err
	}

	score, _ := GetProxyHealthScore(m.ctx, m.rdb, proxy)

	if success {
		// Return to pool if not already there
		exists, _ := m.rdb.LPos(m.ctx, poolKey, proxy, redis.LPosArgs{}).Result()
		if exists == 0 {
			m.rdb.RPush(m.ctx, poolKey, proxy)
		}
		log.Printf("[ProxyPool:%s] Proxy %s... released (healthy, score: %d)", country, proxy[:min(20, len(proxy))], score)
	} else {
		if score < 20 {
			log.Printf("[ProxyPool:%s] Proxy %s... discarded (score: %d < 20)", country, proxy[:min(20, len(proxy))], score)
		} else {
			m.rdb.RPush(m.ctx, poolKey, proxy)
			log.Printf("[ProxyPool:%s] Proxy %s... released (failed but score: %d >= 20)", country, proxy[:min(20, len(proxy))], score)
		}
	}

	return nil
}

// RefillProxies fetches proxies from provider for a specific country
func (m *Manager) RefillProxies(country string) error {
	providerURL, exists := m.proxyProviderURLs[country]
	if !exists {
		return fmt.Errorf("country %s not configured", country)
	}

	poolKey := "proxy:available:" + country
	metadataKey := "proxy:pool:metadata:" + country

	// Build URL with batch size
	fetchURL, err := url.Parse(providerURL)
	if err != nil {
		return err
	}
	q := fetchURL.Query()
	q.Set("ips", fmt.Sprintf("%d", m.batchSize))
	fetchURL.RawQuery = q.Encode()

	log.Printf("[ProxyPool:%s] Fetching %d proxies from provider", country, m.batchSize)
	start := time.Now()

	resp, err := http.Get(fetchURL.String())
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode != 200 {
		return fmt.Errorf("provider returned %d: %s", resp.StatusCode, string(body[:min(200, len(body))]))
	}

	// Parse proxies (format: "ip:port:user:pass")
	lines := strings.Split(strings.TrimSpace(string(body)), "\n")
	var proxies []string
	for _, line := range lines {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			proxies = append(proxies, trimmed)
		}
	}

	if len(proxies) == 0 {
		return fmt.Errorf("provider returned no proxies")
	}

	// Add to Redis
	proxyInterfaces := make([]interface{}, len(proxies))
	for i, p := range proxies {
		proxyInterfaces[i] = p
	}
	m.rdb.RPush(m.ctx, poolKey, proxyInterfaces...)

	// Set metadata
	metadata := map[string]interface{}{
		"count":         len(proxies),
		"fetchedAt":     time.Now().Unix(),
		"fetchDuration": time.Since(start).Milliseconds(),
		"country":       country,
	}
	jsonData, _ := json.Marshal(metadata)
	m.rdb.Set(m.ctx, metadataKey, jsonData, time.Duration(m.proxyTTL)*time.Second)

	log.Printf("[ProxyPool:%s] Refilled pool with %d proxies in %dms", country, len(proxies), time.Since(start).Milliseconds())
	return nil
}

// backgroundRefill refills pool asynchronously for a specific country
func (m *Manager) backgroundRefill(country string) {
	m.refillingMu.Lock()
	if m.isRefilling[country] {
		m.refillingMu.Unlock()
		return
	}
	m.isRefilling[country] = true
	m.refillingMu.Unlock()

	defer func() {
		m.refillingMu.Lock()
		m.isRefilling[country] = false
		m.refillingMu.Unlock()
	}()

	m.rateLimiter.Acquire()
	if err := m.RefillProxies(country); err != nil {
		log.Printf("[ProxyPool:%s] Background refill error: %v", country, err)
		return
	}

	poolKey := "proxy:available:" + country
	available, _ := m.rdb.LLen(m.ctx, poolKey).Result()
	log.Printf("[ProxyPool:%s] Background refill completed: %d proxies available", country, available)
}

// GetStats returns pool statistics for a specific country or all countries
func (m *Manager) GetStats(country string) (map[string]interface{}, error) {
	if country != "" {
		// Single country stats
		poolKey := "proxy:available:" + country
		metadataKey := "proxy:pool:metadata:" + country

		available, _ := m.rdb.LLen(m.ctx, poolKey).Result()
		metadataStr, _ := m.rdb.Get(m.ctx, metadataKey).Result()

		var metadata map[string]interface{}
		if metadataStr != "" {
			json.Unmarshal([]byte(metadataStr), &metadata)
		}

		return map[string]interface{}{
			"country":   country,
			"available": available,
			"metadata":  metadata,
		}, nil
	}

	// All countries stats
	allStats := make(map[string]interface{})
	for c := range m.proxyProviderURLs {
		poolKey := "proxy:available:" + c
		metadataKey := "proxy:pool:metadata:" + c

		available, _ := m.rdb.LLen(m.ctx, poolKey).Result()
		metadataStr, _ := m.rdb.Get(m.ctx, metadataKey).Result()

		var metadata map[string]interface{}
		if metadataStr != "" {
			json.Unmarshal([]byte(metadataStr), &metadata)
		}

		allStats[c] = map[string]interface{}{
			"available": available,
			"metadata":  metadata,
		}
	}

	return allStats, nil
}

// hashURL creates consistent hash for URL
func hashURL(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return hashString(rawURL)
	}
	combined := parsed.Hostname() + parsed.Path
	return hashString(combined)
}

func hashString(s string) string {
	h := sha256.New()
	h.Write([]byte(s))
	return hex.EncodeToString(h.Sum(nil))[:32]
}

func extractHostname(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	return parsed.Hostname()
}
