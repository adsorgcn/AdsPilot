package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// RateLimiterStore 存储每个用户的速率限制器
type RateLimiterStore struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	rate     rate.Limit // 每秒允许的请求数
	burst    int        // 允许的突发请求数
}

// NewRateLimiterStore 创建新的速率限制器存储
func NewRateLimiterStore(requestsPerMinute int, burst int) *RateLimiterStore {
	r := float64(requestsPerMinute) / 60.0 // 转换为每秒速率
	return &RateLimiterStore{
		limiters: make(map[string]*rate.Limiter),
		rate:     rate.Limit(r),
		burst:    burst,
	}
}

// GetLimiter 获取或创建用户的速率限制器
func (s *RateLimiterStore) GetLimiter(userID string) *rate.Limiter {
	s.mu.RLock()
	limiter, exists := s.limiters[userID]
	s.mu.RUnlock()

	if exists {
		return limiter
	}

	// 创建新的限制器
	s.mu.Lock()
	defer s.mu.Unlock()

	// Double-check（避免并发创建）
	if limiter, exists := s.limiters[userID]; exists {
		return limiter
	}

	limiter = rate.NewLimiter(s.rate, s.burst)
	s.limiters[userID] = limiter

	return limiter
}

// CleanupOldLimiters 定期清理不活跃的限制器（可选）
func (s *RateLimiterStore) CleanupOldLimiters(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			s.mu.Lock()
			// 简单实现：清空所有（生产环境应该追踪最后使用时间）
			s.limiters = make(map[string]*rate.Limiter)
			s.mu.Unlock()
		}
	}()
}

// RateLimitMiddleware 速率限制中间件
// 使用示例: mux.Handle("/api/v1/offers/{id}/evaluate", RateLimitMiddleware(store)(handler))
func RateLimitMiddleware(store *RateLimiterStore) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 从context获取userID（由AuthMiddleware注入）
			userID, ok := r.Context().Value("userID").(string)
			if !ok || userID == "" {
				// 未认证用户，使用IP地址
				userID = getClientIP(r)
			}

			limiter := store.GetLimiter(userID)

			if !limiter.Allow() {
				// 计算Retry-After时间
				reservation := limiter.Reserve()
				retryAfter := reservation.Delay()
				reservation.Cancel() // 取消预约

				w.Header().Set("Retry-After", fmt.Sprintf("%.0f", retryAfter.Seconds()))
				w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", store.burst))
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", time.Now().Add(retryAfter).Unix()))

				http.Error(w, `{"code":"RATE_LIMIT_EXCEEDED","message":"Too many requests, please try again later"}`, http.StatusTooManyRequests)
				return
			}

			// 添加速率限制响应头
			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", store.burst))
			// 注意：rate.Limiter不直接提供remaining count，这里简化处理
			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", int(limiter.Tokens())))

			next.ServeHTTP(w, r)
		})
	}
}

// getClientIP 获取客户端IP地址
func getClientIP(r *http.Request) string {
	// 优先检查 X-Forwarded-For（来自负载均衡器/代理）
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// 取第一个IP（客户端真实IP）
		return xff
	}

	// 检查 X-Real-IP
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// 最后使用 RemoteAddr
	return r.RemoteAddr
}

// RedisRateLimiter 基于Redis的分布式速率限制器（可选，用于多实例部署）
type RedisRateLimiter struct {
	// TODO: 使用Redis实现分布式速率限制
	// 参考: https://redis.io/docs/manual/patterns/rate-limiting/
}
