package ratelimit

import (
	"sync"
	"time"
)

// KeyedManager maintains per-key limiters with TTL and naive LRU-style eviction.
type KeyedManager struct {
	ttl     time.Duration
	maxKeys int
	mu      sync.Mutex
	items   map[string]*keyEntry
}

type keyEntry struct {
	lim     *Limiter
	lastUse time.Time
}

func NewKeyedManager(ttl time.Duration, maxKeys int) *KeyedManager {
	if maxKeys <= 0 {
		maxKeys = 1000
	}
	if ttl <= 0 {
		ttl = time.Hour
	}
	return &KeyedManager{ttl: ttl, maxKeys: maxKeys, items: make(map[string]*keyEntry)}
}

// Get returns a limiter for the key, creating one with given rpm/conc if absent.
func (m *KeyedManager) Get(key string, rpm, conc int) *Limiter {
	now := time.Now()
	m.mu.Lock()
	defer m.mu.Unlock()
	if e, ok := m.items[key]; ok {
		e.lastUse = now
		return e.lim
	}
	// create new
	lim := NewLimiter(rpm, conc)
	lim.Start()
	m.items[key] = &keyEntry{lim: lim, lastUse: now}
	m.evictIfNeeded()
	return lim
}

func (m *KeyedManager) evictIfNeeded() {
	n := len(m.items)
	if n <= m.maxKeys {
		m.evictExpired()
		return
	}
	// remove oldest entries until within limit
	// O(n) scan acceptable for small n
	for n > m.maxKeys {
		var oldestKey string
		var oldestTime time.Time
		first := true
		for k, e := range m.items {
			if first || e.lastUse.Before(oldestTime) {
				oldestKey, oldestTime = k, e.lastUse
				first = false
			}
		}
		if oldestKey != "" {
			delete(m.items, oldestKey)
			n--
		} else {
			break
		}
	}
	m.evictExpired()
}

func (m *KeyedManager) evictExpired() {
	// remove expired by ttl
	now := time.Now()
	for k, e := range m.items {
		if now.Sub(e.lastUse) > m.ttl {
			delete(m.items, k)
		}
	}
}
