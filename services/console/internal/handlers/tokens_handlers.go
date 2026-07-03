package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/errors"
	"github.com/jackc/pgx/v5"
)

// getTokenStats returns aggregate stats for tokens across users.
// GET /api/v1/console/tokens/stats
//
// Note: This is a read-only aggregation query for admin dashboard.
// Console uses hybrid data access pattern:
//   - Read-only aggregation: Direct SQL (for performance)
//   - Write operations: Service API (for business logic)
//
// Dependencies: Reads from Billing service's UserToken table
func (h *Handler) getTokenStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	var count int64
	var sum int64
	if err := h.DB.QueryRow(r.Context(), `SELECT COUNT(*), COALESCE(SUM(balance),0) FROM "UserToken"`).Scan(&count, &sum); err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"users": count, "totalTokens": sum})
}

// getAdminStats returns aggregated counters for admin dashboard.
// GET /api/v1/console/stats
//
// Note: Cross-service aggregation query for admin metrics.
// Dependencies:
//   - User table (shared)
//   - Offer table (offer service)
//   - Subscription table (billing service)
//   - UserToken table (billing service)
//   - user_notifications table (notifications service)
//   - SiterankHistory table (siterank service)
//   - BatchopenTask table (batchopen service)
//
// This is acceptable for Console's hybrid data access pattern:
// read-only aggregation for performance. See docs/architecture/CONSOLE_DATA_ACCESS_EVALUATION.md
func (h *Handler) getAdminStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	ctx := r.Context()
	q := func(sql string, args ...any) (int64, error) {
		var n int64
		err := h.DB.QueryRow(ctx, sql, args...).Scan(&n)
		return n, err
	}
	// Collect metrics; tolerate missing tables by returning -1 on error
	counters := map[string]int64{}
	try := func(key, sql string) {
		if n, err := q(sql); err == nil {
			counters[key] = n
		} else {
			counters[key] = -1
		}
	}
	try("users", `SELECT COUNT(1) FROM "User"`)
	try("offers", `SELECT COUNT(1) FROM "Offer"`)
	try("subscriptionsActive", `SELECT COUNT(1) FROM "Subscription" WHERE status='active'`)
	try("tokensTotal", `SELECT COALESCE(SUM(balance),0) FROM "UserToken"`)
	try("notifications24h", `SELECT COUNT(1) FROM user_notifications WHERE created_at > NOW() - interval '24 hours'`)
	// Optional tables (if exist)
	try("siterankAnalyses", `SELECT COUNT(1) FROM "SiterankHistory"`)
	try("batchopenTasks", `SELECT COUNT(1) FROM "BatchopenTask"`)
	try("events", `SELECT COUNT(1) FROM event_store`)

	out := map[string]any{
		"counters":  counters,
		"updatedAt": time.Now().UTC().Format(time.RFC3339),
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

// getTokenBalances returns a paginated list of user token balances
// GET /api/v1/console/tokens/balances?page=1&pageSize=20&search=user@example.com
func (h *Handler) getTokenBalances(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}

	// 解析查询参数
	page := 1
	if v := r.URL.Query().Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			page = n
		}
	}

	pageSize := 20
	if v := r.URL.Query().Get("pageSize"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			pageSize = n
		}
	}

	search := strings.TrimSpace(r.URL.Query().Get("search"))
	offset := (page - 1) * pageSize

	// 查询用户余额
	var rows pgx.Rows
	var err error
	var totalCount int

	// 构建查询
	if search != "" {
		// 先查询总数
		searchPattern := "%" + search + "%"
		err = h.DB.QueryRow(r.Context(), `
            SELECT COUNT(*)
            FROM "UserToken" ut
            LEFT JOIN "User" u ON u.id = ut."userId"
            WHERE ut."userId" ILIKE $1 OR u.email ILIKE $1
        `, searchPattern).Scan(&totalCount)
		if err != nil {
			errors.Write(w, r, http.StatusInternalServerError, "QUERY_ERROR", "Failed to count balances", map[string]string{"error": err.Error()})
			return
		}

		// 查询数据
		rows, err = h.DB.Query(r.Context(), `
            SELECT
                ut."userId",
                COALESCE(u.email, ''),
                ut.balance,
                0 as consumed,
                ut."updatedAt"
            FROM "UserToken" ut
            LEFT JOIN "User" u ON u.id = ut."userId"
            WHERE ut."userId" ILIKE $1 OR u.email ILIKE $1
            ORDER BY ut.balance DESC
            LIMIT $2 OFFSET $3
        `, searchPattern, pageSize, offset)
	} else {
		// 先查询总数
		err = h.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM "UserToken"`).Scan(&totalCount)
		if err != nil {
			errors.Write(w, r, http.StatusInternalServerError, "QUERY_ERROR", "Failed to count balances", map[string]string{"error": err.Error()})
			return
		}

		// 查询数据
		rows, err = h.DB.Query(r.Context(), `
            SELECT
                ut."userId",
                COALESCE(u.email, ''),
                ut.balance,
                0 as consumed,
                ut."updatedAt"
            FROM "UserToken" ut
            LEFT JOIN "User" u ON u.id = ut."userId"
            ORDER BY ut.balance DESC
            LIMIT $1 OFFSET $2
        `, pageSize, offset)
	}

	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "QUERY_ERROR", "Failed to query balances", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	type UserBalance struct {
		UserID    string    `json:"userId"`
		Email     string    `json:"email,omitempty"`
		Balance   int64     `json:"balance"`
		Consumed  int64     `json:"consumed,omitempty"`
		UpdatedAt time.Time `json:"updatedAt"`
	}

	var balances []UserBalance
	for rows.Next() {
		var balance UserBalance
		if err := rows.Scan(&balance.UserID, &balance.Email, &balance.Balance, &balance.Consumed, &balance.UpdatedAt); err != nil {
			log.Printf("[console] scan balance row failed: %v", err)
			continue
		}
		balances = append(balances, balance)
	}

	if balances == nil {
		balances = []UserBalance{}
	}

	totalPages := (totalCount + pageSize - 1) / pageSize

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"balances":   balances,
		"totalPages": totalPages,
		"totalCount": totalCount,
	})
}
