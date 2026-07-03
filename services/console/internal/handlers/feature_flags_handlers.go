package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// CreateFeatureFlag creates a new feature flag
func (h *Handler) CreateFeatureFlag(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		Key         string `json:"key"`
		Enabled     bool   `json:"enabled"`
		Description string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	flagID := uuid.New().String()

	_, err := h.DB.Exec(ctx, `
		INSERT INTO feature_flags (id, key, enabled, description, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, flagID, payload.Key, payload.Enabled, payload.Description, userID, userID)

	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			http.Error(w, "Feature flag already exists", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"key":     payload.Key,
	})
}

// ListFeatureFlags returns all feature flags
func (h *Handler) ListFeatureFlags(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	_, ok := ctx.Value("user_id").(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(ctx, `
		SELECT id, key, enabled, description, created_at, updated_at
		FROM feature_flags
		ORDER BY created_at DESC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var flags []map[string]interface{}
	for rows.Next() {
		var (
			id          string
			key         string
			enabled     bool
			description *string
			createdAt   time.Time
			updatedAt   time.Time
		)

		err := rows.Scan(&id, &key, &enabled, &description, &createdAt, &updatedAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		flag := map[string]interface{}{
			"id":         id,
			"key":        key,
			"enabled":    enabled,
			"created_at": createdAt,
			"updated_at": updatedAt,
		}

		if description != nil {
			flag["description"] = *description
		}

		flags = append(flags, flag)
	}

	if flags == nil {
		flags = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"flags": flags,
	})
}

// UpdateFeatureFlag updates an existing feature flag
func (h *Handler) UpdateFeatureFlag(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract flag key from URL path
	path := r.URL.Path
	parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
	if len(parts) == 0 {
		http.Error(w, "Invalid flag key", http.StatusBadRequest)
		return
	}
	flagKey := parts[len(parts)-1]

	var payload struct {
		Enabled     bool   `json:"enabled"`
		Description string `json:"description"`
		Reason      string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get old value first
	var oldEnabled bool
	err := h.DB.QueryRow(ctx, `
		SELECT enabled FROM feature_flags WHERE key = $1
	`, flagKey).Scan(&oldEnabled)

	if err != nil {
		http.Error(w, "Feature flag not found", http.StatusNotFound)
		return
	}

	// Update feature flag
	_, err = h.DB.Exec(ctx, `
		UPDATE feature_flags
		SET enabled = $1, description = $2, updated_by = $3, updated_at = NOW()
		WHERE key = $4
	`, payload.Enabled, payload.Description, userID, flagKey)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Record history only if value changed
	if oldEnabled != payload.Enabled {
		_, err = h.DB.Exec(ctx, `
			INSERT INTO feature_flag_history (flag_key, old_value, new_value, changed_by, reason)
			VALUES ($1, $2, $3, $4, $5)
		`, flagKey, oldEnabled, payload.Enabled, userID, payload.Reason)

		if err != nil {
			// Log error but don't fail the request
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// GetFeatureFlagHistory returns the change history for a feature flag
func (h *Handler) GetFeatureFlagHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	_, ok := ctx.Value("user_id").(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract flag key from URL path
	path := r.URL.Path
	parts := strings.Split(strings.TrimSuffix(path, "/history"), "/")
	if len(parts) == 0 {
		http.Error(w, "Invalid flag key", http.StatusBadRequest)
		return
	}
	flagKey := parts[len(parts)-1]

	rows, err := h.DB.Query(ctx, `
		SELECT id, flag_key, old_value, new_value, changed_by, reason, created_at
		FROM feature_flag_history
		WHERE flag_key = $1
		ORDER BY created_at DESC
	`, flagKey)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var history []map[string]interface{}
	for rows.Next() {
		var (
			id        string
			flagKey   string
			oldValue  bool
			newValue  bool
			changedBy string
			reason    *string
			createdAt time.Time
		)

		err := rows.Scan(&id, &flagKey, &oldValue, &newValue, &changedBy, &reason, &createdAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		item := map[string]interface{}{
			"id":         id,
			"flag_key":   flagKey,
			"old_value":  oldValue,
			"new_value":  newValue,
			"changed_by": changedBy,
			"created_at": createdAt,
		}

		if reason != nil {
			item["reason"] = *reason
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

// DeleteFeatureFlag deletes a feature flag
func (h *Handler) DeleteFeatureFlag(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	_, ok := ctx.Value("user_id").(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract flag key from URL path
	path := r.URL.Path
	parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
	if len(parts) == 0 {
		http.Error(w, "Invalid flag key", http.StatusBadRequest)
		return
	}
	flagKey := parts[len(parts)-1]

	result, err := h.DB.Exec(ctx, `
		DELETE FROM feature_flags WHERE key = $1
	`, flagKey)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Feature flag not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}
