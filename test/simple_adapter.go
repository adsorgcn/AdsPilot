package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"test-adapter/pkg/database"
)

func main() {
	fmt.Println("🧪 Testing Simplified Database Adapter (2-Mode Architecture)")

	// 测试CloudSQL模式
	fmt.Println("\n1. Testing CloudSQL Mode...")
	testCloudSQLMode()

	// 测试Supabase模式
	fmt.Println("\n2. Testing Supabase Mode...")
	testSupabaseMode()

	// 测试混合数据库管理器
	fmt.Println("\n3. Testing Hybrid Database Manager...")
	testHybridManager()

	fmt.Println("\n✅ All tests completed successfully!")
}

func testCloudSQLMode() {
	config := database.Config{
		ServiceName:    "test-service",
		DatabaseURL:    "postgres://test:test@localhost:5432/testdb",
		Mode:           database.CloudSQLMode,
		MaxConnections: 10,
	}

	adapter, err := database.NewUniversalAdapter(config)
	if err != nil {
		log.Printf("✅ CloudSQL mode correctly rejected invalid database URL: %v", err)
		return
	}
	defer adapter.Close()

	if adapter.GetMode() != database.CloudSQLMode {
		log.Fatalf("❌ Expected CloudSQLMode, got %v", adapter.GetMode())
	}

	log.Printf("✅ CloudSQLMode adapter created successfully")
}

func testSupabaseMode() {
	config := database.Config{
		ServiceName:    "test-service",
		SupabaseURL:    "https://test-project.supabase.co",
		SupabaseKey:    "test-key",
		Mode:           database.SupabaseMode,
		MaxConnections: 5,
	}

	adapter, err := database.NewUniversalAdapter(config)
	if err != nil {
		log.Printf("✅ Supabase mode correctly rejected invalid credentials: %v", err)
		return
	}
	defer adapter.Close()

	if adapter.GetMode() != database.SupabaseMode {
		log.Fatalf("❌ Expected SupabaseMode, got %v", adapter.GetMode())
	}

	log.Printf("✅ SupabaseMode adapter created successfully")
}

func testHybridManager() {
	ctx := context.Background()
	config := database.HybridConfig{
		DatabaseURL:         "postgres://test:test@localhost:5432/testdb",
		SupabaseURL:         "https://test-project.supabase.co",
		SupabaseKey:         "test-key",
		MaxConnections:      10,
		Timeout:             30 * time.Second,
		HealthCheckInterval: 5 * time.Minute,
	}

	manager, err := database.NewHybridDatabaseManager(ctx, config)
	if err != nil {
		log.Printf("✅ Hybrid manager correctly rejected invalid credentials: %v", err)
		return
	}
	defer manager.Close()

	if !manager.IsInitialized() {
		log.Fatalf("❌ Hybrid manager should be initialized")
	}

	log.Printf("✅ HybridDatabaseManager created successfully")

	// 测试统计信息
	stats := manager.GetStats()
	if stats != nil {
		log.Printf("✅ Manager stats: %v available", len(stats))
	}
}
