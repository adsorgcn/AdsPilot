package apierrors

// 标准化错误码定义
// 遵循 BACKEND_API_REQUIREMENTS.md 规范

const (
	// ============ 通用错误码 ============
	// 内部服务器错误
	CodeInternalError = "INTERNAL_ERROR"
	// 请求参数无效
	CodeInvalidRequest = "INVALID_REQUEST"
	// 资源未找到
	CodeNotFound = "NOT_FOUND"
	// 未授权
	CodeUnauthorized = "UNAUTHORIZED"
	// 权限不足
	CodeForbidden = "FORBIDDEN"
	// 请求超时
	CodeTimeout = "TIMEOUT"
	// 服务不可用
	CodeServiceUnavailable = "SERVICE_UNAVAILABLE"

	// ============ Token相关错误码 ============
	// Token余额不足
	CodeTokenInsufficient = "TOKEN_INSUFFICIENT"
	// Token配额超限
	CodeTokenQuotaExceeded = "TOKEN_QUOTA_EXCEEDED"
	// Token交易失败
	CodeTokenTransactionFailed = "TOKEN_TRANSACTION_FAILED"

	// ============ Offer相关错误码 ============
	// Offer不存在
	CodeOfferNotFound = "OFFER_NOT_FOUND"
	// Offer评估失败
	CodeOfferEvaluationFailed = "OFFER_EVALUATION_FAILED"
	// Offer URL无效
	CodeOfferInvalidURL = "OFFER_INVALID_URL"
	// Offer已存在(重复创建)
	CodeOfferDuplicate = "OFFER_DUPLICATE"
	// Offer状态不允许此操作
	CodeOfferInvalidState = "OFFER_INVALID_STATE"

	// ============ Ads相关错误码 ============
	// 广告同步失败
	CodeAdsSyncFailed = "ADS_SYNC_FAILED"
	// OAuth令牌过期
	CodeAdsOAuthExpired = "ADS_OAUTH_EXPIRED"
	// 广告账号已暂停
	CodeAdsAccountSuspended = "ADS_ACCOUNT_SUSPENDED"
	// 广告账号不存在
	CodeAdsAccountNotFound = "ADS_ACCOUNT_NOT_FOUND"
	// 广告API限流
	CodeAdsRateLimited = "ADS_RATE_LIMITED"

	// ============ 任务相关错误码 ============
	// 任务不存在
	CodeTaskNotFound = "TASK_NOT_FOUND"
	// 任务超时
	CodeTaskTimeout = "TASK_TIMEOUT"
	// 任务已取消
	CodeTaskCancelled = "TASK_CANCELLED"
	// 任务失败
	CodeTaskFailed = "TASK_FAILED"
	// 任务状态不允许此操作
	CodeTaskInvalidState = "TASK_INVALID_STATE"

	// ============ 用户相关错误码 ============
	// 用户不存在
	CodeUserNotFound = "USER_NOT_FOUND"
	// 用户已存在
	CodeUserAlreadyExists = "USER_ALREADY_EXISTS"
	// 用户未激活
	CodeUserNotActivated = "USER_NOT_ACTIVATED"

	// ============ 订阅相关错误码 ============
	// 订阅不存在
	CodeSubscriptionNotFound = "SUBSCRIPTION_NOT_FOUND"
	// 订阅已过期
	CodeSubscriptionExpired = "SUBSCRIPTION_EXPIRED"
	// 订阅已取消
	CodeSubscriptionCancelled = "SUBSCRIPTION_CANCELLED"

	// ============ 数据库相关错误码 ============
	// 数据库连接失败
	CodeDatabaseConnectionFailed = "DATABASE_CONNECTION_FAILED"
	// 数据库查询失败
	CodeDatabaseQueryFailed = "DATABASE_QUERY_FAILED"
	// 数据库约束违反
	CodeDatabaseConstraintViolation = "DATABASE_CONSTRAINT_VIOLATION"

	// ============ 网络相关错误码 ============
	// 网络连接失败
	CodeNetworkConnectionFailed = "NETWORK_CONNECTION_FAILED"
	// 网络超时
	CodeNetworkTimeout = "NETWORK_TIMEOUT"
	// DNS解析失败
	CodeNetworkDNSFailed = "NETWORK_DNS_FAILED"

	// ============ 限流相关错误码 ============
	// 请求过于频繁
	CodeRateLimitExceeded = "RATE_LIMIT_EXCEEDED"
	// 并发限制超出
	CodeConcurrencyLimitExceeded = "CONCURRENCY_LIMIT_EXCEEDED"
)

// 错误码到HTTP状态码的映射
var codeToHTTPStatus = map[string]int{
	// 400 Bad Request
	CodeInvalidRequest:              400,
	CodeOfferInvalidURL:             400,
	CodeOfferInvalidState:           400,
	CodeTaskInvalidState:            400,
	CodeDatabaseConstraintViolation: 400,

	// 401 Unauthorized
	CodeUnauthorized:    401,
	CodeAdsOAuthExpired: 401,

	// 403 Forbidden
	CodeForbidden:           403,
	CodeTokenInsufficient:   403,
	CodeTokenQuotaExceeded:  403,
	CodeUserNotActivated:    403,
	CodeSubscriptionExpired: 403,

	// 404 Not Found
	CodeNotFound:             404,
	CodeOfferNotFound:        404,
	CodeAdsAccountNotFound:   404,
	CodeTaskNotFound:         404,
	CodeUserNotFound:         404,
	CodeSubscriptionNotFound: 404,

	// 408 Request Timeout
	CodeTimeout:        408,
	CodeTaskTimeout:    408,
	CodeNetworkTimeout: 408,

	// 409 Conflict
	CodeOfferDuplicate:    409,
	CodeUserAlreadyExists: 409,

	// 422 Unprocessable Entity
	CodeOfferEvaluationFailed:  422,
	CodeTaskFailed:             422,
	CodeTokenTransactionFailed: 422,

	// 429 Too Many Requests
	CodeRateLimitExceeded:        429,
	CodeConcurrencyLimitExceeded: 429,
	CodeAdsRateLimited:           429,

	// 500 Internal Server Error
	CodeInternalError:            500,
	CodeDatabaseConnectionFailed: 500,
	CodeDatabaseQueryFailed:      500,
	CodeNetworkConnectionFailed:  500,
	CodeNetworkDNSFailed:         500,

	// 503 Service Unavailable
	CodeServiceUnavailable:    503,
	CodeAdsSyncFailed:         503,
	CodeAdsAccountSuspended:   503,
	CodeTaskCancelled:         503,
	CodeSubscriptionCancelled: 503,
}

// GetHTTPStatus 根据错误码获取HTTP状态码
// 如果错误码未定义,返回500
func GetHTTPStatus(code string) int {
	if status, ok := codeToHTTPStatus[code]; ok {
		return status
	}
	return 500
}

// IsRetryable 判断错误是否可重试
func IsRetryable(code string) bool {
	retryableCodes := map[string]bool{
		CodeTimeout:                  true,
		CodeTaskTimeout:              true,
		CodeNetworkTimeout:           true,
		CodeNetworkConnectionFailed:  true,
		CodeServiceUnavailable:       true,
		CodeAdsSyncFailed:            true,
		CodeRateLimitExceeded:        true,
		CodeConcurrencyLimitExceeded: true,
		CodeAdsRateLimited:           true,
		CodeDatabaseConnectionFailed: true,
	}
	return retryableCodes[code]
}
