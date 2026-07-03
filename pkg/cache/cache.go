package cache

import (
	"context"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	redis "github.com/redis/go-redis/v9"
)

type entry struct {
	val string
	exp time.Time
}

type Cache struct {
	rdb   *redis.Client
	local map[string]entry
	mu    sync.RWMutex
}

const fallbackLocalTTL = time.Minute

// NewFromEnv creates a cache实例，支持 L1 (本地 map) + L2 (Valkey/Redis)。
// 优先读取 VALKEY_URL，其次 REDIS_URL；若均未提供则仅启用本地缓存。
func NewFromEnv() *Cache {
	c := &Cache{local: make(map[string]entry)}

	raw := strings.TrimSpace(os.Getenv("VALKEY_URL"))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv("REDIS_URL"))
	}
	if raw == "" {
		return c
	}

	u, err := url.Parse(raw)
	if err != nil {
		return c
	}

	db := 0
	if p := strings.TrimPrefix(u.Path, "/"); p != "" {
		if n, err := strconv.Atoi(p); err == nil {
			db = n
		}
	}

	var username string
	var password string
	if u.User != nil {
		username = u.User.Username()
		password, _ = u.User.Password()
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     u.Host,
		Username: username,
		Password: password,
		DB:       db,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err == nil {
		c.rdb = rdb
	}

	return c
}

func (c *Cache) Ready() bool { return c != nil && c.rdb != nil }

func (c *Cache) getLocal(key string) (string, bool) {
	if c == nil {
		return "", false
	}
	c.mu.RLock()
	e, ok := c.local[key]
	c.mu.RUnlock()
	if !ok {
		return "", false
	}
	if time.Now().After(e.exp) {
		c.mu.Lock()
		delete(c.local, key)
		c.mu.Unlock()
		return "", false
	}
	return e.val, true
}

func (c *Cache) setLocal(key, val string, ttl time.Duration) {
	if c == nil {
		return
	}
	if ttl <= 0 {
		ttl = fallbackLocalTTL
	}
	c.mu.Lock()
	c.local[key] = entry{val: val, exp: time.Now().Add(ttl)}
	c.mu.Unlock()
}

func (c *Cache) deleteLocal(key string) {
	if c == nil {
		return
	}
	c.mu.Lock()
	delete(c.local, key)
	c.mu.Unlock()
}

func (c *Cache) Get(ctx context.Context, key string) (string, bool) {
	if val, ok := c.getLocal(key); ok {
		return val, true
	}
	if c == nil || c.rdb == nil {
		return "", false
	}
	val, err := c.rdb.Get(ctx, key).Result()
	if err != nil {
		return "", false
	}

	ttl := fallbackLocalTTL
	if d, err := c.rdb.PTTL(ctx, key).Result(); err == nil && d > 0 {
		ttl = d
	}
	c.setLocal(key, val, ttl)
	return val, true
}

func (c *Cache) Set(ctx context.Context, key, val string, ttl time.Duration) {
	if c == nil {
		return
	}
	if c.rdb != nil {
		_ = c.rdb.Set(ctx, key, val, ttl).Err()
	}
	c.setLocal(key, val, ttl)
}

// SetNX sets key only if not exists with TTL. Returns true if set.
func (c *Cache) SetNX(ctx context.Context, key, val string, ttl time.Duration) (bool, error) {
	if c == nil {
		return false, nil
	}

	if c.rdb != nil {
		ok, err := c.rdb.SetNX(ctx, key, val, ttl).Result()
		if err != nil {
			return ok, err
		}
		if ok {
			c.setLocal(key, val, ttl)
		}
		return ok, nil
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if e, ok := c.local[key]; ok && time.Now().Before(e.exp) {
		return false, nil
	}
	exp := ttl
	if exp <= 0 {
		exp = fallbackLocalTTL
	}
	c.local[key] = entry{val: val, exp: time.Now().Add(exp)}
	return true, nil
}

// Del deletes a key from redis and local cache (best-effort).
func (c *Cache) Del(ctx context.Context, key string) {
	if c == nil {
		return
	}
	if c.rdb != nil {
		_ = c.rdb.Del(ctx, key).Err()
	}
	c.deleteLocal(key)
}

// Redis exposes the underlying redis client if available.
func (c *Cache) Redis() *redis.Client { return c.rdb }
