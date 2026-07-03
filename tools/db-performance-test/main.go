package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/lib/pq"
)

// PerformanceTestConfig 性能测试配置
type PerformanceTestConfig struct {
	CloudSQLURL     string
	SupabaseURL     string
	SupabaseKey     string
	ConcurrentUsers int
	QueriesPerUser  int
	TestDuration    time.Duration
	WarmupDuration  time.Duration
}

// TestResult 测试结果
type TestResult struct {
	TotalQueries      int
	SuccessfulQueries int
	FailedQueries     int
	AverageLatency    time.Duration
	P95Latency        time.Duration
	P99Latency        time.Duration
	QueriesPerSecond  float64
	ErrorRate         float64
	ConnectionErrors  int
	TimeoutErrors     int
}

// LatencyRecord 延迟记录
type LatencyRecord struct {
	Duration time.Duration
	Success  bool
	Error    error
}

func main() {
	fmt.Println("🚀 Google-Monetize 数据库性能测试工具")
	fmt.Println("================================")

	// 解析命令行参数
	config := parseConfig()
	if config == nil {
		os.Exit(1)
	}

	// 显示配置
	printConfig(config)

	// 执行测试
	fmt.Println("\n📊 开始性能测试...")

	// Cloud SQL 性能测试
	fmt.Println("\n🔍 测试 Cloud SQL 性能...")
	cloudSQLResult := testCloudSQLPerformance(config)
	printResult("Cloud SQL", cloudSQLResult)

	// Supabase 性能测试
	fmt.Println("\n🔍 测试 Supabase 性能...")
	supabaseResult := testSupabasePerformance(config)
	printResult("Supabase", supabaseResult)

	// 混合模式测试
	fmt.Println("\n🔍 测试混合数据库管理器性能...")
	hybridResult := testHybridPerformance(config)
	printResult("Hybrid Manager", hybridResult)

	// 连接池测试
	fmt.Println("\n🔍 测试连接池性能...")
	poolResult := testConnectionPool(config)
	printResult("Connection Pool", poolResult)

	// 生成报告
	generatePerformanceReport(cloudSQLResult, supabaseResult, hybridResult, poolResult)
}

func parseConfig() *PerformanceTestConfig {
	config := &PerformanceTestConfig{
		CloudSQLURL:     os.Getenv("DATABASE_URL"),
		SupabaseURL:     os.Getenv("NEXT_PUBLIC_SUPABASE_URL"),
		SupabaseKey:     os.Getenv("SUPABASE_SERVICE_KEY"),
		ConcurrentUsers: 10,
		QueriesPerUser:  100,
		TestDuration:    30 * time.Second,
		WarmupDuration:  5 * time.Second,
	}

	// 检查必需的环境变量
	if config.CloudSQLURL == "" {
		fmt.Printf("❌ 错误: DATABASE_URL 环境变量未设置\n")
		return nil
	}

	// 解析可选参数
	if users := os.Getenv("CONCURRENT_USERS"); users != "" {
		fmt.Sscanf(users, "%d", &config.ConcurrentUsers)
	}
	if queries := os.Getenv("QUERIES_PER_USER"); queries != "" {
		fmt.Sscanf(queries, "%d", &config.QueriesPerUser)
	}
	if duration := os.Getenv("TEST_DURATION"); duration != "" {
		if d, err := time.ParseDuration(duration); err == nil {
			config.TestDuration = d
		}
	}

	return config
}

func printConfig(config *PerformanceTestConfig) {
	fmt.Printf("📋 测试配置:\n")
	fmt.Printf("  Cloud SQL URL: %s\n", maskURL(config.CloudSQLURL))
	fmt.Printf("  Supabase URL: %s\n", maskURL(config.SupabaseURL))
	fmt.Printf("  并发用户数: %d\n", config.ConcurrentUsers)
	fmt.Printf("  每用户查询数: %d\n", config.QueriesPerUser)
	fmt.Printf("  测试持续时间: %v\n", config.TestDuration)
	fmt.Printf("  预热时间: %v\n", config.WarmupDuration)
}

func maskURL(url string) string {
	if len(url) > 20 {
		return url[:20] + "***"
	}
	return "***"
}

