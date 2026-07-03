package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/dbadmin"
)

// DatabaseTestResult 数据库测试结果
type DatabaseTestResult struct {
	Service        string        `json:"service"`
	Database       string        `json:"database"`
	ConnectionTest string        `json:"connection_test"`
	ConnectTime    time.Duration `json:"connect_time"`
	QueryTest      string        `json:"query_test"`
	WriteTest      string        `json:"write_test"`
	Error          string        `json:"error,omitempty"`
	Timestamp      time.Time     `json:"timestamp"`
}

// TestConfig 测试配置
type TestConfig struct {
	DBAdminURL   string
	DBAdminToken string
	TestQueries  map[string]string
	TestTimeout  time.Duration
}

func main() {
	fmt.Println("=== 预发环境 db-admin 数据库连接测试 ===")

	// 加载配置
	config := loadTestConfig()

	// 测试服务
	services := []string{"frontend", "siterank", "offer", "billing", "adscenter"}
	results := make([]DatabaseTestResult, 0, len(services))

	for _, service := range services {
		fmt.Printf("\n🔄 测试 %s 服务...\n", service)
		result := testDatabaseConnection(config, service)
		results = append(results, result)

		// 打印结果
		printTestResult(result)
	}

	// 生成综合报告
	generateTestReport(results)
}

func loadTestConfig() *TestConfig {
	config := &TestConfig{
		DBAdminURL:   os.Getenv("STAGING_DB_ADMIN_URL"),
		DBAdminToken: os.Getenv("STAGING_DB_ADMIN_TOKEN"),
		TestTimeout:  30 * time.Second,
		TestQueries: map[string]string{
			"frontend":  "SELECT 'Supabase connection test' as test",
			"siterank":  "SELECT 'Cloud SQL connection test' as test",
			"offer":     "SELECT 'Cloud SQL connection test' as test",
			"billing":   "SELECT 'Cloud SQL connection test' as test",
			"adscenter": "SELECT 'Cloud SQL connection test' as test",
		},
	}

	// 默认预发环境配置
	if config.DBAdminURL == "" {
		config.DBAdminURL = "https://db-admin-preview-yt54xvsg5q-an.a.run.app"
		log.Printf("使用默认预发环境URL: %s", config.DBAdminURL)
	}

	if config.DBAdminToken == "" {
		config.DBAdminToken = "staging-db-admin-token"
		log.Printf("警告: DB_ADMIN_TOKEN未设置，使用默认测试token")
	}

	return config
}

func testDatabaseConnection(config *TestConfig, service string) DatabaseTestResult {
	result := DatabaseTestResult{
		Service:   service,
		Database:  getDatabaseForService(service),
		Timestamp: time.Now(),
	}

	startTime := time.Now()

	// 1. 连接测试
	db, err := dbadmin.OpenDB(config.DBAdminURL, config.DBAdminToken, service)
	if err != nil {
		result.ConnectionTest = "FAILED"
		result.Error = fmt.Sprintf("连接失败: %v", err)
		result.ConnectTime = time.Since(startTime)
		return result
	}
	defer db.Close()

	connectTime := time.Since(startTime)
	result.ConnectTime = connectTime
	result.ConnectionTest = "SUCCESS"

	// 2. 查询测试
	ctx, cancel := context.WithTimeout(context.Background(), config.TestTimeout)
	defer cancel()

	var queryResult string
	query := config.TestQueries[service]
	err = db.QueryRowContext(ctx, query).Scan(&queryResult)

	if err != nil {
		result.QueryTest = "FAILED"
		result.Error = fmt.Sprintf("查询失败: %v", err)
		return result
	}

	result.QueryTest = "SUCCESS"

	// 3. 写入测试（仅对非关键服务）
	if service != "frontend" && service != "billing" { // 避免在生产相关服务写入数据
		writeQuery := fmt.Sprintf("CREATE TABLE IF NOT EXISTS test_table_%s (id SERIAL PRIMARY KEY, test_data TEXT, created_at TIMESTAMP DEFAULT NOW());", service)

		ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		_, err = db.ExecContext(ctx, writeQuery)
		if err != nil {
			result.WriteTest = "FAILED"
			result.Error = fmt.Sprintf("写入失败: %v", err)
		} else {
			result.WriteTest = "SUCCESS"

			// 清理测试数据
			cleanupQuery := fmt.Sprintf("DROP TABLE IF EXISTS test_table_%s", service)
			db.ExecContext(ctx, cleanupQuery)
		}
	} else {
		result.WriteTest = "SKIPPED" // 生产环境跳过写入测试
	}

	return result
}

