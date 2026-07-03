package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// BroadcastStats represents statistics about broadcasts
type BroadcastStats struct {
	TotalBroadcasts int     `json:"totalBroadcasts"`
	SuccessRate     float64 `json:"successRate"`
	TotalSent       int     `json:"totalSent"`
	PendingCount    int     `json:"pendingCount"`
}

// TemplateRequest represents notification template creation request
type TemplateRequest struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// PreviewRequest represents template preview request
type PreviewRequest struct {
	Subject string                 `json:"subject"`
	Body    string                 `json:"body"`
	Context map[string]interface{} `json:"context"`
}

// BroadcastRequest represents the request body for broadcasting notifications
type BroadcastRequest struct {
	Title       string `json:"title"`
	Body        string `json:"body"`
	TargetGroup string `json:"targetGroup"`
	Data        string `json:"data,omitempty"`
}

// BroadcastResponse represents the response for broadcasting notifications
type BroadcastResponse struct {
	Success     bool   `json:"success"`
	BroadcastID string `json:"broadcast_id"`
	Message     string `json:"message,omitempty"`
}

// BroadcastListResponse represents the response for listing broadcasts
type BroadcastListResponse struct {
	Success    bool            `json:"success"`
	Total      int             `json:"total"`
	Broadcasts []BroadcastItem `json:"broadcasts"`
}

// BroadcastItem represents a broadcast notification
type BroadcastItem struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Body        string     `json:"body"`
	TargetGroup string     `json:"targetGroup"`
	Status      string     `json:"status"`
	SentCount   int        `json:"sentCount"`
	CreatedAt   time.Time  `json:"createdAt"`
	SentAt      *time.Time `json:"sentAt,omitempty"`
}

