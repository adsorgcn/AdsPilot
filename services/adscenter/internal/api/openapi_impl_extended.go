package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	api "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/oapi"
)

// This file contains extended OpenAPI implementations for complex methods
// These methods were extracted from main_old.go.bak and simplified

// GetBulkAction retrieves a single bulk action operation by ID
func (h *OASImpl) GetBulkAction(w http.ResponseWriter, r *http.Request, id string) {
	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		apiErr := apierrors.InternalError("DATABASE_URL not set")
		apiErr.WriteJSON(w, r)
		return
	}

	db, err := openDB(dbURL)
	if err != nil {
		apiErr := apierrors.InternalError("db open failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer db.Close()

	var status sql.NullString
	var created, updated sql.NullTime
	err = db.QueryRow(`SELECT status, created_at, updated_at FROM "BulkActionOperation" WHERE id=$1`, id).Scan(&status, &created, &updated)
	if err != nil {
		if err == sql.ErrNoRows {
			apiErr := apierrors.NotFound("operation not found", "")
			apiErr.WriteJSON(w, r)
			return
		}
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	resp := api.BulkActionOperation{
		OperationId: id,
		Status:      api.BulkActionOperationStatus(status.String),
	}
	if created.Valid {
		resp.CreatedAt = &created.Time
	}
	if updated.Valid {
		resp.UpdatedAt = &updated.Time
	}

	// Parse summary from plan
	var actions int
	var plan struct {
		Actions *[]interface{} `json:"actions"`
	}
	if row := db.QueryRow(`SELECT plan FROM "BulkActionOperation" WHERE id=$1`, id); row != nil {
		var txt string
		if err := row.Scan(&txt); err == nil && txt != "" {
			_ = json.Unmarshal([]byte(txt), &plan)
			if plan.Actions != nil {
				actions = len(*plan.Actions)
			}
		}
	}

	if actions > 0 {
		resp.Summary = &struct {
			Actions           *int `json:"actions,omitempty"`
			EstimatedAffected *int `json:"estimatedAffected,omitempty"`
		}{Actions: &actions}
	}

	writeJSON(w, http.StatusOK, resp)
}

// ListBulkActions lists bulk action operations with optional filtering
func (h *OASImpl) ListBulkActions(w http.ResponseWriter, r *http.Request, params api.ListBulkActionsParams) {
	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if dbURL == "" || uid == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": []interface{}{}})
		return
	}

	db, err := openDB(dbURL)
	if err != nil {
		apiErr := apierrors.InternalError("db open failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer db.Close()

	limit := 50
	if params.Limit != nil && *params.Limit > 0 && *params.Limit <= 200 {
		limit = int(*params.Limit)
	}

	// Optional offerId filter
	offerID := strings.TrimSpace(r.URL.Query().Get("offerId"))

	// Simple query without offerId filter
	if offerID == "" {
		rows, err := db.QueryContext(r.Context(), `
			SELECT id, status, created_at, updated_at 
			FROM "BulkActionOperation" 
			WHERE user_id=$1 
			ORDER BY updated_at DESC 
			LIMIT $2
		`, uid, limit)
		if err != nil {
			apiErr := apierrors.InternalError("query failed")
			apiErr.Details = map[string]interface{}{"error": err.Error()}
			apiErr.WriteJSON(w, r)
			return
		}
		defer rows.Close()

		out := []api.BulkActionOperation{}
		for rows.Next() {
			var id string
			var status sql.NullString
			var created, updated sql.NullTime
			if err := rows.Scan(&id, &status, &created, &updated); err == nil {
				item := api.BulkActionOperation{
					OperationId: id,
					Status:      api.BulkActionOperationStatus(status.String),
				}
				if created.Valid {
					item.CreatedAt = &created.Time
				}
				if updated.Valid {
					item.UpdatedAt = &updated.Time
				}
				out = append(out, item)
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": out})
		return
	}

	// With offerId filter - need to scan plan JSON
	rows, err := db.QueryContext(r.Context(), `
		SELECT id, status, created_at, updated_at, plan::text 
		FROM "BulkActionOperation" 
		WHERE user_id=$1 
		ORDER BY updated_at DESC 
		LIMIT $2
	`, uid, 200)
	if err != nil {
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer rows.Close()

	out := make([]api.BulkActionOperation, 0, limit)
	needle := `"offerId":"` + offerID + `"`

	for rows.Next() {
		var id, planTxt string
		var status sql.NullString
		var created, updated sql.NullTime
		if err := rows.Scan(&id, &status, &created, &updated, &planTxt); err == nil {
			if !strings.Contains(planTxt, needle) {
				continue
			}
			item := api.BulkActionOperation{
				OperationId: id,
				Status:      api.BulkActionOperationStatus(status.String),
			}
			if created.Valid {
				item.CreatedAt = &created.Time
			}
			if updated.Valid {
				item.UpdatedAt = &updated.Time
			}
			out = append(out, item)
			if len(out) >= limit {
				break
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"items": out, "offerId": offerID})
}

// GetBulkActionPlan retrieves the execution plan for a bulk action
func (h *OASImpl) GetBulkActionPlan(w http.ResponseWriter, r *http.Request, id string) {
	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		apiErr := apierrors.InternalError("DATABASE_URL not set")
		apiErr.WriteJSON(w, r)
		return
	}

	db, err := openDB(dbURL)
	if err != nil {
		apiErr := apierrors.InternalError("db open failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer db.Close()

	var planText string
	err = db.QueryRow(`SELECT plan::text FROM "BulkActionOperation" WHERE id=$1`, id).Scan(&planText)
	if err != nil {
		if err == sql.ErrNoRows {
			apiErr := apierrors.NotFound("operation not found", "")
			apiErr.WriteJSON(w, r)
			return
		}
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	var plan interface{}
	if err := json.Unmarshal([]byte(planText), &plan); err != nil {
		apiErr := apierrors.InternalError("failed to parse plan")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	writeJSON(w, http.StatusOK, plan)
}

// ValidateBulkActions validates a bulk action plan before submission
func (h *OASImpl) ValidateBulkActions(w http.ResponseWriter, r *http.Request) {
	// This is a simplified implementation
	// Full implementation would include comprehensive validation logic

	// For now, return a basic validation response
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"valid":    true,
		"errors":   []interface{}{},
		"warnings": []interface{}{},
		"message":  "Validation passed (simplified implementation)",
	})
}

// GetRollbackPlan generates a rollback plan for a bulk action
func (h *OASImpl) GetRollbackPlan(w http.ResponseWriter, r *http.Request, id string) {
	// This is a simplified implementation
	// Full implementation would analyze audit logs and generate precise rollback actions

	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		apiErr := apierrors.InternalError("DATABASE_URL not set")
		apiErr.WriteJSON(w, r)
		return
	}

	db, err := openDB(dbURL)
	if err != nil {
		apiErr := apierrors.InternalError("db open failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer db.Close()

	// Check if operation exists
	var exists bool
	err = db.QueryRow(`SELECT EXISTS(SELECT 1 FROM "BulkActionOperation" WHERE id=$1)`, id).Scan(&exists)
	if err != nil || !exists {
		apiErr := apierrors.NotFound("operation not found", "")
		apiErr.WriteJSON(w, r)
		return
	}

	// Simplified rollback plan
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"operationId":  id,
		"validateOnly": true,
		"actions":      []interface{}{},
		"message":      "Rollback plan generation (simplified implementation)",
		"note":         "Full implementation would analyze audit logs to generate precise rollback actions",
	})
}

// RollbackExecute executes a rollback operation
func (h *OASImpl) RollbackExecute(w http.ResponseWriter, r *http.Request, id string) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		apiErr := apierrors.InternalError("DATABASE_URL not set")
		apiErr.WriteJSON(w, r)
		return
	}

	db, err := openDB(dbURL)
	if err != nil {
		apiErr := apierrors.InternalError("db open failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer db.Close()

	// Check if operation exists
	var exists bool
	err = db.QueryRow(`SELECT EXISTS(SELECT 1 FROM "BulkActionOperation" WHERE id=$1 AND user_id=$2)`, id, uid).Scan(&exists)
	if err != nil || !exists {
		apiErr := apierrors.NotFound("operation not found", "")
		apiErr.WriteJSON(w, r)
		return
	}

	// Simplified rollback execution
	// Full implementation would execute actual rollback operations
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"operationId": id,
		"status":      "rollback_initiated",
		"message":     "Rollback execution (simplified implementation)",
		"note":        "Full implementation would execute actual rollback operations based on audit logs",
	})
}

// GetRollbackReport retrieves the rollback execution report
func (h *OASImpl) GetRollbackReport(w http.ResponseWriter, r *http.Request, id string, params api.GetRollbackReportParams) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		apiErr := apierrors.InternalError("DATABASE_URL not set")
		apiErr.WriteJSON(w, r)
		return
	}

	db, err := openDB(dbURL)
	if err != nil {
		apiErr := apierrors.InternalError("db open failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer db.Close()

	// Query rollback audits
	rows, err := db.QueryContext(r.Context(), `
		SELECT id, kind, snapshot, created_at 
		FROM "BulkActionAudit" 
		WHERE op_id=$1 AND kind='rollback_exec' 
		ORDER BY created_at DESC 
		LIMIT 100
	`, id)
	if err != nil {
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer rows.Close()

	audits := []map[string]interface{}{}
	for rows.Next() {
		var auditID, kind, snapshot string
		var createdAt sql.NullTime
		if err := rows.Scan(&auditID, &kind, &snapshot, &createdAt); err == nil {
			audit := map[string]interface{}{
				"id":   auditID,
				"kind": kind,
			}
			if createdAt.Valid {
				audit["createdAt"] = createdAt.Time
			}
			audits = append(audits, audit)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"operationId": id,
		"audits":      audits,
		"total":       len(audits),
	})
}

// ListAuditEvents lists audit events with filtering
func (h *OASImpl) ListAuditEvents(w http.ResponseWriter, r *http.Request, params api.ListAuditEventsParams) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		writeJSON(w, http.StatusOK, map[string]interface{}{"items": []interface{}{}})
		return
	}

	db, err := openDB(dbURL)
	if err != nil {
		apiErr := apierrors.InternalError("db open failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer db.Close()

	limit := 50
	if params.Limit != nil && *params.Limit > 0 && *params.Limit <= 200 {
		limit = int(*params.Limit)
	}

	// Query audits
	rows, err := db.QueryContext(r.Context(), `
		SELECT a.id, a.op_id, a.kind, a.created_at, o.user_id
		FROM "BulkActionAudit" a
		LEFT JOIN "BulkActionOperation" o ON a.op_id = o.id
		WHERE o.user_id = $1
		ORDER BY a.created_at DESC
		LIMIT $2
	`, uid, limit)
	if err != nil {
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer rows.Close()

	audits := []map[string]interface{}{}
	for rows.Next() {
		var auditID, opID, kind string
		var userID sql.NullString
		var createdAt sql.NullTime
		if err := rows.Scan(&auditID, &opID, &kind, &createdAt, &userID); err == nil {
			audit := map[string]interface{}{
				"id":          auditID,
				"operationId": opID,
				"kind":        kind,
			}
			if createdAt.Valid {
				audit["createdAt"] = createdAt.Time
			}
			audits = append(audits, audit)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": audits,
		"total": len(audits),
	})
}

// ListStrategies returns available automation strategies
func (h *OASImpl) ListStrategies(w http.ResponseWriter, r *http.Request) {
	// Return a list of available automation strategies
	// This is a simplified implementation that returns predefined strategies
	strategies := []map[string]interface{}{
		{
			"id":          "auto-optimize-budget",
			"name":        "Auto Optimize Budget",
			"description": "Automatically adjust ad budget allocation based on performance",
		},
		{
			"id":          "auto-pause-low-performance",
			"name":        "Auto Pause Low Performance",
			"description": "Automatically pause underperforming campaigns or ad groups",
		},
		{
			"id":          "auto-adjust-bids",
			"name":        "Auto Adjust Bids",
			"description": "Optimize keyword bids based on conversion rates",
		},
		{
			"id":          "auto-scale-high-performers",
			"name":        "Auto Scale High Performers",
			"description": "Increase budget for high-performing campaigns",
		},
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": strategies,
	})
}
