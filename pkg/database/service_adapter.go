package database

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"time"
)

// AdapterConfig 适配器配置
type AdapterConfig struct {
	SupabaseURL        string
	SupabaseServiceKey string
	CloudSQLURL        string
	ConnectionMode     string
	QueryTimeout       time.Duration
	ConnectTimeout     time.Duration
	MaxRetries         int
	RetryDelay         time.Duration
}

// UnifiedDatabaseAdapter 统一数据库适配器
type UnifiedDatabaseAdapter struct {
	// Implementation details would go here
}

// DatabaseType 数据库类型
type DatabaseType int

const (
	DatabaseTypeSupabase DatabaseType = iota
	DatabaseTypeCloudSQL
)

// PoolConfig 连接池配置
type PoolConfig struct {
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
}

// ServiceAdapterConfig 服务适配器配置
type ServiceAdapterConfig struct {
	ServiceName string

	// 数据库连接配置
	SupabaseURL string
	SupabaseKey string
	CloudSQLURL string

	// 连接模式 (从环境变量读取)
	ConnectionMode string
}

// LoadFromEnvironment 从环境变量加载配置
func LoadFromEnvironment(serviceName string) (*ServiceAdapterConfig, error) {
	config := &ServiceAdapterConfig{
		ServiceName: serviceName,
	}

	// Supabase配置
	config.SupabaseURL = os.Getenv("NEXT_PUBLIC_SUPABASE_URL")
	config.SupabaseKey = os.Getenv("SUPABASE_SERVICE_KEY")

	// Cloud SQL配置
	config.CloudSQLURL = os.Getenv("DATABASE_URL")

	// 连接模式配置
	config.ConnectionMode = os.Getenv("DB_CONNECTION_MODE")
	if config.ConnectionMode == "" {
		config.ConnectionMode = "dbadmin" // 默认使用dbadmin模式
	}

	return config, nil
}

// NewServiceAdapter 为特定服务创建数据库适配器
func NewServiceAdapter(serviceName string) (*UnifiedDatabaseAdapter, error) {
	// 从环境变量加载配置
	config, err := LoadFromEnvironment(serviceName)
	if err != nil {
		return nil, fmt.Errorf("failed to load config for service %s: %w", serviceName, err)
	}

	// 根据服务类型确定数据库访问策略
	adapterConfig := buildAdapterConfig(serviceName, config)

	// 创建适配器
	adapter, err := NewUnifiedDatabaseAdapter(adapterConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create adapter for service %s: %w", serviceName, err)
	}

	return adapter, nil
}

// buildAdapterConfig 根据服务类型构建适配器配置
func buildAdapterConfig(serviceName string, config *ServiceAdapterConfig) AdapterConfig {
	// 基础配置
	adapterConfig := AdapterConfig{
		SupabaseURL:        config.SupabaseURL,
		SupabaseServiceKey: config.SupabaseKey,
		CloudSQLURL:        config.CloudSQLURL,
		ConnectionMode:     config.ConnectionMode,
		QueryTimeout:       30 * time.Second,
		ConnectTimeout:     10 * time.Second,
		MaxRetries:         3,
		RetryDelay:         1 * time.Second,
	}

	// 根据服务类型调整配置
	switch serviceName {
	case "user-service", "useractivity-service", "recommendations-service", "console":
		// 主要使用Supabase的服务
		if config.SupabaseURL == "" {
			log.Printf("⚠️  Service %s requires Supabase connection but NEXT_PUBLIC_SUPABASE_URL is empty", serviceName)
		}

	case "offer-service", "adscenter-service", "siterank-service", "billing-service":
		// 主要使用Cloud SQL的服务
		if config.CloudSQLURL == "" {
			log.Printf("⚠️  Service %s requires Cloud SQL connection but DATABASE_URL is empty", serviceName)
		}

	default:
		log.Printf("ℹ️  Unknown service type: %s, using default configuration", serviceName)
	}

	return adapterConfig
}

// GetDatabaseForService 根据服务获取推荐的数据库类型
func GetDatabaseForService(serviceName string) DatabaseType {
	// Supabase服务 (用户相关、实时功能)
	supabaseServices := map[string]bool{
		"user-service":            true,
		"useractivity-service":    true,
		"recommendations-service": true,
		"console":                 true,
		"frontend":                true,
	}

	// Cloud SQL服务 (业务逻辑、重量级操作)
	cloudSQLServices := map[string]bool{
		"offer-service":     true,
		"adscenter-service": true,
		"siterank-service":  true,
		"billing-service":   true,
		"projector":         true,
		"batchopen":         true,
	}

	if supabaseServices[serviceName] {
		return DatabaseTypeSupabase
	}

	if cloudSQLServices[serviceName] {
		return DatabaseTypeCloudSQL
	}

	// 默认使用Cloud SQL
	return DatabaseTypeCloudSQL
}

// ServiceType 服务类型
type ServiceType int

const (
	ServiceTypeUser           ServiceType = iota // 用户域服务
	ServiceTypeOffer                             // Offer域服务
	ServiceTypeAds                               // 广告域服务
	ServiceTypeBilling                           // 计费域服务
	ServiceTypeEvaluation                        // 评估域服务
	ServiceTypeActivity                          // 活动域服务
	ServiceTypeRecommendation                    // 推荐域服务
	ServiceTypeConsole                           // 管理服务
	ServiceTypeUnknown                           // 未知类型
)

// GetServiceType 获取服务类型
func GetServiceType(serviceName string) ServiceType {
	serviceTypes := map[string]ServiceType{
		"user-service":            ServiceTypeUser,
		"useractivity-service":    ServiceTypeActivity,
		"recommendations-service": ServiceTypeRecommendation,
		"console":                 ServiceTypeConsole,

		"offer-service":     ServiceTypeOffer,
		"adscenter-service": ServiceTypeAds,
		"siterank-service":  ServiceTypeEvaluation,

		"billing-service": ServiceTypeBilling,
	}

	if serviceType, exists := serviceTypes[serviceName]; exists {
		return serviceType
	}

	return ServiceTypeUnknown
}