func getDatabaseForService(service string) string {
	// 根据服务返回对应的数据库名称
	servicesUsingSupabase := map[string]bool{
		"frontend": true,
		"auth":     true,
	}

	servicesUsingCloudSQL := map[string]bool{
		"offer":        true,
		"siterank":     true,
		"billing":      true,
		"adscenter":    true,
		"useractivity": true,
	}

	if servicesUsingSupabase[service] {
		return "supabase"
	}

	if servicesUsingCloudSQL[service] {
		return "cloudsql"
	}

	return "unknown"
}

func printTestResult(result DatabaseTestResult) {
	fmt.Printf("   📊 服务: %s\n", result.Service)
	fmt.Printf("   🗄️  数据库: %s\n", result.Database)
	fmt.Printf("   🔌 连接测试: %s (耗时: %v)\n", result.ConnectionTest, result.ConnectTime)
	fmt.Printf("   📖 查询测试: %s\n", result.QueryTest)
	fmt.Printf("   ✍️ 写入测试: %s\n", result.WriteTest)

	if result.Error != "" {
		fmt.Printf("   ❌ 错误: %s\n", result.Error)
	}

	// 性能评级
	grade := calculatePerformanceGrade(result)
	fmt.Printf("   🎯 性能评级: %s\n", grade)
}

func calculatePerformanceGrade(result DatabaseTestResult) string {
	if result.ConnectionTest != "SUCCESS" || result.QueryTest != "SUCCESS" {
		return "🔴 F"
	}

	if result.ConnectTime > 5*time.Second {
		return "🟡 C"
	}

	if result.ConnectTime > 2*time.Second {
		return "🟢 B"
	}

	return "🟢 A"
}

func generateTestReport(results []DatabaseTestResult) {
	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("📊 预发环境数据库连接测试报告")
	fmt.Println(strings.Repeat("=", 60))

	successCount := 0
	failureCount := 0
	totalConnectTime := time.Duration(0)

	for _, result := range results {
		if result.ConnectionTest == "SUCCESS" {
			successCount++
		} else {
			failureCount++
		}
		totalConnectTime += result.ConnectTime
	}

	avgConnectTime := time.Duration(0)
	if successCount > 0 {
		avgConnectTime = totalConnectTime / time.Duration(successCount)
	}

	fmt.Printf("测试时间: %s\n", time.Now().Format("2006-01-02 15:04:05"))
	fmt.Printf("测试服务数量: %d\n", len(results))
	fmt.Printf("连接成功率: %.1f%% (%d/%d)\n",
		float64(successCount)/float64(len(results))*100, successCount, len(results))
	fmt.Printf("平均连接时间: %v\n", avgConnectTime)

	fmt.Println("\n详细结果:")
	fmt.Println(strings.Repeat("-", 40))

	for _, result := range results {
		status := "✅"
		if result.ConnectionTest != "SUCCESS" {
			status = "❌"
		}

		fmt.Printf("%s %s | %s | %v\n",
			status,
			padRight(result.Service, 15),
			padRight(result.Database, 12),
			padDuration(result.ConnectTime))
	}

	// 建议和结论
	fmt.Println("\n" + strings.Repeat("-", 40))
	fmt.Println("📋 建议:")

	if failureCount > 0 {
		fmt.Printf("⚠️  发现 %d 个服务连接失败，需要检查配置\n", failureCount)
	} else {
		fmt.Printf("✅ 所有服务连接正常，db-admin服务运行良好\n")
	}

	if avgConnectTime > 3*time.Second {
		fmt.Printf("⚠️  平均连接时间较长 (%v)，建议优化连接池配置\n", avgConnectTime)
	} else {
		fmt.Printf("✅ 连接性能良好，平均响应时间 %v\n", avgConnectTime)
	}

	// 数据库类型统计
	supabaseCount := 0
	cloudsqlCount := 0

	for _, result := range results {
		if result.Database == "supabase" {
			supabaseCount++
		} else {
			cloudsqlCount++
		}
	}

	fmt.Printf("\n📊 数据库类型分布:\n")
	fmt.Printf("   Supabase: %d 个服务\n", supabaseCount)
	fmt.Printf("   Cloud SQL: %d 个服务\n", cloudsqlCount)

	fmt.Println("\n" + strings.Repeat("=", 60))
}

func padRight(s string, width int) string {
	if len(s) >= width {
		return s
	}
	return s + string(make([]byte, width-len(s), ' '))
}

func padDuration(d time.Duration) string {
	return d.String()
}
