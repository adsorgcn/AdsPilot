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

// ========================================
// 用户管理 Handler Methods
// ========================================

// getUsers returns a paginated list of users with optional filtering by query and role.
// GET /api/v1/console/users?q=search&role=ADMIN&limit=50&offset=0
func (h *Handler) getUsers(w http.ResponseWriter, r *http.Request) {
	// DDL operations removed - use db-admin migrations instead
	// Table existence should be verified through proper migration process
	// In a real app, this handler would be protected by an admin-only middleware.
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}

	q := r.URL.Query().Get("q")
	role := strings.TrimSpace(r.URL.Query().Get("role"))
	limit := 50
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	var rows pgx.Rows
	var err error
	if q != "" && role != "" {
		pattern := "%" + q + "%"
		rows, err = h.DB.Query(r.Context(), `SELECT id, COALESCE(email,''), COALESCE(name,''), COALESCE(role,''), COALESCE("createdAt", NOW()) FROM "User" WHERE (email ILIKE $1 OR name ILIKE $1) AND role=$2 ORDER BY COALESCE("createdAt", NOW()) DESC LIMIT $3 OFFSET $4`, pattern, role, limit, offset)
	} else if q != "" {
		pattern := "%" + q + "%"
		rows, err = h.DB.Query(r.Context(), `SELECT id, COALESCE(email,''), COALESCE(name,''), COALESCE(role,''), COALESCE("createdAt", NOW()) FROM "User" WHERE email ILIKE $1 OR name ILIKE $1 ORDER BY COALESCE("createdAt", NOW()) DESC LIMIT $2 OFFSET $3`, pattern, limit, offset)
	} else if role != "" {
		rows, err = h.DB.Query(r.Context(), `SELECT id, COALESCE(email,''), COALESCE(name,''), COALESCE(role,''), COALESCE("createdAt", NOW()) FROM "User" WHERE role=$1 ORDER BY COALESCE("createdAt", NOW()) DESC LIMIT $2 OFFSET $3`, role, limit, offset)
	} else {
		rows, err = h.DB.Query(r.Context(), `SELECT id, COALESCE(email,''), COALESCE(name,''), COALESCE(role,''), COALESCE("createdAt", NOW()) FROM "User" ORDER BY COALESCE("createdAt", NOW()) DESC LIMIT $1 OFFSET $2`, limit, offset)
	}
	if err != nil {
		log.Printf("[console] users list query failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"items": []User{}, "limit": limit, "offset": offset, "query": q, "role": role, "warning": "users_query_failed"})
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.CreatedAt); err != nil {
			log.Printf("[console] scan user row failed: %v", err)
			continue
		}
		users = append(users, u)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"items": users, "limit": limit, "offset": offset, "query": q, "role": role})
}