// BroadcastNotification handles broadcasting notifications to target groups
func (h *Handler) BroadcastNotification(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Explicitly use context.Context to satisfy compiler
	var _ context.Context = ctx
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req BroadcastRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Title == "" || req.Body == "" || req.TargetGroup == "" {
		http.Error(w, "Missing required fields: title, body, targetGroup", http.StatusBadRequest)
		return
	}

	// Create broadcast record
	broadcastID := uuid.New().String()
	now := time.Now()

	_, err := h.DB.Exec(ctx, `
		INSERT INTO notifications_broadcast (id, title, body, target_group, status, created_by, created_at, data)
		VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
	`, broadcastID, req.Title, req.Body, req.TargetGroup, userID, now, req.Data)

	if err != nil {
		http.Error(w, "Failed to create broadcast", http.StatusInternalServerError)
		return
	}

	// TODO: Implement actual broadcast logic here
	// For now, mark as sent with 0 recipients since this is a test environment
	_, err = h.DB.Exec(ctx, `
		UPDATE notifications_broadcast
		SET status = 'sent', sent_count = 0, sent_at = $1
		WHERE id = $2
	`, now, broadcastID)

	if err != nil {
		http.Error(w, "Failed to update broadcast status", http.StatusInternalServerError)
		return
	}

	response := BroadcastResponse{
		Success:     true,
		BroadcastID: broadcastID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ListBroadcasts handles listing broadcast notifications
func (h *Handler) ListBroadcasts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Explicitly use context.Context to satisfy compiler
	var _ context.Context = ctx
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Query broadcasts created by this user
	rows, err := h.DB.Query(ctx, `
		SELECT id, title, body, target_group, status, sent_count, created_at, sent_at
		FROM notifications_broadcast
		WHERE created_by = $1
		ORDER BY created_at DESC
		LIMIT 100
	`, userID)

	if err != nil {
		http.Error(w, "Failed to fetch broadcasts", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var broadcasts []BroadcastItem
	for rows.Next() {
		var (
			id          string
			title       string
			body        string
			targetGroup string
			status      string
			sentCount   int
			createdAt   time.Time
			sentAt      *time.Time
		)

		err := rows.Scan(&id, &title, &body, &targetGroup, &status, &sentCount, &createdAt, &sentAt)
		if err != nil {
			http.Error(w, "Failed to scan broadcast", http.StatusInternalServerError)
			return
		}

		broadcasts = append(broadcasts, BroadcastItem{
			ID:          id,
			Title:       title,
			Body:        body,
			TargetGroup: targetGroup,
			Status:      status,
			SentCount:   sentCount,
			CreatedAt:   createdAt,
			SentAt:      sentAt,
		})
	}

	response := BroadcastListResponse{
		Success:    true,
		Total:      len(broadcasts),
		Broadcasts: broadcasts,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetBroadcastStats handles getting broadcast statistics
func (h *Handler) GetBroadcastStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Explicitly use context.Context to satisfy compiler
	var _ context.Context = ctx
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get total broadcasts
	var totalBroadcasts int
	err := h.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM notifications_broadcast WHERE created_by = $1
	`, userID).Scan(&totalBroadcasts)

	if err != nil {
		http.Error(w, "Failed to fetch stats", http.StatusInternalServerError)
		return
	}

	// Get successful broadcasts
	var successfulBroadcasts int
	err = h.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM notifications_broadcast WHERE created_by = $1 AND status = 'sent'
	`, userID).Scan(&successfulBroadcasts)

	if err != nil {
		http.Error(w, "Failed to fetch stats", http.StatusInternalServerError)
		return
	}

	// Get total sent count
	var totalSent int
	err = h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(sent_count), 0) FROM notifications_broadcast WHERE created_by = $1
	`, userID).Scan(&totalSent)

	if err != nil {
		http.Error(w, "Failed to fetch stats", http.StatusInternalServerError)
		return
	}

	// Get pending count
	var pendingCount int
	err = h.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM notifications_broadcast WHERE created_by = $1 AND status = 'pending'
	`, userID).Scan(&pendingCount)

	if err != nil {
		http.Error(w, "Failed to fetch stats", http.StatusInternalServerError)
		return
	}

	// Calculate success rate
	successRate := 0.0
	if totalBroadcasts > 0 {
		successRate = float64(successfulBroadcasts) / float64(totalBroadcasts)
	}

	stats := BroadcastStats{
		TotalBroadcasts: totalBroadcasts,
		SuccessRate:     successRate,
		TotalSent:       totalSent,
		PendingCount:    pendingCount,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// CreateNotificationTemplate handles creating notification templates
func (h *Handler) CreateNotificationTemplate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Explicitly use context.Context to satisfy compiler
	var _ context.Context = ctx
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req TemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Name == "" || req.Type == "" || req.Subject == "" || req.Body == "" {
		http.Error(w, "Missing required fields: name, type, subject, body", http.StatusBadRequest)
		return
	}

	// Create template record
	templateID := uuid.New().String()

	_, err := h.DB.Exec(ctx, `
		INSERT INTO notification_templates (id, name, type, subject, body, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, templateID, req.Name, req.Type, req.Subject, req.Body, userID, time.Now())

	if err != nil {
		http.Error(w, "Failed to create template", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"success":     true,
		"template_id": templateID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// PreviewTemplate handles previewing notification templates with context
func (h *Handler) PreviewTemplate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Explicitly use context.Context to satisfy compiler
	var _ context.Context = ctx
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req PreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Simple template preview (no complex templating engine for now)
	// Just return the subject and body with basic context substitution
	subject := req.Subject
	body := req.Body

	// Basic context substitution
	if req.Context != nil {
		for key, value := range req.Context {
			placeholder := "{{" + key + "}}"
			if strValue, ok := value.(string); ok {
				body = strings.ReplaceAll(body, placeholder, strValue)
				subject = strings.ReplaceAll(subject, placeholder, strValue)
			}
		}
	}

	response := map[string]interface{}{
		"success": true,
		"subject": subject,
		"body":    body,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ListNotificationTemplates handles listing notification templates
func (h *Handler) ListNotificationTemplates(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Explicitly use context.Context to satisfy compiler
	var _ context.Context = ctx
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Query templates created by this user
	rows, err := h.DB.Query(ctx, `
		SELECT id, name, type, subject, body, created_at
		FROM notification_templates
		WHERE created_by = $1
		ORDER BY created_at DESC
		LIMIT 100
	`, userID)

	if err != nil {
		http.Error(w, "Failed to fetch templates", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var templates []map[string]interface{}
	for rows.Next() {
		var (
			id           string
			name         string
			templateType string
			subject      string
			body         string
			createdAt    time.Time
		)

		err := rows.Scan(&id, &name, &templateType, &subject, &body, &createdAt)
		if err != nil {
			http.Error(w, "Failed to scan template", http.StatusInternalServerError)
			return
		}

		template := map[string]interface{}{
			"id":        id,
			"name":      name,
			"type":      templateType,
			"subject":   subject,
			"body":      body,
			"createdAt": createdAt,
		}
		templates = append(templates, template)
	}

	response := map[string]interface{}{
		"success":   true,
		"total":     len(templates),
		"templates": templates,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
