package validation

import (
	"log"
	"net/http"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
)

// SetupThreeLayerValidation 为服务设置三层验证中间件
// 这是一个示例，展示如何在服务中集成三层验证
func SetupThreeLayerValidation(serviceName string, handler http.Handler) http.Handler {
	// 创建数据库适配器
	adapter, err := database.GetFinalAdapterForService(serviceName)
	if err != nil {
		log.Fatalf("Failed to create database adapter for %s: %v", serviceName, err)
	}

	// 配置验证参数
	config := DefaultValidationConfig()

	// 根据服务类型调整配置
	switch serviceName {
	case "billing-service":
		config.StrictMode = true // 计费服务需要严格验证
		config.CriticalPaths = append(config.CriticalPaths,
			"/api/v1/billing/subscriptions",
			"/api/v1/billing/tokens/consume",
			"/api/v1/billing/subscriptions/upgrade",
		)

	case "user-service":
		config.CriticalPaths = append(config.CriticalPaths,
			"/api/v1/user/profile",
			"/api/v1/user/preferences",
		)

	case "offer-service":
		config.CriticalPaths = append(config.CriticalPaths,
			"/api/v1/offer",
			"/api/v1/offer/create",
		)

	case "adscenter-service":
		config.CriticalPaths = append(config.CriticalPaths,
			"/api/v1/adscenter/connections",
			"/api/v1/adscenter/campaigns",
		)
	}

	// 创建验证中间件
	validator := NewThreeLayerUserValidator(adapter, config)

	// 应用中间件
	return validator.Middleware(config)(handler)
}

// SetupThreeLayerValidationWithConfig 使用自定义配置设置三层验证
func SetupThreeLayerValidationWithConfig(serviceName string, handler http.Handler, customConfig ValidationConfig) http.Handler {
	// 创建数据库适配器
	adapter, err := database.GetFinalAdapterForService(serviceName)
	if err != nil {
		log.Fatalf("Failed to create database adapter for %s: %v", serviceName, err)
	}

	// 合并默认配置和自定义配置
	config := DefaultValidationConfig()
	if customConfig.Enabled {
		config.Enabled = customConfig.Enabled
	}
	if customConfig.StrictMode {
		config.StrictMode = customConfig.StrictMode
	}
	if customConfig.Timeout > 0 {
		config.Timeout = customConfig.Timeout
	}
	if customConfig.RetryAttempts > 0 {
		config.RetryAttempts = customConfig.RetryAttempts
	}
	if customConfig.LogLevel != "" {
		config.LogLevel = customConfig.LogLevel
	}
	if len(customConfig.AllowedPaths) > 0 {
		config.AllowedPaths = append(config.AllowedPaths, customConfig.AllowedPaths...)
	}
	if len(customConfig.CriticalPaths) > 0 {
		config.CriticalPaths = append(config.CriticalPaths, customConfig.CriticalPaths...)
	}

	// 创建验证中间件
	validator := NewThreeLayerUserValidator(adapter, config)

	// 应用中间件
	return validator.Middleware(config)(handler)
}

// 示例使用方法

// ExampleBillingServiceSetup 计费服务设置示例
func ExampleBillingServiceSetup() http.Handler {
	// 创建你的主要HTTP处理器
	mainHandler := http.NewServeMux()

	// 注册路由...
	// mainHandler.HandleFunc("/api/v1/billing/subscriptions", subscriptionHandler)
	// mainHandler.HandleFunc("/api/v1/billing/tokens", tokenHandler)

	// 应用三层验证中间件
	return SetupThreeLayerValidation("billing-service", mainHandler)
}

