package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	"github.com/ScientificInternet/Google-Monetize/pkg/pagination"
)

// TaskStats represents task statistics
type TaskStats struct {
	Total            int     `json:"total"`
	Pending          int     `json:"pending"`
	Running          int     `json:"running"`
	Completed        int     `json:"completed"`
	Failed           int     `json:"failed"`
	Cancelled        int     `json:"cancelled"`
	TokensConsumed   int64   `json:"tokensConsumed"`
	AvgTokensPerTask float64 `json:"avgTokensPerTask"`
}

// Task represents a task entity for admin view
type Task struct {
	ID              string  `json:"id"`
	UserID          string  `json:"userId"`
	OrganizationID  string  `json:"organizationId"`
	Type            string  `json:"type"`
	Status          string  `json:"status"`
	OfferID         *string `json:"offerId,omitempty"`
	OfferURL        *string `json:"offerUrl,omitempty"`
	AdsAccountID    *string `json:"adsAccountId,omitempty"`
	Progress        *int    `json:"progress,omitempty"`
	CurrentStep     *string `json:"currentStep,omitempty"`
	TokensConsumed  int64   `json:"tokensConsumed"`
	EstimatedTokens *int64  `json:"estimatedTokens,omitempty"`
	Error           *string `json:"error,omitempty"`
	CreatedAt       string  `json:"createdAt"`
	StartedAt       *string `json:"startedAt,omitempty"`
	CompletedAt     *string `json:"completedAt,omitempty"`
	UpdatedAt       string  `json:"updatedAt"`
}

// TasksListResponse represents paginated tasks response
type TasksListResponse struct {
	Items      []Task `json:"items"`
	Total      int    `json:"total"`
	Page       int    `json:"page"`
	Limit      int    `json:"limit"`
	TotalPages int    `json:"totalPages"`
}

// getTaskStats returns task statistics for admin
func (h *Handler) getTaskStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	query := `
		SELECT
			COUNT(*) as total,
			SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
			SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
			SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
			SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
			SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
			COALESCE(SUM(tokens_consumed), 0) as tokens_consumed,
			CASE
				WHEN COUNT(*) > 0 THEN COALESCE(SUM(tokens_consumed), 0)::float / COUNT(*)
				ELSE 0
			END as avg_tokens_per_task
		FROM tasks
	`

	var stats TaskStats
	err := h.DB.QueryRow(ctx, query).Scan(
		&stats.Total,
		&stats.Pending,
		&stats.Running,
		&stats.Completed,
		&stats.Failed,
		&stats.Cancelled,
		&stats.TokensConsumed,
		&stats.AvgTokensPerTask,
	)
	if err != nil {
		slog.Error("Failed to get task stats", "error", err)
		apiErr := apierrors.InternalError("无法获取任务统计")
		apiErr.WriteJSON(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// getTasks returns paginated list of tasks with filters
func (h *Handler) getTasks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse pagination parameters using standard parser
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	limit, offset = pagination.ParseParams(limit, offset)

	typeFilter := r.URL.Query().Get("type")
	statusFilter := r.URL.Query().Get("status")
	userIDFilter := r.URL.Query().Get("userId")
	orgIDFilter := r.URL.Query().Get("organizationId")
	sortBy := r.URL.Query().Get("sortBy")
	sortOrder := r.URL.Query().Get("sortOrder")

	if sortBy == "" {
		sortBy = "created_at"
	}
	if sortOrder == "" {
		sortOrder = "desc"
	}

	// Build WHERE clause
	whereConditions := []string{}
	args := []interface{}{}
	argCount := 0

	if typeFilter != "" {
		argCount++
		whereConditions = append(whereConditions, "type = $"+strconv.Itoa(argCount))
		args = append(args, typeFilter)
	}

	if statusFilter != "" {
		argCount++
		whereConditions = append(whereConditions, "status = $"+strconv.Itoa(argCount))
		args = append(args, statusFilter)
	}

	if userIDFilter != "" {
		argCount++
		whereConditions = append(whereConditions, "user_id = $"+strconv.Itoa(argCount))
		args = append(args, userIDFilter)
	}

	if orgIDFilter != "" {
		argCount++
		whereConditions = append(whereConditions, "organization_id = $"+strconv.Itoa(argCount))
		args = append(args, orgIDFilter)
	}

	whereClause := ""
	if len(whereConditions) > 0 {
		whereClause = "WHERE " + whereConditions[0]
		for i := 1; i < len(whereConditions); i++ {
			whereClause += " AND " + whereConditions[i]
		}
	}

	// Get total count
	countQuery := "SELECT COUNT(*) FROM tasks " + whereClause
	var total int
	err := h.DB.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		slog.Error("Failed to get tasks count", "error", err)
		apiErr := apierrors.InternalError("无法获取任务数量")
		apiErr.WriteJSON(w, r)
		return
	}

	// Get tasks
	argCount++
	limitArg := "$" + strconv.Itoa(argCount)
	argCount++
	offsetArg := "$" + strconv.Itoa(argCount)

	query := `
		SELECT
			id, user_id, organization_id, type, status,
			offer_id, offer_url, ads_account_id,
			progress, current_step,
			tokens_consumed, estimated_tokens,
			error,
			created_at, started_at, completed_at, updated_at
		FROM tasks
		` + whereClause + `
		ORDER BY ` + sortBy + ` ` + sortOrder + `
		LIMIT ` + limitArg + ` OFFSET ` + offsetArg

	args = append(args, limit, offset)

	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		slog.Error("Failed to query tasks", "error", err)
		apiErr := apierrors.InternalError("无法查询任务列表")
		apiErr.WriteJSON(w, r)
		return
	}
	defer rows.Close()

	tasks := []Task{}
	for rows.Next() {
		var task Task
		err := rows.Scan(
			&task.ID,
			&task.UserID,
			&task.OrganizationID,
			&task.Type,
			&task.Status,
			&task.OfferID,
			&task.OfferURL,
			&task.AdsAccountID,
			&task.Progress,
			&task.CurrentStep,
			&task.TokensConsumed,
			&task.EstimatedTokens,
			&task.Error,
			&task.CreatedAt,
			&task.StartedAt,
			&task.CompletedAt,
			&task.UpdatedAt,
		)
		if err != nil {
			slog.Error("Failed to scan task", "error", err)
			continue
		}
		tasks = append(tasks, task)
	}

	// Use standardized pagination response
	response := pagination.NewPaginatedResponse(tasks, total, limit, offset)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// cancelTask cancels a task (admin action)
