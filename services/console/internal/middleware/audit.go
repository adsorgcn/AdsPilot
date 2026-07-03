// Package middleware - Audit logging middleware for admin operations
package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// AuditLogger logs administrative operations to the database
type AuditLogger struct {
	DB *pgxpool.Pool
}

// AuditLogEntry represents an audit log entry
type AuditLogEntry struct {
	UserID       string                 `json:"userId"`
	UserEmail    string                 `json:"userEmail,omitempty"`
	Action       string                 `json:"action"`
	Resource     string                 `json:"resource"`
	ResourceID   string                 `json:"resourceId,omitempty"`
	Method       string                 `json:"method"`
	Path         string                 `json:"path"`
	StatusCode   int                    `json:"statusCode"`
	RequestBody  map[string]interface{} `json:"requestBody,omitempty"`
	ResponseBody map[string]interface{} `json:"responseBody,omitempty"`
	IPAddress    string                 `json:"ipAddress,omitempty"`
	UserAgent    string                 `json:"userAgent,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt    time.Time              `json:"createdAt"`
}

// responseWriter wraps http.ResponseWriter to capture status code and response body
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if rw.body != nil && len(b) < 10000 { // Only capture responses < 10KB
		rw.body.Write(b)
	}
	return rw.ResponseWriter.Write(b)
}

// AuditMiddleware creates a middleware that logs all admin operations
func (al *AuditLogger) AuditMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip audit for health checks and read-only operations
		if shouldSkipAudit(r.Method, r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Read and buffer request body
		var requestBody map[string]interface{}
		if r.Body != nil && r.Method != http.MethodGet {
			bodyBytes, err := io.ReadAll(r.Body)
			if err == nil {
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				if len(bodyBytes) > 0 && len(bodyBytes) < 50000 {
					json.Unmarshal(bodyBytes, &requestBody)
					filterSensitiveData(requestBody)
				}
			}
		}

		// Wrap response writer
		rw := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
			body:           &bytes.Buffer{},
		}

		// Serve request
		next.ServeHTTP(rw, r)

		// Log after request completes
		go al.logAuditEntry(r.Context(), r, rw, requestBody)
	})
}

// shouldSkipAudit determines if an operation should be skipped from audit log
func shouldSkipAudit(method, path string) bool {
	// Skip health checks
	if strings.HasPrefix(path, "/health") || strings.HasPrefix(path, "/readyz") {
		return true
	}

	// Skip GET requests (read-only)
	if method == http.MethodGet {
		return true
	}

	// Skip internal endpoints
	if strings.Contains(path, "/apikeys/validate") {
		return true
	}

	return false
}

// logAuditEntry logs the audit entry to the database
func (al *AuditLogger) logAuditEntry(ctx context.Context, r *http.Request, rw *responseWriter, requestBody map[string]interface{}) {
	if al.DB == nil {
		return
	}

	// Extract user info from context
	userID := getUserIDFromContext(r.Context())
	userEmail := getUserEmailFromContext(r.Context())

	// Parse action and resource from path
	action, resource, resourceID := parseActionFromPath(r.Method, r.URL.Path)

	// Parse response body
	var responseBody map[string]interface{}
	if rw.body.Len() > 0 && rw.body.Len() < 10000 {
		json.Unmarshal(rw.body.Bytes(), &responseBody)
		filterSensitiveData(responseBody)
	}

	// Get IP address
	ipAddress := r.Header.Get("X-Forwarded-For")
	if ipAddress == "" {
		ipAddress = r.RemoteAddr
	}

	// Insert audit log
	query := `
		INSERT INTO audit_log (
			"userId", "userEmail", action, resource, "resourceId",
			method, path, "statusCode", "requestBody", "responseBody",
			"ipAddress", "userAgent", metadata, "createdAt"
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	requestBodyJSON, _ := json.Marshal(requestBody)
	responseBodyJSON, _ := json.Marshal(responseBody)
	metadata := map[string]interface{}{
		"query": r.URL.RawQuery,
	}
	metadataJSON, _ := json.Marshal(metadata)

	_, err := al.DB.Exec(ctx, query,
		userID,
		userEmail,
		action,
		resource,
		resourceID,
		r.Method,
		r.URL.Path,
		rw.statusCode,
		requestBodyJSON,
		responseBodyJSON,
		ipAddress,
		r.UserAgent(),
		metadataJSON,
		time.Now(),
	)

	if err != nil {
		// Log error but don't fail the request
		// In production, you might want to log this to an error tracking service
		_ = err
	}
}

// parseActionFromPath extracts action, resource, and resourceID from the request path
func parseActionFromPath(method, path string) (action, resource, resourceID string) {
	parts := strings.Split(strings.Trim(path, "/"), "/")

	// Default resource
	resource = "unknown"
	action = "other"

	// Parse path patterns
	if len(parts) >= 4 && parts[0] == "api" && parts[1] == "v1" && parts[2] == "console" {
		resource = parts[3] // e.g., "users", "plans", "tokens"

		switch method {
		case http.MethodPost:
			action = resource + ".create"
			if len(parts) >= 5 {
				resourceID = parts[4]
				if len(parts) >= 6 {
					action = resource + "." + parts[5] // e.g., users.archive
				}
			}
		case http.MethodPut:
			action = resource + ".update"
			if len(parts) >= 5 {
				resourceID = parts[4]
			}
		case http.MethodDelete:
			action = resource + ".delete"
			if len(parts) >= 5 {
				resourceID = parts[4]
			}
		}

		// Special cases for bulk operations
		if strings.Contains(path, "/bulk/") {
			if strings.Contains(path, "/offers/archive") {
				action = "offer.bulk.archive"
				resource = "offer"
			} else if strings.Contains(path, "/offers/status") {
				action = "offer.bulk.status"
				resource = "offer"
			} else if strings.Contains(path, "/tokens/topup") {
				action = "token.bulk.topup"
				resource = "token"
			}
		}
	}

	return action, resource, resourceID
}

// filterSensitiveData removes sensitive fields from JSON objects
func filterSensitiveData(data map[string]interface{}) {
	if data == nil {
		return
	}

	sensitiveFields := []string{
		"password", "token", "secret", "apiKey", "serviceKey",
		"credential", "accessToken", "refreshToken", "privateKey",
	}

	for _, field := range sensitiveFields {
		if _, exists := data[field]; exists {
			data[field] = "[REDACTED]"
		}
	}

	// Recursively filter nested objects
	for _, value := range data {
		if nested, ok := value.(map[string]interface{}); ok {
			filterSensitiveData(nested)
		}
	}
}

// getUserIDFromContext extracts user ID from request context
func getUserIDFromContext(ctx context.Context) string {
	if userID := ctx.Value("userID"); userID != nil {
		if uid, ok := userID.(string); ok {
			return uid
		}
	}
	return "unknown"
}

// getUserEmailFromContext extracts user email from request context
func getUserEmailFromContext(ctx context.Context) string {
	if userEmail := ctx.Value("userEmail"); userEmail != nil {
		if email, ok := userEmail.(string); ok {
			return email
		}
	}
	return ""
}