// usersTree handles user detail endpoints and sub-resources.
// GET /api/v1/console/users/{id} - Get user detail
// GET /api/v1/console/users/{id}/tokens - Get user balance and transactions
// GET /api/v1/console/users/{id}/subscription - Get user subscription
// PUT /api/v1/console/users/{id}/subscription - Update user subscription
// POST /api/v1/console/users/{id}/tokens - Add tokens to user balance
func (h *Handler) usersTree(w http.ResponseWriter, r *http.Request) {
	// DDL operations removed - use db-admin migrations instead
	// Table existence should be verified through proper migration process
	const prefix = "/api/v1/console/users/"
	if len(r.URL.Path) <= len(prefix) {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "user id required", nil)
		return
	}
	rest := r.URL.Path[len(prefix):] // {id} or {id}/tokens or {id}/subscription
	// split
	uid := rest
	sub := ""
	for i := 0; i < len(rest); i++ {
		if rest[i] == '/' {
			uid = rest[:i]
			if i+1 < len(rest) {
				sub = rest[i+1:]
			} else {
				sub = ""
			}
			break
		}
	}
	if uid == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "user id required", nil)
		return
	}
	switch r.Method {
	case http.MethodGet:
		switch sub {
		case "", "/":
			var user struct {
				ID, Email, Name, Role string
				CreatedAt             time.Time
			}
			err := h.DB.QueryRow(r.Context(), `SELECT id, email, name, role, "createdAt" FROM "User" WHERE id=$1`, uid).
				Scan(&user.ID, &user.Email, &user.Name, &user.Role, &user.CreatedAt)
			if err != nil {
				errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "user not found", nil)
				return
			}
			_ = json.NewEncoder(w).Encode(user)
			return
		case "tokens":
			// return balance + last N transactions (default 10)
			limit := 10
			if v := r.URL.Query().Get("limit"); v != "" {
				if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
					limit = n
				}
			}
			// DDL operations removed - use db-admin migrations instead
			// TokenTransaction table should be created through proper migration process
			var balance int64
			_ = h.DB.QueryRow(r.Context(), `SELECT balance FROM "UserToken" WHERE "userId"=$1`, uid).Scan(&balance)
			rows, err := h.DB.Query(r.Context(), `
                SELECT id, type, amount, "balanceBefore", "balanceAfter", source, description, "createdAt"
                FROM "TokenTransaction"
                WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT $2`, uid, limit)
			if err != nil {
				errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", nil)
				return
			}
			defer rows.Close()
			type tx struct {
				ID, Type                    string
				Amount                      int
				BalanceBefore, BalanceAfter int64
				Source, Description         string
				CreatedAt                   time.Time
			}
			list := make([]tx, 0, limit)
			for rows.Next() {
				var t tx
				if err := rows.Scan(&t.ID, &t.Type, &t.Amount, &t.BalanceBefore, &t.BalanceAfter, &t.Source, &t.Description, &t.CreatedAt); err == nil {
					list = append(list, t)
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"balance": balance, "items": list})
			return
		case "subscription":
			var subRow struct {
				ID, PlanName, Status string
				TrialEndsAt          *time.Time
				CurrentPeriodEnd     time.Time
			}
			err := h.DB.QueryRow(r.Context(), `SELECT id, "planName", status, "trialEndsAt", "currentPeriodEnd" FROM "Subscription" WHERE "userId"=$1`, uid).
				Scan(&subRow.ID, &subRow.PlanName, &subRow.Status, &subRow.TrialEndsAt, &subRow.CurrentPeriodEnd)
			if err != nil {
				errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "subscription not found", nil)
				return
			}
			_ = json.NewEncoder(w).Encode(subRow)
			return
		case "role":
			if r.Method != http.MethodPut {
				errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
				return
			}
			var body struct {
				Role string `json:"role"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
				return
			}
			role := strings.ToUpper(strings.TrimSpace(body.Role))
			if role != "ADMIN" && role != "USER" {
				errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "role must be ADMIN or USER", nil)
				return
			}
			if _, err := h.DB.Exec(r.Context(), `UPDATE "User" SET role=$1 WHERE id=$2`, role, uid); err != nil {
				errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update failed", nil)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "userId": uid, "role": role})
			return
		default:
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported subresource", nil)
			return
		}
	case http.MethodPut:
		switch sub {
		case "subscription":
			// This endpoint has been migrated to /api/v1/billing/subscriptions/{userId}
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND",
				"This endpoint has been migrated to billing service",
				map[string]string{
					"new_endpoint": "/api/v1/billing/subscriptions/{userId}",
					"service":      "billing",
				})
			return
		default:
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported subresource", nil)
			return
		}
	case http.MethodPost:
		if sub == "tokens" {
			// This endpoint has been migrated to /api/v1/billing/tokens/topup
			errors.Write(w, r, http.StatusNotFound, "NOT_FOUND",
				"This endpoint has been migrated to billing service",
				map[string]string{
					"new_endpoint": "/api/v1/billing/tokens/topup",
					"service":      "billing",
				})
			return
		}
		errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "unsupported action", nil)
		return
	default:
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
}
