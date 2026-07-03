package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	apperr "github.com/ScientificInternet/Google-Monetize/pkg/errors"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
)

// ExecutorHandler handles bulk action execution lifecycle endpoints
type ExecutorHandler struct {
	DB *sql.DB
}

// NewExecutorHandler creates a new executor handler
func NewExecutorHandler(db *sql.DB) *ExecutorHandler {
	return &ExecutorHandler{DB: db}
}

// HandleExecuteNextShard picks the next queued shard for a bulk operation and executes it
// POST /api/v1/adscenter/bulk-actions/{id}/execute-next
func (h *ExecutorHandler) HandleExecuteNextShard(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	// Extract operation ID from path
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/"), "/")
	var opID string
	for i, p := range parts {
		if p == "bulk-actions" && i+1 < len(parts) {
			opID = parts[i+1]
			break
		}
	}
	if opID == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "operation ID required", nil)
		return
	}

	// TODO: Implement shard execution logic
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":      true,
		"message": "Shard execution not yet implemented",
		"opId":    opID,
	})
}

// HandleExecuteTick processes queued bulk operations
// POST /api/v1/adscenter/bulk-actions/execute-tick
func (h *ExecutorHandler) HandleExecuteTick(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	// TODO: Implement tick execution logic
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":        true,
		"processed": 0,
	})
}

// HandleListShards lists all shards for a bulk operation
// GET /api/v1/adscenter/bulk-actions/{id}/shards
func (h *ExecutorHandler) HandleListShards(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/"), "/")
	var opID string
	for i, p := range parts {
		if p == "bulk-actions" && i+1 < len(parts) {
			opID = parts[i+1]
			break
		}
	}

	if opID == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "operation ID required", nil)
		return
	}

	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, seq, status, created_at, updated_at
		FROM "BulkActionShard"
		WHERE op_id = $1
		ORDER BY seq ASC
	`, opID)
	if err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "DATABASE_ERROR", err.Error(), nil)
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, seq int
		var status, createdAt, updatedAt string
		if err := rows.Scan(&id, &seq, &status, &createdAt, &updatedAt); err == nil {
			items = append(items, map[string]any{
				"id":        id,
				"seq":       seq,
				"status":    status,
				"createdAt": createdAt,
				"updatedAt": updatedAt,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"items": items})
}

// HandleListSnapshots lists snapshots for a bulk operation
// GET /api/v1/adscenter/bulk-actions/{id}/snapshots
func (h *ExecutorHandler) HandleListSnapshots(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/"), "/")
	var opID string
	for i, p := range parts {
		if p == "bulk-actions" && i+1 < len(parts) {
			opID = parts[i+1]
			break
		}
	}

	limit := 50
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}

	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, resource_type, resource_id, before_state, after_state, created_at
		FROM "BulkActionSnapshot"
		WHERE op_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, opID, limit)
	if err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "DATABASE_ERROR", err.Error(), nil)
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id int
		var resourceType, resourceID, beforeState, afterState, createdAt string
		if err := rows.Scan(&id, &resourceType, &resourceID, &beforeState, &afterState, &createdAt); err == nil {
			items = append(items, map[string]any{
				"id":           id,
				"resourceType": resourceType,
				"resourceId":   resourceID,
				"before":       beforeState,
				"after":        afterState,
				"createdAt":    createdAt,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"items": items})
}

// HandleListDeadLetters lists dead letters for a bulk operation
// GET /api/v1/adscenter/bulk-actions/{id}/deadletters
func (h *ExecutorHandler) HandleListDeadLetters(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/"), "/")
	var opID string
	for i, p := range parts {
		if p == "bulk-actions" && i+1 < len(parts) {
			opID = parts[i+1]
			break
		}
	}

	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, resource_type, resource_id, error_message, retry_count, created_at
		FROM "BulkActionDeadLetter"
		WHERE op_id = $1
		ORDER BY created_at DESC
	`, opID)
	if err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "DATABASE_ERROR", err.Error(), nil)
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, retryCount int
		var resourceType, resourceID, errorMsg, createdAt string
		if err := rows.Scan(&id, &resourceType, &resourceID, &errorMsg, &retryCount, &createdAt); err == nil {
			items = append(items, map[string]any{
				"id":           id,
				"resourceType": resourceType,
				"resourceId":   resourceID,
				"error":        errorMsg,
				"retryCount":   retryCount,
				"createdAt":    createdAt,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"items": items})
}

// HandleRetryDeadLetter retries a single dead letter
// POST /api/v1/adscenter/bulk-actions/{id}/deadletters/{dlid}/retry
func (h *ExecutorHandler) HandleRetryDeadLetter(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	// TODO: Implement retry logic
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":      true,
		"message": "Retry not yet implemented",
	})
}

// HandleRetryDeadLetterBatch retries multiple dead letters
// POST /api/v1/adscenter/bulk-actions/{id}/deadletters/retry-batch
func (h *ExecutorHandler) HandleRetryDeadLetterBatch(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	// TODO: Implement batch retry logic
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":      true,
		"retried": 0,
	})
}

// HandleSnapshotAggregate provides aggregated snapshot statistics
// GET /api/v1/adscenter/bulk-actions/{id}/snapshot-aggregate
func (h *ExecutorHandler) HandleSnapshotAggregate(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/"), "/")
	var opID string
	for i, p := range parts {
		if p == "bulk-actions" && i+1 < len(parts) {
			opID = parts[i+1]
			break
		}
	}

	row := h.DB.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COUNT(DISTINCT resource_type)
		FROM "BulkActionSnapshot"
		WHERE op_id = $1
	`, opID)

	var total, types int
	_ = row.Scan(&total, &types)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"totalSnapshots": total,
		"resourceTypes":  types,
		"opId":           opID,
	})
}