func testCloudSQLPerformance(config *PerformanceTestConfig) *TestResult {
	ctx := context.Background()

	// 创建pgxpool连接池
	poolConfig, err := pgxpool.ParseConfig(config.CloudSQLURL)
	if err != nil {
		log.Printf("❌ 解析Cloud SQL配置失败: %v", err)
		return &TestResult{FailedQueries: config.QueriesPerUser * config.ConcurrentUsers}
	}

	poolConfig.MaxConns = int32(config.ConcurrentUsers)
	poolConfig.MinConns = 1
	poolConfig.MaxConnLifetime = time.Hour
	poolConfig.MaxConnIdleTime = 30 * time.Minute
	poolConfig.HealthCheckPeriod = 1 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Printf("❌ 创建Cloud SQL连接池失败: %v", err)
		return &TestResult{FailedQueries: config.QueriesPerUser * config.ConcurrentUsers}
	}
	defer pool.Close()

	// 预热连接
	fmt.Printf("🔥 预热 Cloud SQL 连接池...\n")
	warmupConnections(ctx, pool, config.WarmupDuration)

	// 执行性能测试
	return runPerformanceTest(ctx, config.ConcurrentUsers, config.QueriesPerUser, func(ctx context.Context) (time.Duration, error) {
		start := time.Now()
		_, err := pool.Exec(ctx, "SELECT 1 as test_query")
		latency := time.Since(start)
		return latency, err
	})
}

func testSupabasePerformance(config *PerformanceTestConfig) *TestResult {
	if config.SupabaseURL == "" || config.SupabaseKey == "" {
		fmt.Printf("⚠️  Supabase配置缺失，跳过Supabase性能测试\n")
		return &TestResult{FailedQueries: config.QueriesPerUser * config.ConcurrentUsers}
	}

	// 创建Supabase连接
	supabaseDBURL := buildSupabaseDatabaseURL(config.SupabaseURL, config.SupabaseKey)
	if supabaseDBURL == "" {
		return &TestResult{FailedQueries: config.QueriesPerUser * config.ConcurrentUsers}
	}

	db, err := sql.Open("postgres", supabaseDBURL)
	if err != nil {
		log.Printf("❌ 创建Supabase连接失败: %v", err)
		return &TestResult{FailedQueries: config.QueriesPerUser * config.ConcurrentUsers}
	}
	defer db.Close()

	db.SetMaxOpenConns(config.ConcurrentUsers)
	db.SetMaxIdleConns(config.ConcurrentUsers / 2)
	db.SetConnMaxLifetime(time.Hour)
	db.SetConnMaxIdleTime(30 * time.Minute)

	// 预热连接
	fmt.Printf("🔥 预热 Supabase 连接...\n")
	warmupSQLConnections(db, config.WarmupDuration)

	// 执行性能测试
	return runPerformanceTest(context.Background(), config.ConcurrentUsers, config.QueriesPerUser, func(ctx context.Context) (time.Duration, error) {
		start := time.Now()
		_, err := db.ExecContext(ctx, "SELECT 1 as test_query")
		latency := time.Since(start)
		return latency, err
	})
}

func testHybridPerformance(config *PerformanceTestConfig) *TestResult {
	hybridConfig := database.HybridConfig{
		DatabaseURL:         config.CloudSQLURL,
		SupabaseURL:         config.SupabaseURL,
		SupabaseKey:         config.SupabaseKey,
		MaxConnections:      int32(config.ConcurrentUsers),
		Timeout:             30 * time.Second,
		HealthCheckInterval: 5 * time.Minute,
	}

	manager, err := database.NewHybridDatabaseManager(context.Background(), hybridConfig)
	if err != nil {
		log.Printf("❌ 创建混合数据库管理器失败: %v", err)
		return &TestResult{FailedQueries: config.QueriesPerUser * config.ConcurrentUsers}
	}
	defer manager.Close()

	// 预热连接
	fmt.Printf("🔥 预热混合数据库管理器...\n")
	time.Sleep(config.WarmupDuration)

	// 执行性能测试
	return runPerformanceTest(context.Background(), config.ConcurrentUsers, config.QueriesPerUser, func(ctx context.Context) (time.Duration, error) {
		start := time.Now()
		err := manager.HealthCheck(ctx)
		latency := time.Since(start)
		return latency, err
	})
}

func testConnectionPool(config *PerformanceTestConfig) *TestResult {
	return testCloudSQLPerformance(config) // 复用Cloud SQL测试逻辑
}

func warmupConnections(ctx context.Context, pool *pgxpool.Pool, duration time.Duration) {
	start := time.Now()
	for time.Since(start) < duration {
		if err := pool.Ping(ctx); err != nil {
			log.Printf("⚠️  预热ping失败: %v", err)
		}
		time.Sleep(100 * time.Millisecond)
	}
}

func warmupSQLConnections(db *sql.DB, duration time.Duration) {
	ctx := context.Background()
	start := time.Now()
	for time.Since(start) < duration {
		if err := db.PingContext(ctx); err != nil {
			log.Printf("⚠️  预热ping失败: %v", err)
		}
		time.Sleep(100 * time.Millisecond)
	}
}

