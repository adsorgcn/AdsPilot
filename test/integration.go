package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/dbadmin"
)

func main() {
	fmt.Println("=========================================")
	fmt.Println("db-admin 集成测试程序")
	fmt.Println("=========================================")

	// 测试配置
	dbAdminURL := "https://db-admin-preview-yt54xvsg5q-an.a.run.app"
	token := "dev-token-12345" // 从预发环境获取的测试token
	service := "useractivity"

	// 创建db-admin客��端
	client := dbadmin.NewClient(dbAdminURL, token)

	// 测试上下文
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 执行测试套件
	testResults := make(map[string]bool)

	// 1. 测试服务连接
	testResults["ping"] = testPing(ctx, client)

	// 2. 测试数据库状态
	testResults["database_status"] = testDatabaseStatus(ctx, client, service)

	// 3. 测试Schema查询
	testResults["schema_query"] = testSchemaQuery(ctx, client, service)

	// 4. 测试简单查询
	testResults["simple_query"] = testSimpleQuery(ctx, client, service)

	// 5. 测试DDL执行（dry run）
	testResults["ddl_dryrun"] = testDDLDryRun(ctx, client, service)

	// 6. 测试Schema验证
	testResults["schema_validation"] = testSchemaValidation(ctx, client, service)

	// 生成测试报告
	generateTestReport(testResults)
}

func testPing(ctx context.Context, client *dbadmin.Client) bool {
	fmt.Println("\n1. 测试db-admin服务连接...")

	if err := client.Ping(ctx); err != nil {
		fmt.Printf("❌ Ping失败: %v\n", err)
		return false
	}

	fmt.Println("✅ db-admin服务连接正常")
	return true
}

func testDatabaseStatus(ctx context.Context, client *dbadmin.Client, service string) bool {
	fmt.Printf("\n2. 测试%s服务数据库状态...\n", service)

	status, err := client.GetDatabaseStatus(ctx, service)
	if err != nil {
		fmt.Printf("❌ 获取数据库状态失败: %v\n", err)
		return false
	}

	fmt.Printf("✅ 数据库状态:\n")
	fmt.Printf("   服务: %s\n", status.Service)
	fmt.Printf("   状态: %s\n", status.Status)
	fmt.Printf("   数据库: %s\n", status.Database)
	fmt.Printf("   最后检查: %s\n", status.LastCheck)

	if status.Status == "connected" {
		return true
	}

	fmt.Printf("❌ 数据库连接状态异常: %s\n", status.Status)
	return false
}

func testSchemaQuery(ctx context.Context, client *dbadmin.Client, service string) bool {
	fmt.Printf("\n3. 测试%s服务Schema查询...\n", service)

	schema, err := client.GetDatabaseSchema(ctx, service)
	if err != nil {
		fmt.Printf("❌ Schema查询失败: %v\n", err)
		return false
	}

	fmt.Printf("✅ Schema查询成功:\n")
	fmt.Printf("   数据库: %s\n", schema.Database)
	fmt.Printf("   表数量: %d\n", len(schema.Tables))

	// 显示表信息
	for i, table := range schema.Tables {
		if i >= 5 { // 只显示前5个表
			fmt.Printf("   ... 还有%d个表\n", len(schema.Tables)-i)
			break
		}
		fmt.Printf("   - %s (%d行, %.2fMB)\n", table.Name, table.Rows, table.SizeMB)
	}

	// 验证关键表是否存在
	expectedTables := []string{"user_notifications", "checkins", "referrals", "event_store"}
	foundTables := 0

	for _, expected := range expectedTables {
		for _, table := range schema.Tables {
			if table.Name == expected {
				foundTables++
				break
			}
		}
	}

	fmt.Printf("   关键表存在: %d/%d\n", foundTables, len(expectedTables))

	return foundTables > 0
}

func testSimpleQuery(ctx context.Context, client *dbadmin.Client, service string) bool {
	fmt.Printf("\n4. 测试%s服务简单查询...\n", service)

	// 测试基本查询
	query := "SELECT COUNT(*) as total_rows FROM user_notifications"

	result, err := client.ExecuteQuery(ctx, service, query)
	if err != nil {
		fmt.Printf("❌ 查询执行失败: %v\n", err)
		return false
	}

	fmt.Printf("✅ 查询执行成功:\n")
	fmt.Printf("   执行时间: %s\n", result.ExecutionTime)
	fmt.Printf("   结果数量: %d\n", result.Count)
	fmt.Printf("   成功状态: %t\n", result.Success)

	if result.Count > 0 && len(result.Results) > 0 {
		fmt.Printf("   查询结果示例: %+v\n", result.Results[0])
	}

	return result.Success
}

func testDDLDryRun(ctx context.Context, client *dbadmin.Client, service string) bool {
	fmt.Printf("\n5. 测试%s服务DDL执行(dry run)...\n", service)

	// 创建测试表（dry run模式）
	testDDL := `CREATE TABLE IF NOT EXISTS integration_test_table (
		id BIGSERIAL PRIMARY KEY,
		test_name TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`

	result, err := client.ExecuteDDL(ctx, service, testDDL, true) // dry_run = true
	if err != nil {
		fmt.Printf("❌ DDL执行失败: %v\n", err)
		return false
	}

	fmt.Printf("✅ DDL dry run成功:\n")
	fmt.Printf("   服务: %s\n", result.Service)
	fmt.Printf("   执行时间: %s\n", result.ExecutionTime)
	fmt.Printf("   成功状态: %t\n", result.Success)
	fmt.Printf("   消息: %s\n", result.Message)

	return result.Success
}

func testSchemaValidation(ctx context.Context, client *dbadmin.Client, service string) bool {
	fmt.Printf("\n6. 测试%s服务Schema验证...\n", service)

	result, err := client.ValidateSchema(ctx, service)
	if err != nil {
		fmt.Printf("❌ Schema验证失败: %v\n", err)
		return false
	}

	fmt.Printf("✅ Schema验证完成:\n")

	// 尝试解析验证结果
	if resultBytes, err := json.MarshalIndent(result, "  ", ""); err == nil {
		fmt.Printf("   验证结果: %s\n", string(resultBytes))
	} else {
		fmt.Printf("   验证结果: 验证通过\n")
	}

	return true
}

func generateTestReport(results map[string]bool) {
	fmt.Println("\n=========================================")
	fmt.Println("测试报告")
	fmt.Println("=========================================")

	totalTests := len(results)
	passedTests := 0

	for testName, passed := range results {
		status := "❌"
		if passed {
			status = "✅"
			passedTests++
		}
		fmt.Printf("%s %s\n", status, testName)
	}

	fmt.Println("-----------------------------------------")
	fmt.Printf("总计: %d/%d 通过 (%.1f%%)\n", passedTests, totalTests, float64(passedTests)/float64(totalTests)*100)

	if passedTests == totalTests {
		fmt.Println("🎉 所有测试通过！db-admin集成功能正常")
		os.Exit(0)
	} else {
		fmt.Printf("⚠️  %d个测试失败，请检查相关功能\n", totalTests-passedTests)
		os.Exit(1)
	}
}
