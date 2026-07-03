package validation

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
	"github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth"
)

// ThreeLayerIntegration 三层验证集成工具
// 提供与现有服务架构的集成功能
type ThreeLayerIntegration struct {
	adapter    database.DatabaseAdapter
	verifier   *supabaseauth.Verifier
	validation *database.ThreeLayerUserValidator
}

// IntegrationConfig 集成配置
type IntegrationConfig struct {
	ServiceName      string
	ValidationConfig database.ValidationConfig
	AutoHealMissing  bool // 自动修复缺失的数据
	HealTimeout      time.Duration
	EnableMetrics    bool // 启用性能指标收集
}

// NewThreeLayerIntegration 创建三层验证集成
func NewThreeLayerIntegration(serviceName string, config IntegrationConfig) (*ThreeLayerIntegration, error) {
	// 创建数据库适配器
	adapter, err := database.GetFinalAdapterForService(serviceName)
	if err != nil {
		return nil, fmt.Errorf("failed to create database adapter: %w", err)
	}

	// 创建验证器
	validator := database.NewThreeLayerUserValidator(adapter, config.ValidationConfig)

	return &ThreeLayerIntegration{
		adapter:    adapter,
		verifier:   supabaseauth.DefaultVerifier(),
		validation: validator,
	}, nil
}

// EnsureUserComplete 确保用户三层数据完整
// 如果数据不完整，尝试自动修复
func (t *ThreeLayerIntegration) EnsureUserComplete(ctx context.Context, userID, email, name, avatarURL string) error {
	// 检查用户当前状态
	userStatus := t.checkUserStatus(ctx, userID)

	// 根据状态执行相应的修复操作
	switch userStatus.Status {
	case "complete":
		return nil // 用户已完整，无需操作

	case "business_missing":
		return t.createBusinessUserData(ctx, userID, email, name, avatarURL)

	case "billing_missing":
		return t.createBillingAccount(ctx, userID)

	case "email_inconsistent":
		return t.updateEmailConsistency(ctx, userID, email)

	default:
		return fmt.Errorf("unknown user status: %s", userStatus.Status)
	}
}

// checkUserStatus 检查用户状态（简化版本，避免重复验证）
func (t *ThreeLayerIntegration) checkUserStatus(ctx context.Context, userID string) *database.UserLayerStatus {
	status := &database.UserLayerStatus{
		UserID:    userID,
		Timestamp: time.Now().Unix(),
	}

	// Layer 1: 通过JWT验证即可确认
	status.Layer1OK = true

	// Layer 2: 检查user.users
	layer2Exists, layer2Email := t.checkUserLayer2(ctx, userID)
	status.Layer2OK = layer2Exists

	// Layer 3: 检查billing.accounts
	layer3Exists := t.checkUserLayer3(ctx, userID)
	status.Layer3OK = layer3Exists

	// 邮箱一致性
	status.EmailMatch = layer2Email == email

	// 确定状态
	status.Status = t.determineUserStatus(status)
	status.Details = t.generateStatusDetails(status)

	return status
}

// createBusinessUserData 创建业务用户数据（Layer 2）
func (t *ThreeLayerIntegration) createBusinessUserData(ctx context.Context, userID, email, name, avatarURL string) error {
	pool := t.adapter.GetCloudSQLPool()
	if pool == nil {
		return fmt.Errorf("database pool not available")
	}

	// 使用事务确保原子性
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 创建user.users记录
	_, err = tx.Exec(ctx, `
		INSERT INTO user.users (id, email, name, avatar_url, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
		ON CONFLICT (id) DO UPDATE SET
			email = EXCLUDED.email,
			name = EXCLUDED.name,
			avatar_url = EXCLUDED.avatar_url,
			updated_at = NOW()
	`, userID, email, name, avatarURL)

	if err != nil {
		return fmt.Errorf("failed to create user record: %w", err)
	}

	// 创建billing.accounts记录
	_, err = tx.Exec(ctx, `
		INSERT INTO billing.accounts (user_id, account_type, status, balance_cents, created_at, updated_at)
		VALUES ($1, 'standard', 'trial', 0, NOW(), NOW())
		ON CONFLICT (user_id) DO NOTHING
	`, userID)

	if err != nil {
		return fmt.Errorf("failed to create billing account: %w", err)
	}

	// 创建代币余额记录
	_, err = tx.Exec(ctx, `
		INSERT INTO billing.token_balances (user_id, token_type, balance, created_at, updated_at)
		VALUES ($1, 'search', 100, NOW(), NOW())
		ON CONFLICT (user_id, token_type) DO NOTHING
	`, userID)

	if err != nil {
		return fmt.Errorf("failed to create token balance: %w", err)
	}

	// 提交事务
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// createBillingAccount 创建计费账户（Layer 3）
func (t *ThreeLayerIntegration) createBillingAccount(ctx context.Context, userID string) error {
	pool := t.adapter.GetCloudSQLPool()
	if pool == nil {
		return fmt.Errorf("database pool not available")
	}

	// 创建billing.accounts记录
	_, err := pool.Exec(ctx, `
		INSERT INTO billing.accounts (user_id, account_type, status, balance_cents, created_at, updated_at)
		VALUES ($1, 'standard', 'trial', 0, NOW(), NOW())
		ON CONFLICT (user_id) DO NOTHING
	`, userID)

	if err != nil {
		return fmt.Errorf("failed to create billing account: %w", err)
	}

	// 创建代币余额记录
	_, err = pool.Exec(ctx, `
		INSERT INTO billing.token_balances (user_id, token_type, balance, created_at, updated_at)
		VALUES ($1, 'search', 100, NOW(), NOW())
		ON CONFLICT (user_id, token_type) DO NOTHING
	`, userID)

	if err != nil {
		return fmt.Errorf("failed to create token balance: %w", err)
	}

	return nil
}

// updateEmailConsistency 更新邮箱一致性
func (t *ThreeLayerIntegration) updateEmailConsistency(ctx context.Context, userID, correctEmail string) error {
	pool := t.adapter.GetCloudSQLPool()
	if pool == nil {
		return fmt.Errorf("database pool not available")
	}

	_, err := pool.Exec(ctx, `
		UPDATE user.users
		SET email = $1, updated_at = NOW()
		WHERE id = $2
	`, correctEmail, userID)

	if err != nil {
		return fmt.Errorf("failed to update email: %w", err)
	}

	return nil
}

// GetMiddlewareWithAutoHeal 获取带自动修复功能的中间件
func (t *ThreeLayerIntegration) GetMiddlewareWithAutoHeal(config IntegrationConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 基础验证中间件
			validationMiddleware := t.validation.Middleware(config.ValidationConfig)
			baseHandler := validationMiddleware(next)

			// 包装自动修复功能
			t.autoHealWrapper(baseHandler, config).ServeHTTP(w, r)
		})
	}
}