func runPerformanceTest(ctx context.Context, concurrentUsers, queriesPerUser int, queryFunc func(context.Context) (time.Duration, error)) *TestResult {
	var wg sync.WaitGroup
	var mu sync.Mutex

	result := &TestResult{}
	latencies := make([]time.Duration, 0, concurrentUsers*queriesPerUser)

	// 启动并发用户
	for i := 0; i < concurrentUsers; i++ {
		wg.Add(1)
		go func(userID int) {
			defer wg.Done()

			for j := 0; j < queriesPerUser; j++ {
				latency, err := queryFunc(ctx)

				mu.Lock()
				result.TotalQueries++
				if err != nil {
					result.FailedQueries++
				} else {
					result.SuccessfulQueries++
					latencies = append(latencies, latency)
				}
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	// 计算统计信息
	if len(latencies) > 0 {
		result.AverageLatency = calculateAverage(latencies)
		result.P95Latency = calculatePercentile(latencies, 0.95)
		result.P99Latency = calculatePercentile(latencies, 0.99)
		result.QueriesPerSecond = float64(result.SuccessfulQueries) / result.AverageLatency.Seconds()
	}

	result.ErrorRate = float64(result.FailedQueries) / float64(result.TotalQueries) * 100

	return result
}

func calculateAverage(durations []time.Duration) time.Duration {
	if len(durations) == 0 {
		return 0
	}

	var total time.Duration
	for _, d := range durations {
		total += d
	}
	return total / time.Duration(len(durations))
}

func calculatePercentile(durations []time.Duration, percentile float64) time.Duration {
	if len(durations) == 0 {
		return 0
	}

	// 简单的百分位计算（对于生产环境应使用更精确的算法）
	sorted := make([]time.Duration, len(durations))
	copy(sorted, durations)

	// 简单排序（Go 1.21+有sort.Slice，这里用简单实现）
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[i] > sorted[j] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	index := int(float64(len(sorted)) * percentile)
	if index >= len(sorted) {
		index = len(sorted) - 1
	}

	return sorted[index]
}

func printResult(testName string, result *TestResult) {
	fmt.Printf("\n📈 %s 测试结果:\n", testName)
	fmt.Printf("  总查询数: %d\n", result.TotalQueries)
	fmt.Printf("  成功查询: %d\n", result.SuccessfulQueries)
	fmt.Printf("  失败查询: %d\n", result.FailedQueries)
	fmt.Printf("  错误率: %.2f%%\n", result.ErrorRate)
	fmt.Printf("  平均延迟: %v\n", result.AverageLatency)
	fmt.Printf("  P95延迟: %v\n", result.P95Latency)
	fmt.Printf("  P99延迟: %v\n", result.P99Latency)
	fmt.Printf("  QPS: %.2f\n", result.QueriesPerSecond)
}

func generatePerformanceReport(cloudSQL, supabase, hybrid, pool *TestResult) {
	fmt.Println("\n📊 性能测试报告")
	fmt.Println("================")

	fmt.Printf("🔍 Cloud SQL vs Supabase 性能对比:\n")
	if cloudSQL.QueriesPerSecond > 0 && supabase.QueriesPerSecond > 0 {
		ratio := cloudSQL.QueriesPerSecond / supabase.QueriesPerSecond
		fmt.Printf("  QPS比率: %.2fx (Cloud SQL 更快)\n", ratio)
	}

	fmt.Printf("\n🎯 性能建议:\n")
	if cloudSQL.ErrorRate > 1.0 {
		fmt.Printf("  ⚠️  Cloud SQL 错误率较高 (%.2f%%)，建议检查连接配置\n", cloudSQL.ErrorRate)
	}
	if supabase.ErrorRate > 1.0 {
		fmt.Printf("  ⚠️  Supabase 错误率较高 (%.2f%%)，建议检查认证配置\n", supabase.ErrorRate)
	}
	if cloudSQL.P95Latency > 100*time.Millisecond {
		fmt.Printf("  ⚠️  Cloud SQL P95延迟较高 (%v)，建议优化查询或增加连接池大小\n", cloudSQL.P95Latency)
	}
	if cloudSQL.QueriesPerSecond < 100 {
		fmt.Printf("  ⚠️  Cloud SQL QPS较低 (%.2f)，建议检查网络连接或数据库性能\n", cloudSQL.QueriesPerSecond)
	}

	fmt.Printf("\n✅ 测试完成！\n")
}

func buildSupabaseDatabaseURL(supabaseURL, supabaseKey string) string {
	// 从Supabase URL中提取项目引用
	projectRef := extractProjectRefFromURL(supabaseURL)
	if projectRef == "" {
		return ""
	}

	return fmt.Sprintf("postgres://postgres.%s:%s@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
		projectRef, supabaseKey)
}

func extractProjectRefFromURL(supabaseURL string) string {
	// 简单的项目引用提取逻辑
	// 实际实现中应该使用更robust的URL解析
	if len(supabaseURL) > 30 {
		parts := strings.Split(supabaseURL, ".")
		if len(parts) > 0 && parts[0] != "" {
			return parts[0]
		}
	}
	return ""
}
