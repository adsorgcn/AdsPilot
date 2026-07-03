package validation

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
	"github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth"
)

// ValidationResults 验证结果
type ValidationResults struct {
	IsValid    bool                      `json:"is_valid"`
	UserStatus *database.UserLayerStatus `json:"user_status"`
	Issues     []ValidationIssue         `json:"issues"`
	Duration   time.Duration             `json:"duration"`
	Critical   bool                      `json:"critical"`
}

// ValidationIssue 验证问题
type ValidationIssue struct {
	Layer    string `json:"layer"`    // "layer1", "layer2", "layer3"
	Table    string `json:"table"`    // 表名
	Field    string `json:"field"`    // 字段名
	Issue    string `json:"issue"`    // 问题描述
	Severity string `json:"severity"` // "critical", "warning", "info"
}

// DefaultValidationConfig 默认验证配置
func DefaultValidationConfig() database.ValidationConfig {
	return database.DefaultValidationConfig()
}

// NewThreeLayerUserValidator 创建三层用户数据架构验证中间件
func NewThreeLayerUserValidator(adapter database.DatabaseAdapter, config database.ValidationConfig) *database.ThreeLayerUserValidator {
	return database.NewThreeLayerUserValidator(adapter, config)
}

// Middleware 返回HTTP中间件函数
func (v *database.ThreeLayerUserValidator) Middleware(config database.ValidationConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 检查是否应该跳过验证
			if v.shouldSkipValidation(r, config) {
				next.ServeHTTP(w, r)
				return
			}

			// 执行三层验证
			ctx, cancel := context.WithTimeout(r.Context(), config.Timeout)
			defer cancel()

			results := v.validateThreeLayerArchitecture(ctx, r, config)

			// 记录验证结果
			v.logValidationResults(r, results)

			// 根据验证结果决定是否继续
			if !results.IsValid {
				if results.Critical || config.StrictMode {
					v.writeErrorResponse(w, results)
					return
				}
				// 非严格模式下，只记录警告但继续处理
				log.Printf("WARNING: Three-layer validation failed but request allowed in non-strict mode")
			}

			// 将验证结果注入到上下文
			ctx = context.WithValue(r.Context(), "three_layer_validation", results)
			r = r.WithContext(ctx)

			next.ServeHTTP(w, r)
		})
	}
}

// validateThreeLayerArchitecture 执行三层架构验证
func (v *database.ThreeLayerUserValidator) validateThreeLayerArchitecture(ctx context.Context, r *http.Request, config database.ValidationConfig) ValidationResults {
	startTime := time.Now()
	results := ValidationResults{}

	// 从JWT中提取用户信息
	verifier := supabaseauth.DefaultVerifier()
	claims, err := verifier.VerifyRequest(ctx, r)
	if err != nil {
		results.IsValid = false
		results.Critical = true
		results.Issues = append(results.Issues, ValidationIssue{
			Layer:    "jwt",
			Issue:    fmt.Sprintf("JWT verification failed: %v", err),
			Severity: "critical",
		})
		results.Duration = time.Since(startTime)
		return results
	}

	userID := claims.UserID
	email := claims.Email

	if userID == "" {
		results.IsValid = false
		results.Critical = true
		results.Issues = append(results.Issues, ValidationIssue{
			Layer:    "jwt",
			Issue:    "User ID not found in JWT claims",
			Severity: "critical",
		})
		results.Duration = time.Since(startTime)
		return results
	}

	// 检查三层用户数据状态
	userStatus := v.checkUserLayerStatus(ctx, userID, email)
	results.UserStatus = userStatus

	// 验证数据一致性
	issues := v.validateDataConsistency(ctx, userID, userStatus)
	results.Issues = issues

	// 确定验证结果
	results.IsValid = len(issues) == 0 || (!config.StrictMode && !results.Critical)
	results.Critical = containsCriticalIssue(issues)
	results.Duration = time.Since(startTime)

	return results
}

// checkUserLayerStatus 检查用户在三层架构中的状态
func (v *database.ThreeLayerUserValidator) checkUserLayerStatus(ctx context.Context, userID, email string) *database.UserLayerStatus {
	status := &database.UserLayerStatus{
		UserID:    userID,
		Timestamp: time.Now().Unix(),
	}

	// Layer 1: Supabase auth.users (通过JWT验证即可确认存在)
	status.Layer1OK = true

	// Layer 2: Cloud SQL user.users
	layer2Exists, layer2Email := v.checkUserLayer2(ctx, userID)
	status.Layer2OK = layer2Exists

	// Layer 3: Cloud SQL billing.accounts
	layer3Exists := v.checkUserLayer3(ctx, userID)
	status.Layer3OK = layer3Exists

	// 检查邮箱一致性
	if layer2Email != "" && email != "" {
		status.EmailMatch = layer2Email == email
	}

	// 确定整体状态
	status.Status = v.determineUserStatus(status)
	status.Details = v.generateStatusDetails(status)

	return status
}

// checkUserLayer2 检查Layer 2: user.users
func (v *database.ThreeLayerUserValidator) checkUserLayer2(ctx context.Context, userID string) (bool, string) {
	// This would need access to the database adapter
	// For now, return a placeholder implementation
	return false, ""
}

// checkUserLayer3 检查Layer 3: billing.accounts
func (v *database.ThreeLayerUserValidator) checkUserLayer3(ctx context.Context, userID string) bool {
	// This would need access to the database adapter
	// For now, return a placeholder implementation
	return false
}