// GetTablesForService 获取服务相关的表
func GetTablesForService(serviceName string) []string {
	serviceType := GetServiceType(serviceName)

	switch serviceType {
	case ServiceTypeUser:
		return []string{
			"user_profiles", "user_subscriptions", "user_wallets",
			"user_activity_stats",
		}

	case ServiceTypeActivity:
		return []string{
			"user_notifications", "user_checkins", "user_events",
		}

	case ServiceTypeRecommendation:
		return []string{
			"user_recommendations", "recommendation_feedback",
		}

	case ServiceTypeOffer:
		return []string{
			"offers", "offer_status_history", "offer_preferences",
		}

	case ServiceTypeAds:
		return []string{
			"ad_accounts", "campaigns", "bulk_operations", "audit_events",
		}

	case ServiceTypeEvaluation:
		return []string{
			"site_evaluations", "evaluation_queue", "token_reservations",
		}

	case ServiceTypeBilling:
		return []string{
			// billing域的表如果有的话
		}

	case ServiceTypeConsole:
		// 管理服务可以访问所有表
		return []string{
			"user_profiles", "user_subscriptions", "user_wallets",
			"user_activity_stats", "user_notifications", "user_checkins", "user_events",
			"user_recommendations", "recommendation_feedback",
			"offers", "offer_status_history", "offer_preferences",
			"ad_accounts", "campaigns", "bulk_operations", "audit_events",
			"site_evaluations", "evaluation_queue", "token_reservations",
		}

	default:
		return []string{}
	}
}

// ValidateServiceConfig 验证服务配置
func ValidateServiceConfig(serviceName string, config *ServiceAdapterConfig) error {
	serviceType := GetServiceType(serviceName)

	switch serviceType {
	case ServiceTypeUser, ServiceTypeActivity, ServiceTypeRecommendation, ServiceTypeConsole:
		if config.SupabaseURL == "" {
			return fmt.Errorf("service %s requires NEXT_PUBLIC_SUPABASE_URL", serviceName)
		}
		if config.SupabaseKey == "" {
			return fmt.Errorf("service %s requires SUPABASE_SERVICE_KEY", serviceName)
		}

	case ServiceTypeOffer, ServiceTypeAds, ServiceTypeEvaluation, ServiceTypeBilling:
		if config.CloudSQLURL == "" {
			return fmt.Errorf("service %s requires DATABASE_URL", serviceName)
		}

	case ServiceTypeUnknown:
		log.Printf("⚠️  Unknown service type: %s, skipping validation", serviceName)
	}

	return nil
}

// GetConnectionPoolSettings 获取连接池设置
func GetConnectionPoolSettings(serviceName string) (PoolConfig, error) {
	// 从环境变量读取自定义连接池设置
	maxOpenConnsStr := os.Getenv("DB_MAX_OPEN_CONNS")
	maxIdleConnsStr := os.Getenv("DB_MAX_IDLE_CONNS")
	connLifetimeStr := os.Getenv("DB_CONN_MAX_LIFETIME")
	connIdleTimeStr := os.Getenv("DB_CONN_MAX_IDLE_TIME")

	config := PoolConfig{
		MaxOpenConns:    8, // 默认值
		MaxIdleConns:    3, // 默认值
		ConnMaxLifetime: 30 * time.Minute,
		ConnMaxIdleTime: 5 * time.Minute,
	}

	// 解析自定义设置
	if maxOpenConnsStr != "" {
		if val, err := strconv.Atoi(maxOpenConnsStr); err == nil && val > 0 {
			config.MaxOpenConns = val
		}
	}

	if maxIdleConnsStr != "" {
		if val, err := strconv.Atoi(maxIdleConnsStr); err == nil && val > 0 {
			config.MaxIdleConns = val
		}
	}

	if connLifetimeStr != "" {
		if val, err := time.ParseDuration(connLifetimeStr); err == nil {
			config.ConnMaxLifetime = val
		}
	}

	if connIdleTimeStr != "" {
		if val, err := time.ParseDuration(connIdleTimeStr); err == nil {
			config.ConnMaxIdleTime = val
		}
	}

	// 根据服务类型调整连接池大小
	serviceType := GetServiceType(serviceName)
	switch serviceType {
	case ServiceTypeUser, ServiceTypeActivity, ServiceTypeRecommendation:
		// 用户服务，连接需求较小
		if config.MaxOpenConns > 10 {
			config.MaxOpenConns = 10
		}
		if config.MaxIdleConns > 5 {
			config.MaxIdleConns = 5
		}

	case ServiceTypeOffer, ServiceTypeAds, ServiceTypeEvaluation:
		// 业务服务，连接需求中等
		if config.MaxOpenConns > 20 {
			config.MaxOpenConns = 20
		}
		if config.MaxIdleConns > 10 {
			config.MaxIdleConns = 10
		}

	case ServiceTypeConsole:
		// 管理服务，连接需求较大但使用频率低
		if config.MaxOpenConns > 15 {
			config.MaxOpenConns = 15
		}
		if config.MaxIdleConns > 8 {
			config.MaxIdleConns = 8
		}
	}

	return config, nil
}

// NewUnifiedDatabaseAdapter 创建统一数据库适配器
func NewUnifiedDatabaseAdapter(config AdapterConfig) (*UnifiedDatabaseAdapter, error) {
	adapter := &UnifiedDatabaseAdapter{}
	// TODO: 实现具体的适配器初始化逻辑
	return adapter, nil
}