// autoHealWrapper 自动修复包装器
func (t *ThreeLayerIntegration) autoHealWrapper(next http.Handler, config IntegrationConfig) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// 检查是否需要自动修复
		if config.AutoHeal && t.shouldAttemptAutoHeal(r) {
			// 从JWT提取用户信息
			claims, err := t.verifier.VerifyRequest(ctx, r)
			if err == nil && claims.UserID != "" {
				// 尝试自动修复
				healCtx, cancel := context.WithTimeout(ctx, config.HealTimeout)
				defer cancel()

				err := t.EnsureUserComplete(healCtx, claims.UserID, claims.Email, "", "")
				if err != nil {
					// 记录修复失败但继续处理请求
					fmt.Printf("AUTO_HEAL_FAILED: %v\n", err)
				}
			}
		}

		// 继续处理请求
		next.ServeHTTP(w, r)
	})
}

// shouldAttemptAutoHeal 判断是否应该尝试自动修复
func (t *ThreeLayerIntegration) shouldAttemptAutoHeal(r *http.Request) bool {
	path := r.URL.Path
	method := r.Method

	// 只在特定路径和POST/PUT请求时尝试自动修复
	autoHealPaths := map[string]bool{
		"/api/v1/billing/subscriptions/trial": true,
		"/api/v1/user/profile":                true,
		"/api/v1/user/onboard":                true,
	}

	shouldHeal, exists := autoHealPaths[path]
	return exists && (method == "POST" || method == "PUT")
}

// GetMetrics 获取验证指标
func (t *ThreeLayerIntegration) GetMetrics() map[string]interface{} {
	// 这里可以收集和返回验证相关的指标
	return map[string]interface{}{
		"integration_type": "three_layer_validation",
		"service_name":     t.adapter.GetServiceName(),
		"timestamp":        time.Now().Unix(),
		"adapter_healthy":  t.adapter.IsHealthy(context.Background()),
	}
}

// Close 关闭集成器
func (t *ThreeLayerIntegration) Close() error {
	return t.adapter.Close()
}

// 辅助方法（避免重复代码）

// checkUserLayer2 检查Layer 2
func (t *ThreeLayerIntegration) checkUserLayer2(ctx context.Context, userID string) (bool, string) {
	pool := t.adapter.GetCloudSQLPool()
	if pool == nil {
		return false, ""
	}

	var email string
	err := pool.QueryRow(ctx, `SELECT email FROM user.users WHERE id = $1`, userID).Scan(&email)

	if err != nil {
		return false, ""
	}

	return true, email
}

// checkUserLayer3 检查Layer 3
func (t *ThreeLayerIntegration) checkUserLayer3(ctx context.Context, userID string) bool {
	pool := t.adapter.GetCloudSQLPool()
	if pool == nil {
		return false
	}

	var exists bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM billing.accounts WHERE user_id = $1)`,
		userID).Scan(&exists)

	if err != nil {
		return false
	}

	return exists
}

// determineUserStatus 确定用户状态
func (t *ThreeLayerIntegration) determineUserStatus(status *database.UserLayerStatus) string {
	if !status.Layer1OK {
		return "critical_auth_missing"
	}

	if status.Layer2OK && status.Layer3OK {
		if status.EmailMatch {
			return "complete"
		}
		return "email_inconsistent"
	}

	if status.Layer2OK && !status.Layer3OK {
		return "billing_missing"
	}

	if !status.Layer2OK && !status.Layer3OK {
		return "business_missing"
	}

	return "partial"
}

// generateStatusDetails 生成状态详情
func (t *ThreeLayerIntegration) generateStatusDetails(status *database.UserLayerStatus) string {
	switch status.Status {
	case "complete":
		return "All three layers consistent and complete"
	case "email_inconsistent":
		return "Layer data exists but email addresses are inconsistent"
	case "billing_missing":
		return "User record exists but billing account is missing"
	case "business_missing":
		return "User business records (Layer 2 & 3) are missing"
	case "partial":
		return "Partial user data across layers"
	default:
		return "Unknown user status"
	}
}
