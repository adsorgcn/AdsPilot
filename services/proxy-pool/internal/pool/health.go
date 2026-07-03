package pool

import (
	"context"
	"encoding/json"
	"math"
	"time"

	"github.com/redis/go-redis/v9"
)

type HealthData struct {
	Successes         int `json:"successes"`
	Failures          int `json:"failures"`
	TotalResponseTime int `json:"totalResponseTime"` // milliseconds
}

// GetProxyHealthScore returns score 0-100 based on success rate and response time
func GetProxyHealthScore(ctx context.Context, rdb *redis.Client, proxy string) (int, error) {
	healthKey := "proxy:" + proxy + ":health"
	data, err := rdb.Get(ctx, healthKey).Result()

	if err == redis.Nil {
		return 50, nil // default score for new proxy
	}
	if err != nil {
		return 50, err
	}

	var health HealthData
	if err := json.Unmarshal([]byte(data), &health); err != nil {
		return 50, nil
	}

	total := health.Successes + health.Failures
	if total == 0 {
		return 50, nil
	}

	// Success rate weight: 70%
	successRate := float64(health.Successes) / float64(total)

	// Response time weight: 30%
	avgResponseTime := float64(5000) // default 5s
	if health.Successes > 0 {
		avgResponseTime = float64(health.TotalResponseTime) / float64(health.Successes)
	}

	// <1s=100 points, >10s=0 points
	responseScore := math.Max(0, 100-(avgResponseTime/100))

	score := int(math.Round(successRate*70 + (responseScore/100)*30))
	return clamp(score, 0, 100), nil
}

// UpdateProxyHealth updates health statistics
func UpdateProxyHealth(ctx context.Context, rdb *redis.Client, proxy string, success bool, responseTimeMs int) error {
	healthKey := "proxy:" + proxy + ":health"
	data, err := rdb.Get(ctx, healthKey).Result()

	health := HealthData{}
	if err == nil {
		json.Unmarshal([]byte(data), &health)
	}

	if success {
		health.Successes++
		if responseTimeMs > 0 {
			health.TotalResponseTime += responseTimeMs
		}
	} else {
		health.Failures++
	}

	jsonData, _ := json.Marshal(health)
	return rdb.Set(ctx, healthKey, jsonData, 24*time.Hour).Err()
}

func clamp(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}