// determineUserStatus 确定用户状态
func (v *database.ThreeLayerUserValidator) determineUserStatus(status *database.UserLayerStatus) string {
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
func (v *database.ThreeLayerUserValidator) generateStatusDetails(status *database.UserLayerStatus) string {
	var details string

	switch status.Status {
	case "complete":
		details = "All three layers consistent and complete"
	case "email_inconsistent":
		details = "Layer data exists but email addresses are inconsistent"
	case "billing_missing":
		details = "User record exists but billing account is missing"
	case "business_missing":
		details = "User business records (Layer 2 & 3) are missing"
	case "partial":
		details = "Partial user data across layers"
	default:
		details = "Unknown user status"
	}

	return details
}

// validateDataConsistency 验证数据一致性
func (v *database.ThreeLayerUserValidator) validateDataConsistency(ctx context.Context, userID string, userStatus *database.UserLayerStatus) []ValidationIssue {
	var issues []ValidationIssue

	// 检查Layer 2和Layer 3的依赖关系
	if userStatus.Layer2OK && userStatus.Layer3OK {
		issues = append(issues, v.validateBillingIntegrity(ctx, userID)...)
	}

	// 检查邮箱一致性
	if userStatus.Layer2OK && !userStatus.EmailMatch {
		issues = append(issues, ValidationIssue{
			Layer:    "layer2",
			Table:    "user.users",
			Field:    "email",
			Issue:    "Email address inconsistent between JWT and user.users",
			Severity: "warning",
		})
	}

	// 检查缺失的层级
	if !userStatus.Layer2OK {
		issues = append(issues, ValidationIssue{
			Layer:    "layer2",
			Table:    "user.users",
			Issue:    "User record missing in business layer",
			Severity: "critical",
		})
	}

	if !userStatus.Layer3OK {
		issues = append(issues, ValidationIssue{
			Layer:    "layer3",
			Table:    "billing.accounts",
			Issue:    "Billing account missing for user",
			Severity: "critical",
		})
	}

	return issues
}

// validateBillingIntegrity 验证计费层完整性
func (v *database.ThreeLayerUserValidator) validateBillingIntegrity(ctx context.Context, userID string) []ValidationIssue {
	// Placeholder implementation
	return []ValidationIssue{}
}

// shouldSkipValidation 判断是否应该跳过验证
func (v *database.ThreeLayerUserValidator) shouldSkipValidation(r *http.Request, config database.ValidationConfig) bool {
	// 检查全局跳过开关

	// 检查允许跳过的路径
	path := r.URL.Path
	for _, allowedPath := range config.AllowedPaths {
		if path == allowedPath {
			return true
		}
	}

	// OPTIONS请求跳过验证
	if r.Method == "OPTIONS" {
		return true
	}

	return false
}

// logValidationResults 记录验证结果
func (v *database.ThreeLayerUserValidator) logValidationResults(r *http.Request, results ValidationResults) {
	logLevel := "INFO"
	if results.Critical {
		logLevel = "ERROR"
	} else if len(results.Issues) > 0 {
		logLevel = "WARN"
	}

	switch logLevel {
	case "ERROR":
		log.Printf("ERROR: Three-layer validation failed for %s %s: %+v",
			r.Method, r.URL.Path, results)
	case "WARN":
		log.Printf("WARN: Three-layer validation warnings for %s %s: %+v",
			r.Method, r.URL.Path, results.Issues)
	default:
		if results.UserStatus != nil {
			log.Printf("INFO: Three-layer validation passed for user %s (status: %s)",
				results.UserStatus.UserID, results.UserStatus.Status)
		}
	}
}

// writeErrorResponse 写入错误响应
func (v *database.ThreeLayerUserValidator) writeErrorResponse(w http.ResponseWriter, results ValidationResults) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)

	response := map[string]interface{}{
		"error":  "Three-layer user data validation failed",
		"valid":  false,
		"issues": results.Issues,
	}

	if results.UserStatus != nil {
		response["user_status"] = results.UserStatus
	}

	fmt.Fprintf(w, `{"error":"Three-layer user data validation failed","valid":false,"issues":%+v,"user_status":%+v}`,
		results.Issues, results.UserStatus)
}

// containsCriticalIssue 检查是否包含严重问题
func containsCriticalIssue(issues []ValidationIssue) bool {
	for _, issue := range issues {
		if issue.Severity == "critical" {
			return true
		}
	}
	return false
}

// GetUserStatusFromContext 从上下文获取用户状态
func GetUserStatusFromContext(ctx context.Context) (*database.UserLayerStatus, bool) {
	if val := ctx.Value("three_layer_validation"); val != nil {
		if results, ok := val.(ValidationResults); ok {
			return results.UserStatus, true
		}
	}
	return nil, false
}

// IsUserComplete 检查用户是否完整（所有三层都存在）
func IsUserComplete(userStatus *database.UserLayerStatus) bool {
	return userStatus != nil &&
		userStatus.Layer1OK &&
		userStatus.Layer2OK &&
		userStatus.Layer3OK &&
		userStatus.EmailMatch
}

// RequiresUserInitialization 检查是否需要用户初始化
func RequiresUserInitialization(userStatus *database.UserLayerStatus) bool {
	return userStatus != nil &&
		(!userStatus.Layer2OK || !userStatus.Layer3OK)
}

// GetValidationSummary 获取验证摘要
func GetValidationSummary(results ValidationResults) map[string]interface{} {
	return map[string]interface{}{
		"is_valid":    results.IsValid,
		"is_critical": results.Critical,
		"issue_count": len(results.Issues),
		"duration_ms": results.Duration.Milliseconds(),
		"user_status": results.UserStatus,
		"issues":      results.Issues,
	}
}