func (h *Handler) cancelTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	taskID := r.PathValue("id")

	if taskID == "" {
		apiErr := apierrors.InvalidRequest("id", "任务ID不能为空")
		apiErr.WriteJSON(w, r)
		return
	}

	var payload struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		apiErr := apierrors.InvalidRequest("body", "请求体格式无效")
		apiErr.WriteJSON(w, r)
		return
	}

	if len(payload.Reason) < 10 {
		apiErr := apierrors.InvalidRequest("reason", "取消原因至少需要10个字符")
		apiErr.WriteJSON(w, r)
		return
	}

	// Update task status to cancelled
	query := `
		UPDATE tasks
		SET status = 'cancelled', updated_at = $1
		WHERE id = $2 AND status IN ('pending', 'running')
		RETURNING id
	`

	var updatedID string
	err := h.DB.QueryRow(ctx, query, time.Now(), taskID).Scan(&updatedID)
	if err != nil {
		if err.Error() == "no rows in result set" {
			apiErr := apierrors.New(
				apierrors.CodeTaskInvalidState,
				"任务不存在或无法取消",
				map[string]interface{}{
					"taskId": taskID,
					"reason": "只能取消pending或running状态的任务",
				},
			)
			apiErr.WriteJSON(w, r)
			return
		}
		slog.Error("Failed to cancel task", "error", err, "taskID", taskID)
		apiErr := apierrors.InternalError("取消任务失败")
		apiErr.WriteJSON(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      updatedID,
	})
}

// retryTask retries a failed task (admin action)
func (h *Handler) retryTask(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	taskID := r.PathValue("id")

	if taskID == "" {
		apiErr := apierrors.InvalidRequest("id", "任务ID不能为空")
		apiErr.WriteJSON(w, r)
		return
	}

	// Update task status to pending
	query := `
		UPDATE tasks
		SET
			status = 'pending',
			error = NULL,
			progress = NULL,
			current_step = NULL,
			started_at = NULL,
			completed_at = NULL,
			updated_at = $1
		WHERE id = $2 AND status IN ('failed', 'cancelled')
		RETURNING id
	`

	var updatedID string
	err := h.DB.QueryRow(ctx, query, time.Now(), taskID).Scan(&updatedID)
	if err != nil {
		if err.Error() == "no rows in result set" {
			apiErr := apierrors.New(
				apierrors.CodeTaskInvalidState,
				"任务不存在或无法重试",
				map[string]interface{}{
					"taskId": taskID,
					"reason": "只能重试failed或cancelled状态的任务",
				},
			)
			apiErr.WriteJSON(w, r)
			return
		}
		slog.Error("Failed to retry task", "error", err, "taskID", taskID)
		apiErr := apierrors.InternalError("重试任务失败")
		apiErr.WriteJSON(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      updatedID,
	})
}
