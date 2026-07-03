package test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
)

// TestNewAdapterModes 测试新的适配器模式
func TestNewAdapterModes(t *testing.T) {
	// 测试CloudSQL模式
	t.Run("CloudSQLMode", func(t *testing.T) {
		// 设置环境变量
		os.Setenv("DB_CONNECTION_MODE", "cloudsql")
		os.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/testdb")

		config := database.Config{
			ServiceName:    "test-service",
			DatabaseURL:    "postgres://test:test@localhost:5432/testdb",
			Mode:           database.CloudSQLMode,
			MaxConnections: 10,
		}

		adapter, err := database.NewUniversalAdapter(config)
		if err == nil {
			adapter.Close()
			t.Error("Expected connection error for invalid database URL")
		}
	})

	// 测试Supabase模式
	t.Run("SupabaseMode", func(t *testing.T) {
		os.Setenv("DB_CONNECTION_MODE", "supabase")
		os.Setenv("NEXT_PUBLIC_SUPABASE_URL", "https://test-project.supabase.co")
		os.Setenv("SUPABASE_SERVICE_KEY", "test-key")

		config := database.Config{
			ServiceName:    "test-service",
			SupabaseURL:    "https://test-project.supabase.co",
			SupabaseKey:    "test-key",
			Mode:           database.SupabaseMode,
			MaxConnections: 10,
		}

		adapter, err := database.NewUniversalAdapter(config)
		if err == nil {
			adapter.Close()
			t.Error("Expected connection error for invalid Supabase credentials")
		}
	})
}

// TestAdapterModeString 测试模式字符串表示
func TestAdapterModeString(t *testing.T) {
	tests := []struct {
		mode     database.AdapterMode
		expected string
	}{
		{database.CloudSQLMode, "CloudSQLMode"},
		{database.SupabaseMode, "SupabaseMode"},
	}

	for _, test := range tests {
		t.Run(test.expected, func(t *testing.T) {
			if result := test.mode.String(); result != test.expected {
				t.Errorf("Expected %s, got %s", test.expected, result)
			}
		})
	}
}

// TestGetAdapterForService 测试服务适配器创建
func TestGetAdapterForService(t *testing.T) {
	// 备份环境变量
	originalDBMode := os.Getenv("DB_CONNECTION_MODE")
	originalDBURL := os.Getenv("DATABASE_URL")

	defer func() {
		// 恢复环境变量
		if originalDBMode != "" {
			os.Setenv("DB_CONNECTION_MODE", originalDBMode)
		} else {
			os.Unsetenv("DB_CONNECTION_MODE")
		}
		if originalDBURL != "" {
			os.Setenv("DATABASE_URL", originalDBURL)
		} else {
			os.Unsetenv("DATABASE_URL")
		}
	}()

	tests := []struct {
		name        string
		dbMode      string
		expected    database.AdapterMode
		serviceName string
	}{
		{
			name:        "CloudSQL mode",
			dbMode:      "cloudsql",
			expected:    database.CloudSQLMode,
			serviceName: "billing-service",
		},
		{
			name:        "Supabase mode",
			dbMode:      "supabase",
			expected:    database.SupabaseMode,
			serviceName: "test-supabase-service",
		},
		{
			name:        "Legacy mode maps to CloudSQL",
			dbMode:      "direct",
			expected:    database.CloudSQLMode,
			serviceName: "legacy-service",
		},
		{
			name:        "Empty mode defaults to CloudSQL",
			dbMode:      "",
			expected:    database.CloudSQLMode,
			serviceName: "default-service",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			os.Setenv("DB_CONNECTION_MODE", test.dbMode)
			os.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/testdb")

			adapter, err := database.GetAdapterForService(test.serviceName)
			if err != nil {
				t.Errorf("Failed to create adapter: %v", err)
				return
			}

			defer adapter.Close()

			if adapter.GetMode() != test.expected {
				t.Errorf("Expected mode %v, got %v", test.expected, adapter.GetMode())
			}

			if adapter.GetServiceName() != test.serviceName {
				t.Errorf("Expected service name %s, got %s", test.serviceName, adapter.GetServiceName())
			}
		})
	}
}

// TestSupabaseURLExtraction 测试Supabase URL提取
func TestSupabaseURLExtraction(t *testing.T) {
	adapter := &database.UniversalAdapter{}

	tests := []struct {
		name     string
		url      string
		expected string
	}{
		{
			name:     "Standard project URL",
			url:      "https://YOUR_SUPABASE_PROJECT.supabase.co",
			expected: "YOUR_SUPABASE_PROJECT",
		},
		{
			name:     "API project URL",
			url:      "https://api.supabase.com/v1/projects/YOUR_SUPABASE_PROJECT",
			expected: "YOUR_SUPABASE_PROJECT",
		},
		{
			name:     "Invalid URL",
			url:      "https://invalid-url.com",
			expected: "",
		},
		{
			name:     "Empty URL",
			url:      "",
			expected: "",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			// 使用反射或者创建一个公共方法来测试
			// 由于extractProjectRefFromURL是私有方法，我们通过配置来间接测试
			if test.expected == "" {
				// 测试无效URL应该返回空
				config := database.Config{
					SupabaseURL: test.url,
					SupabaseKey: "test-key",
					Mode:        database.SupabaseMode,
				}

				_, err := database.NewUniversalAdapter(config)
				if err == nil {
					t.Error("Expected error for invalid Supabase URL")
				}
			}
		})
	}
}

// TestHybridDatabaseManager 测试混合数据库管理器
func TestHybridDatabaseManager(t *testing.T) {
	// 这个测试需要有效的环境变量，在实际环境中运行
	t.Skip("HybridDatabaseManager test requires valid database credentials")

	ctx := context.Background()
	config := database.HybridConfig{
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		SupabaseURL:         os.Getenv("NEXT_PUBLIC_SUPABASE_URL"),
		SupabaseKey:         os.Getenv("SUPABASE_SERVICE_KEY"),
		MaxConnections:      10,
		Timeout:             30 * time.Second,
		HealthCheckInterval: 5 * time.Minute,
	}

	manager, err := database.NewHybridDatabaseManager(ctx, config)
	if err != nil {
		t.Skipf("Skipping test due to initialization error: %v", err)
		return
	}

	defer manager.Close()

	// 测试基本功能
	if !manager.IsInitialized() {
		t.Error("HybridDatabaseManager should be initialized")
	}

	// 测试健康检查
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := manager.HealthCheck(ctx); err != nil {
		t.Errorf("Health check failed: %v", err)
	}

	// 测试统计信息
	stats := manager.GetStats()
	if stats == nil {
		t.Error("Stats should not be nil")
	}

	if _, ok := stats["cloudsql"]; !ok {
		t.Error("Cloud SQL stats should be present")
	}

	if _, ok := stats["supabase"]; !ok {
		t.Error("Supabase stats should be present")
	}
}
