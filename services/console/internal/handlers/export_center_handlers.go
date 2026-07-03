package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type ExportStats struct {
	TotalExports  int            `json:"total_exports"`
	TodayExports  int            `json:"today_exports"`
	TypeBreakdown map[string]int `json:"type_breakdown"`
}

// ListExportHistory returns export history for the current user
func (h *Handler) ListExportHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Explicitly use context.Context to satisfy compiler
	var _ context.Context = ctx
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(ctx, `
		SELECT id, type, format, status, start_date, end_date, record_count,
		       file_url, error_message, created_at, completed_at
		FROM export_history
		WHERE created_by = $1
		ORDER BY created_at DESC
		LIMIT 100
	`, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var history []map[string]interface{}
	for rows.Next() {
		var (
			id           string
			exportType   string
			format       string
			status       string
			startDate    *time.Time
			endDate      *time.Time
			recordCount  int
			fileURL      *string
			errorMessage *string
			createdAt    time.Time
			completedAt  *time.Time
		)

		err := rows.Scan(&id, &exportType, &format, &status, &startDate, &endDate,
			&recordCount, &fileURL, &errorMessage, &createdAt, &completedAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		item := map[string]interface{}{
			"id":           id,
			"type":         exportType,
			"format":       format,
			"status":       status,
			"record_count": recordCount,
			"created_at":   createdAt,
		}

		if startDate != nil {
			item["start_date"] = startDate.Format("2006-01-02")
		}
		if endDate != nil {
			item["end_date"] = endDate.Format("2006-01-02")
		}
		if fileURL != nil {
			item["file_url"] = *fileURL
		}
		if errorMessage != nil {
			item["error_message"] = *errorMessage
		}
		if completedAt != nil {
			item["completed_at"] = *completedAt
		}

		history = append(history, item)
	}

	if history == nil {
		history = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total":   len(history),
		"history": history,
	})
}

// RecordExportHistory creates a new export history record
func (h *Handler) RecordExportHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		Type        string `json:"type"`
		Format      string `json:"format"`
		StartDate   string `json:"start_date"`
		EndDate     string `json:"end_date"`
		RecordCount int    `json:"record_count"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	exportID := uuid.New().String()

	_, err := h.DB.Exec(ctx, `
		INSERT INTO export_history (id, created_by, type, format, start_date, end_date, record_count, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
	`, exportID, userID, payload.Type, payload.Format, payload.StartDate, payload.EndDate, payload.RecordCount)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"export_id": exportID,
	})
}

// GetExportStats returns export statistics for the current user
func (h *Handler) GetExportStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get total exports
	var totalExports int
	err := h.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM export_history WHERE created_by = $1
	`, userID).Scan(&totalExports)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Get today's exports
	var todayExports int
	err = h.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM export_history
		WHERE created_by = $1 AND created_at >= CURRENT_DATE
	`, userID).Scan(&todayExports)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Get type breakdown
	rows, err := h.DB.Query(ctx, `
		SELECT type, COUNT(*) as count
		FROM export_history
		WHERE created_by = $1
		GROUP BY type
	`, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	typeBreakdown := make(map[string]int)
	for rows.Next() {
		var exportType string
		var count int
		if err := rows.Scan(&exportType, &count); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		typeBreakdown[exportType] = count
	}

	stats := ExportStats{
		TotalExports:  totalExports,
		TodayExports:  todayExports,
		TypeBreakdown: typeBreakdown,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
