package apierrors

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNew(t *testing.T) {
	err := New(
		CodeOfferNotFound,
		"Offer不存在",
		map[string]interface{}{"offerId": "123"},
	)

	if err.Code != CodeOfferNotFound {
		t.Errorf("Expected code %q, got %q", CodeOfferNotFound, err.Code)
	}
	if err.Message != "Offer不存在" {
		t.Errorf("Expected message %q, got %q", "Offer不存在", err.Message)
	}
	if err.HTTPStatus != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, err.HTTPStatus)
	}
	if err.Retryable != false {
		t.Errorf("Expected retryable=false, got %v", err.Retryable)
	}
}

func TestNewWithAction(t *testing.T) {
	err := NewWithAction(
		CodeTokenInsufficient,
		"Token余额不足",
		"请充值或升级订阅",
		map[string]interface{}{"required": 100, "available": 50},
	)

	if err.SuggestedAction != "请充值或升级订阅" {
		t.Errorf("Expected suggestedAction %q, got %q", "请充值或升级订阅", err.SuggestedAction)
	}
	if err.Code != CodeTokenInsufficient {
		t.Errorf("Expected code %q, got %q", CodeTokenInsufficient, err.Code)
	}
}

func TestAPIError_Error(t *testing.T) {
	err := New(CodeTaskTimeout, "任务超时", nil)
	expected := "[TASK_TIMEOUT] 任务超时"
	if err.Error() != expected {
		t.Errorf("Expected error string %q, got %q", expected, err.Error())
	}
}

func TestAPIError_WriteJSON(t *testing.T) {
	tests := []struct {
		name           string
		err            *APIError
		traceID        string
		expectedStatus int
		checkFields    func(t *testing.T, data map[string]interface{})
	}{
		{
			name: "Basic error without details",
			err: New(
				CodeNotFound,
				"资源未找到",
				nil,
			),
			expectedStatus: http.StatusNotFound,
			checkFields: func(t *testing.T, data map[string]interface{}) {
				errorMap := data["error"].(map[string]interface{})
				if errorMap["code"] != CodeNotFound {
					t.Errorf("Expected code %q, got %v", CodeNotFound, errorMap["code"])
				}
				if errorMap["message"] != "资源未找到" {
					t.Errorf("Expected message %q, got %v", "资源未找到", errorMap["message"])
				}
				if errorMap["retryable"] != false {
					t.Errorf("Expected retryable=false, got %v", errorMap["retryable"])
				}
				if _, exists := errorMap["details"]; exists {
					t.Error("Expected no details field")
				}
			},
		},
		{
			name: "Error with details",
			err: New(
				CodeOfferInvalidURL,
				"URL格式无效",
				map[string]interface{}{"url": "invalid-url", "field": "url"},
			),
			expectedStatus: http.StatusBadRequest,
			checkFields: func(t *testing.T, data map[string]interface{}) {
				errorMap := data["error"].(map[string]interface{})
				details := errorMap["details"].(map[string]interface{})
				if details["url"] != "invalid-url" {
					t.Errorf("Expected url %q, got %v", "invalid-url", details["url"])
				}
				if details["field"] != "url" {
					t.Errorf("Expected field %q, got %v", "url", details["field"])
				}
			},
		},
		{
			name: "Error with suggested action",
			err: NewWithAction(
				CodeRateLimitExceeded,
				"请求过于频繁",
				"请在60秒后重试",
				map[string]interface{}{"retryAfter": 60},
			),
			expectedStatus: http.StatusTooManyRequests,
			checkFields: func(t *testing.T, data map[string]interface{}) {
				errorMap := data["error"].(map[string]interface{})
				if errorMap["suggestedAction"] != "请在60秒后重试" {
					t.Errorf("Expected suggestedAction %q, got %v", "请在60秒后重试", errorMap["suggestedAction"])
				}
				if errorMap["retryable"] != true {
					t.Errorf("Expected retryable=true, got %v", errorMap["retryable"])
				}
			},
		},
		{
			name: "Error with trace ID",
			err: New(
				CodeInternalError,
				"内部服务器错误",
				nil,
			),
			traceID:        "req-123-456",
			expectedStatus: http.StatusInternalServerError,
			checkFields: func(t *testing.T, data map[string]interface{}) {
				errorMap := data["error"].(map[string]interface{})
				if errorMap["traceId"] != "req-123-456" {
					t.Errorf("Expected traceId %q, got %v", "req-123-456", errorMap["traceId"])
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 创建测试请求和响应记录器
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.traceID != "" {
				req.Header.Set("x-request-id", tt.traceID)
			}
			w := httptest.NewRecorder()

			// 写入JSON响应
			tt.err.WriteJSON(w, req)

			// 验证HTTP状态码
			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// 验证Content-Type
			contentType := w.Header().Get("Content-Type")
			if contentType != "application/json; charset=utf-8" {
				t.Errorf("Expected Content-Type %q, got %q", "application/json; charset=utf-8", contentType)
			}

			// 解析JSON响应
			var data map[string]interface{}
			if err := json.Unmarshal(w.Body.Bytes(), &data); err != nil {
				t.Fatalf("Failed to parse JSON response: %v", err)
			}

			// 验证响应结构
			if _, exists := data["error"]; !exists {
				t.Fatal("Response missing 'error' field")
			}

			// 运行自定义字段检查
			tt.checkFields(t, data)
		})
	}
}

func TestNotFound(t *testing.T) {
	err := NotFound("Offer", "abc123")

	if err.Code != CodeNotFound {
		t.Errorf("Expected code %q, got %q", CodeNotFound, err.Code)
	}
	if err.Message != "Offer不存在" {
		t.Errorf("Expected message %q, got %q", "Offer不存在", err.Message)
	}

	details := err.Details.(map[string]interface{})
	if details["resource"] != "Offer" {
		t.Errorf("Expected resource %q, got %v", "Offer", details["resource"])
	}
	if details["id"] != "abc123" {
		t.Errorf("Expected id %q, got %v", "abc123", details["id"])
	}
}

func TestInvalidRequest(t *testing.T) {
	err := InvalidRequest("url", "URL格式无效")

	if err.Code != CodeInvalidRequest {
		t.Errorf("Expected code %q, got %q", CodeInvalidRequest, err.Code)
	}

	details := err.Details.(map[string]interface{})
	if details["field"] != "url" {
		t.Errorf("Expected field %q, got %v", "url", details["field"])
	}
	if details["reason"] != "URL格式无效" {
		t.Errorf("Expected reason %q, got %v", "URL格式无效", details["reason"])
	}
}

func TestInternalError(t *testing.T) {
	err := InternalError("数据库连接失败")

	if err.Code != CodeInternalError {
		t.Errorf("Expected code %q, got %q", CodeInternalError, err.Code)
	}
	if err.Message != "数据库连接失败" {
		t.Errorf("Expected message %q, got %q", "数据库连接失败", err.Message)
	}
	if err.Details != nil {
		t.Errorf("Expected nil details, got %v", err.Details)
	}
}

func TestUnauthorized(t *testing.T) {
	err := Unauthorized("认证失败")

	if err.Code != CodeUnauthorized {
		t.Errorf("Expected code %q, got %q", CodeUnauthorized, err.Code)
	}
	if err.HTTPStatus != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, err.HTTPStatus)
	}
}

