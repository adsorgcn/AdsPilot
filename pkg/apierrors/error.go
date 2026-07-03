package apierrors

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// APIError 标准化API错误结构
// 符合 BACKEND_API_REQUIREMENTS.md 定义的错误格式
type APIError struct {
	// 业务错误码 (如 "OFFER_NOT_FOUND")
	Code string `json:"code"`
	// 错误消息 (人类可读)
	Message string `json:"message"`
	// 详细信息 (可选,用于调试)
	Details interface{} `json:"details,omitempty"`
	// 是否可重试
	Retryable bool `json:"retryable"`
	// 建议操作 (可选)
	SuggestedAction string `json:"suggestedAction,omitempty"`
	// HTTP状态码 (不序列化到JSON)
	HTTPStatus int `json:"-"`
}

// Error 实现 error 接口
func (e *APIError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// New 创建标准化API错误
//
// 示例:
//
//	err := apierrors.New(
//	    apierrors.CodeOfferNotFound,
//	    "Offer不存在",
//	    map[string]interface{}{"offerId": "123"},
//	)
func New(code, message string, details interface{}) *APIError {
	return &APIError{
		Code:       code,
		Message:    message,
		Details:    details,
		Retryable:  IsRetryable(code),
		HTTPStatus: GetHTTPStatus(code),
	}
}

// NewWithAction 创建带建议操作的API错误
func NewWithAction(code, message, suggestedAction string, details interface{}) *APIError {
	return &APIError{
		Code:            code,
		Message:         message,
		Details:         details,
		Retryable:       IsRetryable(code),
		SuggestedAction: suggestedAction,
		HTTPStatus:      GetHTTPStatus(code),
	}
}

// WriteJSON 将错误写入HTTP响应
//
// 响应格式:
//
//	{
//	  "error": {
//	    "code": "OFFER_NOT_FOUND",
//	    "message": "Offer不存在",
//	    "details": { "offerId": "123" },
//	    "retryable": false,
//	    "suggestedAction": "请检查Offer ID是否正确"
//	  }
//	}
func (e *APIError) WriteJSON(w http.ResponseWriter, r *http.Request) {
	// 提取trace ID
	traceID := r.Header.Get("x-request-id")
	if traceID == "" {
		traceID = r.Header.Get("X-Request-Id")
	}

	// 构造响应体
	response := map[string]interface{}{
		"error": map[string]interface{}{
			"code":      e.Code,
			"message":   e.Message,
			"retryable": e.Retryable,
		},
	}

	// 添加可选字段
	errorMap := response["error"].(map[string]interface{})
	if e.Details != nil {
		errorMap["details"] = e.Details
	}
	if e.SuggestedAction != "" {
		errorMap["suggestedAction"] = e.SuggestedAction
	}
	if traceID != "" {
		errorMap["traceId"] = traceID
	}

	// 写入响应
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(e.HTTPStatus)
	_ = json.NewEncoder(w).Encode(response)
}

// ============ 快捷构造函数 ============

// NotFound 资源未找到错误
func NotFound(resource, id string) *APIError {
	return New(
		CodeNotFound,
		fmt.Sprintf("%s不存在", resource),
		map[string]interface{}{
			"resource": resource,
			"id":       id,
		},
	)
}

// InvalidRequest 无效请求错误
func InvalidRequest(field, reason string) *APIError {
	return New(
		CodeInvalidRequest,
		"请求参数无效",
		map[string]interface{}{
			"field":  field,
			"reason": reason,
		},
	)
}

// InternalError 内部服务器错误
func InternalError(message string) *APIError {
	return New(
		CodeInternalError,
		message,
		nil,
	)
}

// Unauthorized 未授权错误
func Unauthorized(message string) *APIError {
	return New(
		CodeUnauthorized,
		message,
		nil,
	)
}

// Forbidden 权限不足错误
func Forbidden(resource, action string) *APIError {
	return New(
		CodeForbidden,
		"权限不足",
		map[string]interface{}{
			"resource": resource,
			"action":   action,
		},
	)
}

// RateLimited 请求限流错误
func RateLimited(retryAfter int) *APIError {
	return NewWithAction(
		CodeRateLimitExceeded,
		"请求过于频繁",
		fmt.Sprintf("请在%d秒后重试", retryAfter),
		map[string]interface{}{
			"retryAfter": retryAfter,
		},
	)
}

// TokenInsufficient Token余额不足错误
func TokenInsufficient(required, available int) *APIError {
	return NewWithAction(
		CodeTokenInsufficient,
		"Token余额不足",
		"请充值或升级订阅",
		map[string]interface{}{
			"required":  required,
			"available": available,
		},
	)
}
