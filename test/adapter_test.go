package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
)

func main() {
	fmt.Println("=========================================")
	fmt.Println("数据库适配器测试程序")
	fmt.Println("=========================================")

	// 配置
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		// 使用默认值
		databaseURL = "postgresql://postgres:password@localhost:5432/gm_db"
		fmt.Printf("使用默认数据库URL: %s\n", databaseURL)
	}

	service := "useractivity"

	// 测试上下文
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 测试结果
	testResults := make(map[string]bool)

	// 1. 测试直接模式适配器
	testResults["direct_mode"] = testDirectMode(ctx, databaseURL)

	// 2. 测试混合模式适配器
	testResults["hybrid_mode"] = testHybridMode(ctx, databaseURL)

	// 3. 测试模式切换
	testResults["mode_switch"] = testModeSwitch(ctx, databaseURL)

	// 4. 测试查询功能
	testResults["query_function"] = testQueryFunction(ctx, databaseURL)

	// 5. 测试错误处理
	testResults["error_handling"] = testErrorHandling(ctx, databaseURL)

	// 生成测试报告
	generateAdapterTestReport(testResults)
}

func testDirectMode(ctx context.Context, databaseURL string) bool {
	fmt.Println("\n1. 测试直接模式适配器...")

	// 设置环境变量强制使用直接模式
	os.Setenv("USERACTIVITY_DB_ADAPTER_MODE", "direct")

	adapter, err := database.NewAdapter("useractivity", databaseURL)
	if err != nil {
		fmt.Printf("❌ 创建适配器失败: %v\n", err)
		return false
	}
	defer adapter.Close()

	// 检查模式
	mode := adapter.GetMode()
	expectedMode := database.DirectMode

	if mode != expectedMode {
		fmt.Printf("❌ 模式不匹配: 期望 %v, 实际 %v\n", expectedMode, mode)
		return false
	}

	// 测试连接
	if err := adapter.Ping(ctx); err != nil {
		fmt.Printf("❌ 连接测试失败: %v\n", err)
		return false
	}

	fmt.Printf("✅ 直接模式测试通过 (模式: %v)\n", mode)
	return true
}

func testHybridMode(ctx context.Context, databaseURL string) bool {
	fmt.Println("\n2. 测试混合模式适配器...")

	// 设置环境变量强制使用混合模式
	os.Setenv("USERACTIVITY_DB_ADAPTER_MODE", "hybrid")

	adapter, err := database.NewAdapter("useractivity", databaseURL)
	if err != nil {
		fmt.Printf("❌ 创建适配器失败: %v\n", err)
		return false
	}
	defer adapter.Close()

	// 检查模式
	mode := adapter.GetMode()
	expectedMode := database.HybridMode

	if mode != expectedMode {
		fmt.Printf("❌ 模式不匹配: 期望 %v, 实际 %v\n", expectedMode, mode)
		return false
	}

	// 测试连接
	if err := adapter.Ping(ctx); err != nil {
		fmt.Printf("❌ 连接测试失败: %v\n", err)
		return false
	}

	fmt.Printf("✅ 混合模式测试通过 (模式: %v)\n", mode)
	return true
}

func testModeSwitch(ctx context.Context, databaseURL string) bool {
	fmt.Println("\n3. 测试模式切换...")

	adapter, err := database.NewAdapter("useractivity", databaseURL)
	if err != nil {
		fmt.Printf("❌ 创建适配器失败: %v\n", err)
		return false
	}
	defer adapter.Close()

	// 测试初始模式
	initialMode := adapter.GetMode()
	fmt.Printf("初始模式: %v\n", initialMode)

	// 尝试切换到直接模式
	err = adapter.SwitchMode(database.DirectMode, databaseURL)
	if err != nil {
		fmt.Printf("❌ 切换到直接模式失败: %v\n", err)
		return false
	}

	newMode := adapter.GetMode()
	if newMode != database.DirectMode {
		fmt.Printf("❌ 模式切换失败: 期望 %v, 实际 %v\n", database.DirectMode, newMode)
		return false
	}

	// 再次测试连接
	if err := adapter.Ping(ctx); err != nil {
		fmt.Printf("❌ 模式切换后连接测试失败: %v\n", err)
		return false
	}

	fmt.Printf("✅ 模式切换测试通过 (%v -> %v)\n", initialMode, newMode)
	return true
}

func testQueryFunction(ctx context.Context, databaseURL string) bool {
	fmt.Println("\n4. 测试查询功能...")

	adapter, err := database.NewAdapter("useractivity", databaseURL)
	if err != nil {
		fmt.Printf("❌ 创建适配器失败: %v\n", err)
		return false
	}
	defer adapter.Close()

	// 测试简单查询
	rows, err := adapter.Query(ctx, "SELECT 1 as test")
	if err != nil {
		fmt.Printf("❌ 查询测试失败: %v\n", err)
		return false
	}
	defer rows.Close()

	// 尝试读取结果
	var testValue int
	if err := rows.Scan(&testValue); err != nil {
		fmt.Printf("❌ 读取查询结果失败: %v\n", err)
		return false
	}

	if testValue != 1 {
		fmt.Printf("❌ 查询结果不正确: 期望 1, 实际 %d\n", testValue)
		return false
	}

	// 测试执行语句
	result, err := adapter.Exec(ctx, "SELECT 1")
	if err != nil {
		fmt.Printf("❌ 执行语句测试失败: %v\n", err)
		return false
	}

	if result == nil {
		fmt.Printf("❌ 执行结果为空\n")
		return false
	}

	// 获取受影响行数
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		fmt.Printf("❌ 获取受影响行数失败: %v\n", err)
		return false
	}

	fmt.Printf("✅ 查询功能测试通过 (测试值: %d, 受影响行数: %d)\n", testValue, rowsAffected)
	return true
}

func testErrorHandling(ctx context.Context, databaseURL string) bool {
	fmt.Println("\n5. 测试错误处理...")

	adapter, err := database.NewAdapter("useractivity", databaseURL)
	if err != nil {
		fmt.Printf("❌ 创建适配器失败: %v\n", err)
		return false
	}
	defer adapter.Close()

	// 测试无效SQL查询
	_, err = adapter.Query(ctx, "SELECT * FROM non_existent_table")
	if err == nil {
		fmt.Printf("❌ 无效查询应该失败但没有失败\n")
		return false
	}

	fmt.Printf("✅ 错误处理正常 (无效查询正确失败)\n")

	// 测试无效SQL语句
	_, err = adapter.Exec(ctx, "INVALID SQL SYNTAX")
	if err == nil {
		fmt.Printf("❌ 无效语句应该失败但没有失败\n")
		return false
	}

	fmt.Printf("✅ 错误处理正常 (无效语句正确失败)\n")
	return true
}

func generateAdapterTestReport(results map[string]bool) {
	fmt.Println("\n=========================================")
	fmt.Println("适配器测试报告")
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
		fmt.Println("🎉 所有适配器测试通过！")
		fmt.Println("数据库适配器功能正常，支持渐进式迁移")
		os.Exit(0)
	} else {
		fmt.Printf("⚠️  %d个测试失败，请检查适配器实现\n", totalTests-passedTests)
		os.Exit(1)
	}
}