func TestForbidden(t *testing.T) {
	err := Forbidden("Offer", "delete")

	if err.Code != CodeForbidden {
		t.Errorf("Expected code %q, got %q", CodeForbidden, err.Code)
	}

	details := err.Details.(map[string]interface{})
	if details["resource"] != "Offer" {
		t.Errorf("Expected resource %q, got %v", "Offer", details["resource"])
	}
	if details["action"] != "delete" {
		t.Errorf("Expected action %q, got %v", "delete", details["action"])
	}
}

func TestRateLimited(t *testing.T) {
	err := RateLimited(60)

	if err.Code != CodeRateLimitExceeded {
		t.Errorf("Expected code %q, got %q", CodeRateLimitExceeded, err.Code)
	}
	if err.SuggestedAction != "请在60秒后重试" {
		t.Errorf("Expected suggestedAction %q, got %q", "请在60秒后重试", err.SuggestedAction)
	}
	if err.Retryable != true {
		t.Errorf("Expected retryable=true, got %v", err.Retryable)
	}

	details := err.Details.(map[string]interface{})
	if details["retryAfter"] != 60 {
		t.Errorf("Expected retryAfter %d, got %v", 60, details["retryAfter"])
	}
}

func TestTokenInsufficient(t *testing.T) {
	err := TokenInsufficient(100, 50)

	if err.Code != CodeTokenInsufficient {
		t.Errorf("Expected code %q, got %q", CodeTokenInsufficient, err.Code)
	}
	if err.SuggestedAction != "请充值或升级订阅" {
		t.Errorf("Expected suggestedAction %q, got %q", "请充值或升级订阅", err.SuggestedAction)
	}

	details := err.Details.(map[string]interface{})
	if details["required"] != 100 {
		t.Errorf("Expected required %d, got %v", 100, details["required"])
	}
	if details["available"] != 50 {
		t.Errorf("Expected available %d, got %v", 50, details["available"])
	}
}

func TestWriteJSON_TraceIDVariants(t *testing.T) {
	tests := []struct {
		name        string
		headerName  string
		headerValue string
	}{
		{"lowercase x-request-id", "x-request-id", "trace-123"},
		{"capitalized X-Request-Id", "X-Request-Id", "trace-456"},
		{"no trace ID", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			if tt.headerName != "" {
				req.Header.Set(tt.headerName, tt.headerValue)
			}
			w := httptest.NewRecorder()

			err := New(CodeNotFound, "Not found", nil)
			err.WriteJSON(w, req)

			var data map[string]interface{}
			json.Unmarshal(w.Body.Bytes(), &data)
			errorMap := data["error"].(map[string]interface{})

			if tt.headerValue != "" {
				if errorMap["traceId"] != tt.headerValue {
					t.Errorf("Expected traceId %q, got %v", tt.headerValue, errorMap["traceId"])
				}
			} else {
				if _, exists := errorMap["traceId"]; exists {
					t.Errorf("Expected no traceId, got %v", errorMap["traceId"])
				}
			}
		})
	}
}
