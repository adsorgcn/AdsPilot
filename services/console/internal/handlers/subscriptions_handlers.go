package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Subscription represents a user subscription
type Subscription struct {
	ID               string     `json:"id"`
	UserID           string     `json:"userId"`
	PlanName         string     `json:"planName"`
	Status           string     `json:"status"`
	CurrentPeriodEnd *time.Time `json:"currentPeriodEnd,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

// SubscriptionWithUser extends Subscription with user info
type SubscriptionWithUser struct {
	Subscription
	UserEmail string `json:"userEmail,omitempty"`
	UserName  string `json:"userName,omitempty"`
}

// ListSubscriptionsResponse represents the response for subscription list
type ListSubscriptionsResponse struct {
	Items      []SubscriptionWithUser `json:"items"`
	TotalCount int                    `json:"totalCount"`
	Page       int                    `json:"page"`
	PageSize   int                    `json:"pageSize"`
}

// AdjustSubscriptionRequest represents the request to adjust a subscription
type AdjustSubscriptionRequest struct {
	PlanName string `json:"planName"`
	Status   string `json:"status,omitempty"`
	Days     int    `json:"days,omitempty"` // Extend subscription by days
}

// getSubscriptions handles GET /api/v1/console/subscriptions
// BE-080: 实现订阅列表查询
func (h *Handler) getSubscriptions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query parameters
	query := r.URL.Query()
	page, _ := strconv.Atoi(query.Get("page"))
	if page < 1 {
		page = 1
	}

	pageSize, _ := strconv.Atoi(query.Get("pageSize"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	planFilter := strings.TrimSpace(query.Get("plan"))
	statusFilter := strings.TrimSpace(query.Get("status"))
	searchQuery := strings.TrimSpace(query.Get("search"))

	offset := (page - 1) * pageSize

	// Build query with filters
	whereClause := "WHERE 1=1"
	args := []interface{}{}
	argIndex := 1

	if planFilter != "" {
		whereClause += fmt.Sprintf(" AND \"planName\" = $%d", argIndex)
		args = append(args, planFilter)
		argIndex++
	}

	if statusFilter != "" {
		whereClause += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, statusFilter)
		argIndex++
	}

	if searchQuery != "" {
		whereClause += fmt.Sprintf(" AND (user_email ILIKE $%d OR user_name ILIKE $%d)", argIndex, argIndex)
		args = append(args, "%"+searchQuery+"%")
		argIndex++
	}

	// Get total count
	// Note: Using console_subscriptions_with_users view (created in migration 006)
	// This is part of Console's hybrid data access pattern - see CONSOLE_DATA_ACCESS_EVALUATION.md
	var totalCount int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM console_subscriptions_with_users
		%s
	`, whereClause)

	err := h.DB.QueryRow(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to count subscriptions: %v", err), http.StatusInternalServerError)
		return
	}

	// Get subscriptions with pagination
	listQuery := fmt.Sprintf(`
		SELECT
			id,
			"userId",
			"planName",
			status,
			"currentPeriodEnd",
			subscription_created_at,
			subscription_updated_at,
			user_email,
			user_name
		FROM console_subscriptions_with_users
		%s
		ORDER BY subscription_created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIndex, argIndex+1)

	args = append(args, pageSize, offset)

	rows, err := h.DB.Query(ctx, listQuery, args...)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to query subscriptions: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []SubscriptionWithUser{}
	for rows.Next() {
		var item SubscriptionWithUser
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.PlanName,
			&item.Status,
			&item.CurrentPeriodEnd,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.UserEmail,
			&item.UserName,
		)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to scan subscription: %v", err), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}

	response := ListSubscriptionsResponse{
		Items:      items,
		TotalCount: totalCount,
		Page:       page,
		PageSize:   pageSize,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// getSubscription handles GET /api/v1/console/subscriptions/{id}
// BE-081: 实现订阅详情查询
func (h *Handler) getSubscription(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract subscription ID from URL path
	subscriptionID := extractIDFromPath(r.URL.Path, "/api/v1/console/subscriptions/")
	if subscriptionID == "" {
		http.Error(w, "Subscription ID is required", http.StatusBadRequest)
		return
	}

	var sub SubscriptionWithUser
	query := `
		SELECT
			s.id,
			s."userId",
			s."planName",
			s.status,
			s."currentPeriodEnd",
			s."createdAt",
			s."updatedAt",
			u.email,
			u.name
		FROM "Subscription" s
		LEFT JOIN "User" u ON s."userId" = u.id
		WHERE s.id = $1
	`

	err := h.DB.QueryRow(ctx, query, subscriptionID).Scan(
		&sub.ID,
		&sub.UserID,
		&sub.PlanName,
		&sub.Status,
		&sub.CurrentPeriodEnd,
		&sub.CreatedAt,
		&sub.UpdatedAt,
		&sub.UserEmail,
		&sub.UserName,
	)

	if err != nil {
		if err.Error() == "no rows in result set" {
			http.Error(w, "Subscription not found", http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf("Failed to get subscription: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sub)
}

// adjustSubscription handles PUT /api/v1/console/subscriptions/{id}/adjust
// BE-082: 实现手动调整套餐
func (h *Handler) adjustSubscription(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract subscription ID from URL path
	subscriptionID := extractIDFromPath(r.URL.Path, "/api/v1/console/subscriptions/")
	if subscriptionID == "" {
		http.Error(w, "Subscription ID is required", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req AdjustSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Validate plan name
	req.PlanName = strings.ToLower(strings.TrimSpace(req.PlanName))
	validPlans := map[string]bool{
		"starter": true,
		"pro":     true,
		"elite":   true,
	}
	if req.PlanName != "" && !validPlans[req.PlanName] {
		http.Error(w, "Invalid plan name. Must be one of: starter, pro, elite", http.StatusBadRequest)
		return
	}

	// Validate status if provided
	if req.Status != "" {
		req.Status = strings.ToLower(strings.TrimSpace(req.Status))
		validStatuses := map[string]bool{
			"active":   true,
			"inactive": true,
			"canceled": true,
			"trialing": true,
		}
		if !validStatuses[req.Status] {
			http.Error(w, "Invalid status. Must be one of: active, inactive, canceled, trialing", http.StatusBadRequest)
			return
		}
	}

	// Get current subscription
	var userID string
	var currentPlanName string
	var currentStatus string
	var currentPeriodEnd *time.Time

	query := `SELECT "userId", "planName", status, "currentPeriodEnd" FROM "Subscription" WHERE id = $1`
	err := h.DB.QueryRow(ctx, query, subscriptionID).Scan(&userID, &currentPlanName, &currentStatus, &currentPeriodEnd)
	if err != nil {
		if err.Error() == "no rows in result set" {
			http.Error(w, "Subscription not found", http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf("Failed to get subscription: %v", err), http.StatusInternalServerError)
		return
	}

	// Prepare update
	updates := []string{}
	args := []interface{}{}
	argIndex := 1

	if req.PlanName != "" {
		updates = append(updates, fmt.Sprintf("\"planName\" = $%d", argIndex))
		args = append(args, req.PlanName)
		argIndex++
	}

	if req.Status != "" {
		updates = append(updates, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, req.Status)
		argIndex++
	}

	if req.Days > 0 {
		// Extend subscription period
		if currentPeriodEnd == nil {
			// If no current period end, start from now
			newPeriodEnd := time.Now().AddDate(0, 0, req.Days)
			updates = append(updates, fmt.Sprintf("\"currentPeriodEnd\" = $%d", argIndex))
			args = append(args, newPeriodEnd)
		} else {
			// Extend from current period end
			newPeriodEnd := currentPeriodEnd.AddDate(0, 0, req.Days)
			updates = append(updates, fmt.Sprintf("\"currentPeriodEnd\" = $%d", argIndex))
			args = append(args, newPeriodEnd)
		}
		argIndex++
	}

	if len(updates) == 0 {
		http.Error(w, "No updates specified", http.StatusBadRequest)
		return
	}

	// Always update updatedAt
	updates = append(updates, fmt.Sprintf("\"updatedAt\" = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	// Add subscription ID as last argument
	args = append(args, subscriptionID)

	// Execute update
	updateQuery := fmt.Sprintf(`
		UPDATE "Subscription"
		SET %s
		WHERE id = $%d
	`, strings.Join(updates, ", "), argIndex)

	_, err = h.DB.Exec(ctx, updateQuery, args...)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to update subscription: %v", err), http.StatusInternalServerError)
		return
	}

	// Return updated subscription
	var updated SubscriptionWithUser
	selectQuery := `
		SELECT
			s.id,
			s."userId",
			s."planName",
			s.status,
			s."currentPeriodEnd",
			s."createdAt",
			s."updatedAt",
			u.email,
			u.name
		FROM "Subscription" s
		LEFT JOIN "User" u ON s."userId" = u.id
		WHERE s.id = $1
	`

	err = h.DB.QueryRow(ctx, selectQuery, subscriptionID).Scan(
		&updated.ID,
		&updated.UserID,
		&updated.PlanName,
		&updated.Status,
		&updated.CurrentPeriodEnd,
		&updated.CreatedAt,
		&updated.UpdatedAt,
		&updated.UserEmail,
		&updated.UserName,
	)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get updated subscription: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// getSubscriptionStats handles GET /api/v1/console/subscriptions/stats
// Returns overall subscription statistics by plan
func (h *Handler) getSubscriptionStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get subscription statistics by plan
	var totalSubscriptions, activeSubscriptions, trialingSubscriptions, canceledSubscriptions int

	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Subscription"`).Scan(&totalSubscriptions)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Subscription" WHERE status = 'active'`).Scan(&activeSubscriptions)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Subscription" WHERE status = 'trialing'`).Scan(&trialingSubscriptions)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Subscription" WHERE status = 'canceled'`).Scan(&canceledSubscriptions)

	// Get subscription counts by plan
	type PlanCount struct {
		PlanName string `json:"planName"`
		Count    int    `json:"count"`
	}

	planCounts := []PlanCount{}
	rows, err := h.DB.Query(ctx, `
		SELECT "planName", COUNT(*) as count
		FROM "Subscription"
		WHERE status = 'active'
		GROUP BY "planName"
		ORDER BY count DESC
	`)

	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var pc PlanCount
			rows.Scan(&pc.PlanName, &pc.Count)
			planCounts = append(planCounts, pc)
		}
	}

	// Get recent subscriptions (last 7 days)
	var recentSubscriptions int
	h.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM "Subscription"
		WHERE "createdAt" >= NOW() - INTERVAL '7 days'
	`).Scan(&recentSubscriptions)

	// Get expiring soon subscriptions (next 7 days)
	var expiringSoon int
	h.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM "Subscription"
		WHERE status = 'active'
		AND "currentPeriodEnd" IS NOT NULL
		AND "currentPeriodEnd" <= NOW() + INTERVAL '7 days'
		AND "currentPeriodEnd" >= NOW()
	`).Scan(&expiringSoon)

	// Get subscription growth trend (last 30 days, grouped by day)
	type DataPoint struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}

	growthTrend := []DataPoint{}
	trendRows, err := h.DB.Query(ctx, `
		SELECT DATE("createdAt") as date, COUNT(*) as count
		FROM "Subscription"
		WHERE "createdAt" >= NOW() - INTERVAL '30 days'
		GROUP BY DATE("createdAt")
		ORDER BY date ASC
	`)

	if err == nil {
		defer trendRows.Close()
		for trendRows.Next() {
			var dp DataPoint
			trendRows.Scan(&dp.Date, &dp.Count)
			growthTrend = append(growthTrend, dp)
		}
	}

	stats := map[string]interface{}{
		"totalSubscriptions":    totalSubscriptions,
		"activeSubscriptions":   activeSubscriptions,
		"trialingSubscriptions": trialingSubscriptions,
		"canceledSubscriptions": canceledSubscriptions,
		"recentSubscriptions":   recentSubscriptions,
		"expiringSoon":          expiringSoon,
		"planCounts":            planCounts,
		"growthTrend":           growthTrend,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// subscriptionsTree handles subscription sub-routes
func (h *Handler) subscriptionsTree(w http.ResponseWriter, r *http.Request) {
	// Extract subscription ID and action from path
	// Format: /api/v1/console/subscriptions/{id} or /api/v1/console/subscriptions/{id}/adjust or /api/v1/console/subscriptions/stats
	path := r.URL.Path
	prefix := "/api/v1/console/subscriptions/"

	if !strings.HasPrefix(path, prefix) {
		http.NotFound(w, r)
		return
	}

	remainder := strings.TrimPrefix(path, prefix)
	parts := strings.Split(remainder, "/")

	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	// Check if first part is "stats"
	if parts[0] == "stats" {
		if r.Method == http.MethodGet {
			h.getSubscriptionStats(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	// Check if there's an action
	if len(parts) >= 2 {
		action := strings.TrimSpace(parts[1])

		switch action {
		case "adjust":
			if r.Method == http.MethodPut {
				h.adjustSubscription(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		default:
			http.NotFound(w, r)
			return
		}
	}

	// No action, just subscription ID
	if r.Method == http.MethodGet {
		h.getSubscription(w, r)
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// extractIDFromPath extracts ID from URL path
func extractIDFromPath(path, prefix string) string {
	if !strings.HasPrefix(path, prefix) {
		return ""
	}

	remainder := strings.TrimPrefix(path, prefix)
	parts := strings.Split(remainder, "/")
	if len(parts) == 0 {
		return ""
	}

	return strings.TrimSpace(parts[0])
}
