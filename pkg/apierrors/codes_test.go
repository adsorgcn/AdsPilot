package apierrors

import (
	"net/http"
	"testing"
)

func TestGetHTTPStatus(t *testing.T) {
	tests := []struct {
		name     string
		code     string
		expected int
	}{
		{"NotFound", CodeNotFound, http.StatusNotFound},
		{"Unauthorized", CodeUnauthorized, http.StatusUnauthorized},
		{"Forbidden", CodeForbidden, http.StatusForbidden},
		{"InvalidRequest", CodeInvalidRequest, http.StatusBadRequest},
		{"InternalError", CodeInternalError, http.StatusInternalServerError},
		{"RateLimitExceeded", CodeRateLimitExceeded, http.StatusTooManyRequests},
		{"TokenInsufficient", CodeTokenInsufficient, http.StatusForbidden},
		{"OfferNotFound", CodeOfferNotFound, http.StatusNotFound},
		{"AdsOAuthExpired", CodeAdsOAuthExpired, http.StatusUnauthorized},
		{"TaskTimeout", CodeTaskTimeout, http.StatusRequestTimeout},
		{"UnknownCode", "UNKNOWN_CODE", http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status := GetHTTPStatus(tt.code)
			if status != tt.expected {
				t.Errorf("GetHTTPStatus(%q) = %d, want %d", tt.code, status, tt.expected)
			}
		})
	}
}

func TestIsRetryable(t *testing.T) {
	tests := []struct {
		name     string
		code     string
		expected bool
	}{
		// 可重试的错误
		{"Timeout", CodeTimeout, true},
		{"NetworkConnectionFailed", CodeNetworkConnectionFailed, true},
		{"RateLimitExceeded", CodeRateLimitExceeded, true},
		{"ServiceUnavailable", CodeServiceUnavailable, true},
		{"DatabaseConnectionFailed", CodeDatabaseConnectionFailed, true},
		{"AdsSyncFailed", CodeAdsSyncFailed, true},
		{"AdsRateLimited", CodeAdsRateLimited, true},
		{"TaskTimeout", CodeTaskTimeout, true},

		// 不可重试的错误
		{"NotFound", CodeNotFound, false},
		{"InvalidRequest", CodeInvalidRequest, false},
		{"Unauthorized", CodeUnauthorized, false},
		{"Forbidden", CodeForbidden, false},
		{"TokenInsufficient", CodeTokenInsufficient, false},
		{"OfferNotFound", CodeOfferNotFound, false},
		{"OfferInvalidURL", CodeOfferInvalidURL, false},
		{"UserNotFound", CodeUserNotFound, false},
		{"UnknownCode", "UNKNOWN_CODE", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			retryable := IsRetryable(tt.code)
			if retryable != tt.expected {
				t.Errorf("IsRetryable(%q) = %v, want %v", tt.code, retryable, tt.expected)
			}
		})
	}
}

func TestErrorCodeConsistency(t *testing.T) {
	// 测试所有定义的错误码都有HTTP状态码映射
	allCodes := []string{
		// 通用错误
		CodeInternalError, CodeInvalidRequest, CodeNotFound,
		CodeUnauthorized, CodeForbidden, CodeTimeout, CodeServiceUnavailable,

		// Token相关
		CodeTokenInsufficient, CodeTokenQuotaExceeded, CodeTokenTransactionFailed,

		// Offer相关
		CodeOfferNotFound, CodeOfferEvaluationFailed, CodeOfferInvalidURL,
		CodeOfferDuplicate, CodeOfferInvalidState,

		// Ads相关
		CodeAdsSyncFailed, CodeAdsOAuthExpired, CodeAdsAccountSuspended,
		CodeAdsAccountNotFound, CodeAdsRateLimited,

		// 任务相关
		CodeTaskNotFound, CodeTaskTimeout, CodeTaskCancelled,
		CodeTaskFailed, CodeTaskInvalidState,

		// 用户相关
		CodeUserNotFound, CodeUserAlreadyExists, CodeUserNotActivated,

		// 订阅相关
		CodeSubscriptionNotFound, CodeSubscriptionExpired, CodeSubscriptionCancelled,

		// 数据库错误
		CodeDatabaseQueryFailed, CodeDatabaseConnectionFailed, CodeDatabaseConstraintViolation,

		// 网络错误
		CodeNetworkTimeout, CodeNetworkConnectionFailed,

		// 限流错误
		CodeRateLimitExceeded,
	}

	for _, code := range allCodes {
		status := GetHTTPStatus(code)
		if status == 0 {
			t.Errorf("Error code %q has no HTTP status mapping", code)
		}
		if status < 400 || status >= 600 {
			t.Errorf("Error code %q has invalid HTTP status %d", code, status)
		}
	}
}

func TestHTTPStatusRanges(t *testing.T) {
	// 测试HTTP状态码分类正确性
	tests := []struct {
		code          string
		expectedRange string
		minStatus     int
		maxStatus     int
	}{
		{CodeInvalidRequest, "4xx Client Error", 400, 499},
		{CodeUnauthorized, "4xx Client Error", 400, 499},
		{CodeForbidden, "4xx Client Error", 400, 499},
		{CodeNotFound, "4xx Client Error", 400, 499},
		{CodeTimeout, "4xx Client Error", 400, 499},
		{CodeRateLimitExceeded, "4xx Client Error", 400, 499},
		{CodeInternalError, "5xx Server Error", 500, 599},
		{CodeServiceUnavailable, "5xx Server Error", 500, 599},
		{CodeDatabaseConnectionFailed, "5xx Server Error", 500, 599},
	}

	for _, tt := range tests {
		t.Run(tt.code, func(t *testing.T) {
			status := GetHTTPStatus(tt.code)
			if status < tt.minStatus || status > tt.maxStatus {
				t.Errorf("Error code %q has status %d, expected range [%d-%d] for %s",
					tt.code, status, tt.minStatus, tt.maxStatus, tt.expectedRange)
			}
		})
	}
}
