package redislock

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	redis "github.com/redis/go-redis/v9"
)

// genToken returns a random 16-byte hex token.
func genToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Acquire obtains a lock key with TTL, returning a release function and ok flag.
// When ok=false, release is a no-op.
func Acquire(ctx context.Context, c *pcache.Cache, key string, ttl time.Duration) (release func(), ok bool) {
	if c == nil || !c.Ready() {
		return func() {}, true
	}
	tok := genToken()
	// Use SET NX PX
	okSet, err := c.Redis().SetNX(ctx, key, tok, ttl).Result()
	if err != nil || !okSet {
		return func() {}, false
	}
	// Release uses Lua compare-and-del
	rel := redis.NewScript(`
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end`)
	return func() { _ = rel.Run(context.Background(), c.Redis(), []string{key}, tok).Err() }, true
}
