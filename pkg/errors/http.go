package errors

import (
	"encoding/json"
	"net/http"
)

// ErrorBody is the unified error shape for all services.
// { code, message, details?, traceId }
type ErrorBody struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
	TraceID string      `json:"traceId,omitempty"`
}

// Write writes a JSON error body with given status code and headers.
func Write(w http.ResponseWriter, r *http.Request, status int, code, message string, details interface{}) {
	traceID := r.Header.Get("x-request-id")
	if traceID == "" {
		traceID = r.Header.Get("X-Request-Id")
	}
	body := ErrorBody{Code: code, Message: message, Details: details, TraceID: traceID}
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"error": body})
}
