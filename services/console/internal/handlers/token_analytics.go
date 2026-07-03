package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

// TokenConsumptionTrend represents token consumption over time
type TokenConsumptionTrend struct {
	Date      string `json:"date"`
	Consumed  int64  `json:"consumed"`
	UserCount int    `json:"userCount"`
	TaskCount int    `json:"taskCount"`
}

// TokenTrendResponse represents trend data response
type TokenTrendResponse struct {
	Trends        []TokenConsumptionTrend `json:"trends"`
	TotalConsumed int64                   `json:"totalConsumed"`
	Period        string                  `json:"period"`
	UpdatedAt     string                  `json:"updatedAt"`
}

// TopTokenConsumer represents a user's token consumption
type TopTokenConsumer struct {
	UserID        string  `json:"userId"`
	UserEmail     string  `json:"userEmail"`
	TotalConsumed int64   `json:"totalConsumed"`
	TaskCount     int     `json:"taskCount"`
	AvgPerTask    float64 `json:"avgPerTask"`
	LastActivity  string  `json:"lastActivity"`
}

// TopConsumersResponse represents top consumers response
type TopConsumersResponse struct {
	Consumers []TopTokenConsumer `json:"consumers"`
	Total     int                `json:"total"`
	UpdatedAt string             `json:"updatedAt"`
}

// getTokenConsumptionTrend returns token consumption trend data
func (h *Handler) getTokenConsumptionTrend(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse period parameter (7, 30, 90 days)
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days <= 0 || days > 90 {
		days = 7
	}

	// Calculate date range
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -days)

	// Query daily consumption from tasks table
	query := `
		WITH daily_stats AS (
			SELECT
				DATE(created_at) as date,
				SUM(tokens_consumed) as consumed,
				COUNT(DISTINCT user_id) as user_count,
				COUNT(*) as task_count
			FROM tasks
			WHERE created_at >= $1 AND created_at <= $2
			GROUP BY DATE(created_at)
			ORDER BY date ASC
		)
		SELECT
			date::text,
			COALESCE(consumed, 0) as consumed,
			COALESCE(user_count, 0) as user_count,
			COALESCE(task_count, 0) as task_count
		FROM daily_stats
	`

	rows, err := h.DB.Query(ctx, query, startDate, endDate)
	if err != nil {
		// Return empty trend if query fails
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(TokenTrendResponse{
			Trends:        []TokenConsumptionTrend{},
			TotalConsumed: 0,
			Period:        strconv.Itoa(days) + " days",
			UpdatedAt:     time.Now().Format(time.RFC3339),
		})
		return
	}
	defer rows.Close()

	trends := []TokenConsumptionTrend{}
	var totalConsumed int64

	for rows.Next() {
		var trend TokenConsumptionTrend
		err := rows.Scan(
			&trend.Date,
			&trend.Consumed,
			&trend.UserCount,
			&trend.TaskCount,
		)
		if err != nil {
			continue
		}
		trends = append(trends, trend)
		totalConsumed += trend.Consumed
	}

	response := TokenTrendResponse{
		Trends:        trends,
		TotalConsumed: totalConsumed,
		Period:        strconv.Itoa(days) + " days",
		UpdatedAt:     time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// getTopTokenConsumers returns top token consumers
func (h *Handler) getTopTokenConsumers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse limit parameter
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	// Parse period parameter (7, 30, 90 days, or "all")
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30"
	}

	var whereClause string
	if period != "all" {
		days, _ := strconv.Atoi(period)
		if days > 0 {
			startDate := time.Now().AddDate(0, 0, -days)
			whereClause = "WHERE t.created_at >= '" + startDate.Format("2006-01-02") + "'"
		}
	}

	// Query top consumers
	query := `
		WITH user_consumption AS (
			SELECT
				t.user_id,
				SUM(t.tokens_consumed) as total_consumed,
				COUNT(*) as task_count,
				MAX(t.created_at) as last_activity
			FROM tasks t
			` + whereClause + `
			GROUP BY t.user_id
			ORDER BY total_consumed DESC
			LIMIT $1
		)
		SELECT
			uc.user_id,
			COALESCE(u.email, 'unknown') as user_email,
			uc.total_consumed,
			uc.task_count,
			CASE WHEN uc.task_count > 0 THEN uc.total_consumed::float / uc.task_count ELSE 0 END as avg_per_task,
			uc.last_activity
		FROM user_consumption uc
		LEFT JOIN users u ON uc.user_id = u.id
		ORDER BY uc.total_consumed DESC
	`

	rows, err := h.DB.Query(ctx, query, limit)
	if err != nil {
		// Return empty list if query fails
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(TopConsumersResponse{
			Consumers: []TopTokenConsumer{},
			Total:     0,
			UpdatedAt: time.Now().Format(time.RFC3339),
		})
		return
	}
	defer rows.Close()

	consumers := []TopTokenConsumer{}

	for rows.Next() {
		var consumer TopTokenConsumer
		var lastActivity time.Time

		err := rows.Scan(
			&consumer.UserID,
			&consumer.UserEmail,
			&consumer.TotalConsumed,
			&consumer.TaskCount,
			&consumer.AvgPerTask,
			&lastActivity,
		)
		if err != nil {
			continue
		}

		consumer.LastActivity = lastActivity.Format(time.RFC3339)
		consumers = append(consumers, consumer)
	}

	response := TopConsumersResponse{
		Consumers: consumers,
		Total:     len(consumers),
		UpdatedAt: time.Now().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
