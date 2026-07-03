package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"
)

// AdapterFactory 适配器工厂，提供不同类型的适配器
type AdapterFactory struct {
	defaultConfig Config
}

// NewAdapterFactory 创建适配器工厂
func NewAdapterFactory() *AdapterFactory {
	return &AdapterFactory{
		defaultConfig: Config{
			Timeout:        30 * time.Second,
			MaxConnections: 20,
		},
	}
}

// CreateServiceAdapter 为指定服务创建适配器
func (f *AdapterFactory) CreateServiceAdapter(serviceName string) (DatabaseAdapter, error) {
	// 检查环境变量设置的模式
	modeStr := os.Getenv("DB_CONNECTION_MODE")
	var mode AdapterMode
	switch modeStr {
	case "cloudsql":
		mode = CloudSQLMode
	case "supabase":
		mode = SupabaseMode
	case "direct", "hybrid", "dbadmin", "":
		// 向后兼容：旧模式映射到CloudSQL模式
		mode = CloudSQLMode // Default to CloudSQL mode
	default:
		log.Printf("Warning: Invalid DB_CONNECTION_MODE '%s', defaulting to CloudSQL mode for service '%s'", modeStr, serviceName)
		mode = CloudSQLMode
	}

	config := f.defaultConfig
	config.ServiceName = serviceName
	config.Mode = mode

	// 从环境变量获取配置
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		config.DatabaseURL = databaseURL
	} else {
		return nil, fmt.Errorf("DATABASE_URL environment variable is required")
	}

	if readURL := os.Getenv("DATABASE_READ_URL"); readURL != "" {
		config.ReadReplicaURL = readURL
	}

	// 检查Supabase配置
	if supabaseURL := os.Getenv("NEXT_PUBLIC_SUPABASE_URL"); supabaseURL != "" {
		config.SupabaseURL = supabaseURL
	}
	if supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY"); supabaseKey != "" {
		config.SupabaseKey = supabaseKey
	}

	// 根据服务类型调整配置
	f.adjustConfigForService(&config, serviceName)

	return NewUniversalAdapter(config)
}

// CreateConsoleAdapter 创建Console服务适配器
func (f *AdapterFactory) CreateConsoleAdapter(ctx context.Context, databaseURL string) (DatabaseAdapter, error) {
	config := f.defaultConfig
	config.ServiceName = "console"
	config.DatabaseURL = databaseURL
	config.Mode = CloudSQLMode // Console服务默认使用CloudSQL模式

	return NewUniversalAdapter(config)
}

// CreateBillingAdapter 创建Billing服务适配器
func (f *AdapterFactory) CreateBillingAdapter(ctx context.Context, databaseURL string) (DatabaseAdapter, error) {
	config := f.defaultConfig
	config.ServiceName = "billing"
	config.DatabaseURL = databaseURL
	config.Mode = CloudSQLMode // Billing服务默认使用CloudSQL模式
	config.MaxConnections = 30 // Billing服务可能需要更多连接

	return NewUniversalAdapter(config)
}

// CreateRecommendationsAdapter 创建Recommendations服务适配器
func (f *AdapterFactory) CreateRecommendationsAdapter(primaryURL, readURL string) (DatabaseAdapter, error) {
	config := f.defaultConfig
	config.ServiceName = "recommendations"
	config.DatabaseURL = primaryURL
	config.ReadReplicaURL = readURL
	config.Mode = CloudSQLMode // Recommendations服务默认使用CloudSQL模式
	config.MaxConnections = 25 // Recommendations服务需要较多连接用于查询

	return NewUniversalAdapter(config)
}

// CreateAdscenterAdapter 创建Adscenter服务适配器
func (f *AdapterFactory) CreateAdscenterAdapter(databaseURL string) (DatabaseAdapter, error) {
	config := f.defaultConfig
	config.ServiceName = "adscenter"
	config.DatabaseURL = databaseURL
	config.Mode = CloudSQLMode // Adscenter服务默认使用CloudSQL模式

	return NewUniversalAdapter(config)
}

// CreateUserActivityAdapter 创建UserActivity服务适配器
func (f *AdapterFactory) CreateUserActivityAdapter(databaseURL string) (DatabaseAdapter, error) {
	config := f.defaultConfig
	config.ServiceName = "useractivity"
	config.DatabaseURL = databaseURL
	config.Mode = CloudSQLMode // UserActivity服务默认使用CloudSQL模式
	config.MaxConnections = 15 // UserActivity服务连接需求相对较少

	return NewUniversalAdapter(config)
}