// ExampleUserServiceSetup 用户服务设置示例
func ExampleUserServiceSetup() http.Handler {
	mainHandler := http.NewServeMux()

	// 注册路由...
	// mainHandler.HandleFunc("/api/v1/user/profile", profileHandler)
	// mainHandler.HandleFunc("/api/v1/user/preferences", preferencesHandler)

	// 使用自定义配置
	customConfig := ValidationConfig{
		Enabled:       true,
		StrictMode:    false, // 用户服务使用非严格模式
		Timeout:       3 * time.Second,
		RetryAttempts: 1,
		LogLevel:      "info",
		AllowedPaths: []string{
			"/api/v1/user/create", // 用户创建路径允许部分缺失
		},
	}

	return SetupThreeLayerValidationWithConfig("user-service", mainHandler, customConfig)
}

// ConditionalValidationHandler 条件验证处理器示例
func ConditionalValidationHandler() http.Handler {
	mainHandler := http.NewServeMux()

	// 为不同的路由应用不同的验证策略
	billingHandler := SetupThreeLayerValidation("billing-service",
		createBillingRoutes())

	userHandler := SetupThreeLayerValidationWithConfig("user-service",
		createUserRoutes(),
		ValidationConfig{
			Enabled:      true,
			StrictMode:   false,
			AllowedPaths: []string{"/api/v1/user/onboard"},
		})

	// 组合处理器
	combinedHandler := http.NewServeMux()
	combinedHandler.Handle("/api/v1/billing/", billingHandler)
	combinedHandler.Handle("/api/v1/user/", userHandler)

	return combinedHandler
}

// createBillingRoutes 创建计费路由
func createBillingRoutes() http.Handler {
	mux := http.NewServeMux()

	// 计费相关的路由
	mux.HandleFunc("/api/v1/billing/subscriptions", func(w http.ResponseWriter, r *http.Request) {
		// 在这里可以从context获取用户状态
		if userStatus, ok := GetUserStatusFromContext(r.Context()); ok {
			if !IsUserComplete(userStatus) {
				// 用户不完整，可能需要初始化
				http.Error(w, "User initialization required", http.StatusForbidden)
				return
			}
		}

		// 正常处理逻辑...
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("/api/v1/billing/tokens/consume", func(w http.ResponseWriter, r *http.Request) {
		// 检查用户是否已完整初始化
		if userStatus, ok := GetUserStatusFromContext(r.Context()); ok {
			if RequiresUserInitialization(userStatus) {
				http.Error(w, "User requires initialization", http.StatusForbidden)
				return
			}
		}

		// 消耗代币逻辑...
		w.WriteHeader(http.StatusOK)
	})

	return mux
}

// createUserRoutes 创建用户路由
func createUserRoutes() http.Handler {
	mux := http.NewServeMux()

	// 用户相关的路由
	mux.HandleFunc("/api/v1/user/profile", func(w http.ResponseWriter, r *http.Request) {
		// 获取用户状态
		if userStatus, ok := GetUserStatusFromContext(r.Context()); ok {
			// 根据用户状态提供不同的响应
			switch userStatus.Status {
			case "complete":
				// 返回完整用户信息
				w.WriteHeader(http.StatusOK)
			case "billing_missing":
				// 引导用户完成计费设置
				http.Error(w, "Billing setup required", http.StatusPaymentRequired)
			case "business_missing":
				// 引导用户完成业务数据初始化
				http.Error(w, "Business data initialization required", http.StatusForbidden)
			default:
				// 其他状态处理
				w.WriteHeader(http.StatusOK)
			}
			return
		}

		// 如果没有用户状态信息，执行正常逻辑
		w.WriteHeader(http.StatusOK)
	})

	mux.HandleFunc("/api/v1/user/status", func(w http.ResponseWriter, r *http.Request) {
		// 返回用户在三层数据架构中的状态
		if userStatus, ok := GetUserStatusFromContext(r.Context()); ok {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			// 这里可以返回详细的状态信息
			w.Write([]byte(`{"status":"` + userStatus.Status + `","complete":` +
				fmt.Sprintf("%t", IsUserComplete(userStatus)) + `}`))
			return
		}

		http.Error(w, "User status not available", http.StatusInternalServerError)
	})

	return mux
}
