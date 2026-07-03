package ratelimitredis

import (
	"context"
	"time"

	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	redis "github.com/redis/go-redis/v9"
)

// tokenBucketLua implements a simple token bucket allowing fractional refill per ms.
// KEYS[1]=key; ARGV: cap, rpm, now_ms
// Returns: {allowed(0|1), remaining_tokens(float), retry_after_ms(int)}
var tokenBucketLua = redis.NewScript(`
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rpm = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local tokens = tonumber(redis.call('HGET', key, 'tokens'))
local last = tonumber(redis.call('HGET', key, 'ts'))
if tokens == nil then tokens = capacity end
if last == nil then last = now end
local elapsed = now - last
if elapsed < 0 then elapsed = 0 end
-- add tokens: rpm per 60000ms
local add = (elapsed * rpm) / 60000.0
tokens = tokens + add
if tokens > capacity then tokens = capacity end
local allowed = 0
if tokens >= 1.0 then
  tokens = tokens - 1.0
  allowed = 1
end
redis.call('HSET', key, 'tokens', tostring(tokens), 'ts', tostring(now))
-- keep short TTL so idle buckets disappear
redis.call('PEXPIRE', key, 120000)
local retry_after = 0
if allowed == 0 then
  local need = 1.0 - tokens
  if need < 0 then need = 0 end
  retry_after = math.floor((need * 60000.0) / rpm)
end
return {allowed, tostring(tokens), retry_after}
`)

type Result struct {
	Allowed      bool
	Remaining    float64
	RetryAfterMs int64
}

// AllowRPM applies a per-key RPM limit using Redis token bucket.
// capacity defaults to rpm.
func AllowRPM(ctx context.Context, c *pcache.Cache, key string, rpm int) (Result, error) {
	if rpm <= 0 || c == nil || !c.Ready() {
		return Result{Allowed: true, Remaining: 0, RetryAfterMs: 0}, nil
	}
	now := time.Now().UnixMilli()
	cap := rpm
	vals, err := tokenBucketLua.Run(ctx, c.Redis(), []string{"rl:" + key}, cap, rpm, now).Result()
	if err != nil {
		// On redis error, default allow to avoid over-blocking
		return Result{Allowed: true, Remaining: 0, RetryAfterMs: 0}, nil
	}
	arr := vals.([]interface{})
	allowed := arr[0].(int64) == 1
	// remaining returned as string
	// we don't parse the float precisely here since it's informational
	retry := arr[2].(int64)
	return Result{Allowed: allowed, Remaining: 0, RetryAfterMs: retry}, nil
}
