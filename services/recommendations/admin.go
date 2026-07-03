package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	apperr "github.com/ScientificInternet/Google-Monetize/pkg/errors"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"net/http"
	"strings"
)

// GET /api/v1/recommend/brand-coverage/admin/users?limit=50
func (s *Server) listCoverageUsersHandler(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if strings.TrimSpace(uid) == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	if s.adapter == nil {
		apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "db not configured", nil)
		return
	}
	limit := 50
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		var n int
		_, _ = fmt.Sscanf(v, "%d", &n)
		if n > 0 && n <= 500 {
			limit = n
		}
	}
	// Users from AdsAccountMetrics (user_id, customer_id) - use read replica
	rows, err := s.adapter.Secondary().GetDB().QueryContext(r.Context(), `SELECT DISTINCT user_id FROM "AdsAccountMetrics" ORDER BY user_id ASC LIMIT $1`, limit)
	if err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	arr := []string{}
	for rows.Next() {
		var u string
		if rows.Scan(&u) == nil && strings.TrimSpace(u) != "" {
			arr = append(arr, u)
		}
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"items": arr})
}

// GET /api/v1/recommend/brand-coverage/admin/list?userId=xxx&limit=200
func (s *Server) listCoverageByUserHandler(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if strings.TrimSpace(uid) == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	if s.adapter == nil {
		apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "db not configured", nil)
		return
	}
	user := strings.TrimSpace(r.URL.Query().Get("userId"))
	if user == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "userId required", nil)
		return
	}
	limit := 200
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		var n int
		_, _ = fmt.Sscanf(v, "%d", &n)
		if n > 0 && n <= 1000 {
			limit = n
		}
	}
	// Join coverage table and account metrics to resolve user ownership - use read replica
	q := `
    SELECT c.seed_domain, c.account_id, c.total_keywords, c.brand_keywords, c.coverage_ratio, c.missing_aliases::text, c.updated_at
    FROM brand_coverage_results c
    JOIN "AdsAccountMetrics" m ON m.customer_id = c.account_id
    WHERE m.user_id=$1
    ORDER BY c.updated_at DESC NULLS LAST
    LIMIT $2`
	rows, err := s.adapter.Secondary().GetDB().QueryContext(r.Context(), q, user, limit)
	if err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	type item struct {
		SeedDomain, AccountId string
		Total, Brand          int
		Ratio                 float64
		Missing               json.RawMessage
		UpdatedAt             sql.NullTime
	}
	out := []map[string]any{}
	for rows.Next() {
		var it item
		if rows.Scan(&it.SeedDomain, &it.AccountId, &it.Total, &it.Brand, &it.Ratio, &it.Missing, &it.UpdatedAt) == nil {
			m := map[string]any{
				"seedDomain": it.SeedDomain, "accountId": it.AccountId,
				"totalKeywords": it.Total, "brandKeywords": it.Brand,
				"coverageRatio": it.Ratio,
			}
			if len(it.Missing) > 0 {
				m["missingAliases"] = json.RawMessage(it.Missing)
			}
			if it.UpdatedAt.Valid {
				m["updatedAt"] = it.UpdatedAt.Time
			}
			out = append(out, m)
		}
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"items": out})
}