// CreateUserServiceAdapter 创建UserService服务适配器
func (f *AdapterFactory) CreateUserServiceAdapter(databaseURL string) (DatabaseAdapter, error) {
	config := f.defaultConfig
	config.ServiceName = "user"
	config.DatabaseURL = databaseURL
	config.Mode = CloudSQLMode // UserService服务默认��用CloudSQL模式

	return NewUniversalAdapter(config)
}

// adjustConfigForService 根据服务类型调整配置
func (f *AdapterFactory) adjustConfigForService(config *Config, serviceName string) {
	switch serviceName {
	case "console":
		// Console服务主要是管理操作，连接需求较少
		config.MaxConnections = 10
	case "billing":
		// Billing服务处理计费相关操作，需要较多连接
		config.MaxConnections = 30
		config.Timeout = 45 * time.Second // 计费操作可能需要更长时间
	case "recommendations":
		// Recommendations服务查询密集，需要较多连接和只读副本
		config.MaxConnections = 25
		if config.ReadReplicaURL == "" {
			log.Printf("Warning: Recommendations service benefits from read replica, but DATABASE_READ_URL not set")
		}
	case "adscenter":
		// Adscenter服务中等连接需求
		config.MaxConnections = 20
	case "useractivity":
		// UserActivity服务写入较多，连接需求适中
		config.MaxConnections = 15
	case "user":
		// UserService服务主要是查询，连接需求适中
		config.MaxConnections = 15
	case "projector", "batchopen":
		// 批处理服务，连接需求较少但可能有长时间运行的查询
		config.MaxConnections = 10
		config.Timeout = 60 * time.Second
	default:
		// 未知服务，使用默认配置
		log.Printf("Warning: Unknown service '%s', using default configuration", serviceName)
	}
}

// ValidateConfiguration 验证配置是否正确
func (f *AdapterFactory) ValidateConfiguration(config Config) error {
	if config.ServiceName == "" {
		return fmt.Errorf("service name is required")
	}

	if config.DatabaseURL == "" {
		return fmt.Errorf("database URL is required")
	}

	if config.Mode == SupabaseMode && (config.SupabaseURL == "" || config.SupabaseKey == "") {
		return fmt.Errorf("Supabase URL and key are required when mode is SupabaseMode")
	}

	if config.Timeout <= 0 {
		return fmt.Errorf("timeout must be positive")
	}

	if config.MaxConnections <= 0 {
		return fmt.Errorf("max connections must be positive")
	}

	return nil
}

// 全局工厂实例
var defaultFactory = NewAdapterFactory()

// 便捷函数，使用默认工厂

// 注意：GetAdapterForService 函数已在 adapter.go 中定义，此处不再重复声明

// CreateConsoleAdapter 创建Console适配器（便捷函数）
func CreateConsoleAdapter(ctx context.Context, databaseURL string) (DatabaseAdapter, error) {
	return defaultFactory.CreateConsoleAdapter(ctx, databaseURL)
}

// CreateBillingAdapter 创建Billing适配器（便捷函数）
func CreateBillingAdapter(ctx context.Context, databaseURL string) (DatabaseAdapter, error) {
	return defaultFactory.CreateBillingAdapter(ctx, databaseURL)
}

// CreateRecommendationsAdapter 创建Recommendations适配器（便捷函数）
func CreateRecommendationsAdapter(primaryURL, readURL string) (DatabaseAdapter, error) {
	return defaultFactory.CreateRecommendationsAdapter(primaryURL, readURL)
}

// CreateAdscenterAdapter 创建Adscenter适配器（便捷函数）
func CreateAdscenterAdapter(databaseURL string) (DatabaseAdapter, error) {
	return defaultFactory.CreateAdscenterAdapter(databaseURL)
}

// CreateUserActivityAdapter 创建UserActivity适配器（便捷函数）
func CreateUserActivityAdapter(databaseURL string) (DatabaseAdapter, error) {
	return defaultFactory.CreateUserActivityAdapter(databaseURL)
}

// CreateUserServiceAdapter 创建UserService适配器（便捷函数）
func CreateUserServiceAdapter(databaseURL string) (DatabaseAdapter, error) {
	return defaultFactory.CreateUserServiceAdapter(databaseURL)
}
