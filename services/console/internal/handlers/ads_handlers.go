package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/services/console/internal/clients"
)

// ListAdsAccountsResponse represents the response for ads accounts list (console version)
type ListAdsAccountsResponse struct {
	Items      []AccountWithUser `json:"items"`
	TotalCount int               `json:"totalCount"`
	Page       int               `json:"page"`
	PageSize   int               `json:"pageSize"`
}

// AccountWithUser extends Account with user info
type AccountWithUser struct {
	clients.Account
	UserEmail string `json:"userEmail,omitempty"`
	UserName  string `json:"userName,omitempty"`
}

// getAdsAccounts handles GET /api/v1/console/ads/accounts
// Admin can list all ads accounts across all users
func (h *Handler) getAdsAccounts(w http.ResponseWriter, r *http.Request) {
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

	platformFilter := strings.TrimSpace(query.Get("platform"))
	statusFilter := strings.TrimSpace(query.Get("status"))
	userIDFilter := strings.TrimSpace(query.Get("userId"))
	searchQuery := strings.TrimSpace(query.Get("search"))

	offset := (page - 1) * pageSize

	// If searching by user, query database first
	if searchQuery != "" {
		// Search by user email/name in database, then fetch accounts
		var userIDs []string
		rows, err := h.DB.Query(ctx, `
			SELECT id FROM "User"
			WHERE email ILIKE $1 OR name ILIKE $1
			LIMIT 100
		`, "%"+searchQuery+"%")

		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to search users: %v", err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		for rows.Next() {
			var userID string
			if err := rows.Scan(&userID); err == nil {
				userIDs = append(userIDs, userID)
			}
		}

		// Fetch accounts for found users
		allAccounts := []AccountWithUser{}
		for _, uid := range userIDs {
			accounts, err := h.ServiceClients.Adscenter.ListAccounts(ctx, clients.ListAccountsRequest{
				UserID:   uid,
				Platform: platformFilter,
				Status:   statusFilter,
				Limit:    pageSize,
				Offset:   0,
			})

			if err != nil {
				continue
			}

			// Get user info
			var userEmail, userName string
			h.DB.QueryRow(ctx, `SELECT email, name FROM "User" WHERE id = $1`, uid).Scan(&userEmail, &userName)

			for _, account := range accounts.Items {
				allAccounts = append(allAccounts, AccountWithUser{
					Account:   account,
					UserEmail: userEmail,
					UserName:  userName,
				})
			}
		}

		response := ListAdsAccountsResponse{
			Items:      allAccounts,
			TotalCount: len(allAccounts),
			Page:       page,
			PageSize:   pageSize,
		}

		// Convert to frontend-expected format
		frontendResponse := map[string]interface{}{
			"items":      response.Items,
			"total":      response.TotalCount, // Map TotalCount -> total
			"totalPages": response.Page,       // Simplified - TODO: calculate actual pages
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(frontendResponse)
		return
	}

	// Get all accounts from database (we need to query User table for enrichment)
	whereClause := "WHERE 1=1"
	args := []interface{}{}
	argIndex := 1

	if platformFilter != "" {
		whereClause += fmt.Sprintf(" AND a.platform = $%d", argIndex)
		args = append(args, platformFilter)
		argIndex++
	}

	if statusFilter != "" {
		whereClause += fmt.Sprintf(" AND a.status = $%d", argIndex)
		args = append(args, statusFilter)
		argIndex++
	}

	if userIDFilter != "" {
		whereClause += fmt.Sprintf(" AND a.user_id = $%d", argIndex)
		args = append(args, userIDFilter)
		argIndex++
	}

	// Get total count from database
	var totalCount int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM ads_accounts a
		%s
	`, whereClause)

	err := h.DB.QueryRow(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to count ads accounts: %v", err), http.StatusInternalServerError)
		return
	}

	// Get accounts with pagination
	listQuery := fmt.Sprintf(`
		SELECT
			a.id,
			a.user_id,
			a.platform,
			a.status,
			a.created_at,
			a.updated_at,
			u.email,
			u.name
		FROM ads_accounts a
		LEFT JOIN "User" u ON a.user_id = u.id
		%s
		ORDER BY a.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIndex, argIndex+1)

	args = append(args, pageSize, offset)

	rows, err := h.DB.Query(ctx, listQuery, args...)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to query ads accounts: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []AccountWithUser{}
	for rows.Next() {
		var item AccountWithUser
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Platform,
			&item.Status,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.UserEmail,
			&item.UserName,
		)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to scan account: %v", err), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}

	response := ListAdsAccountsResponse{
		Items:      items,
		TotalCount: totalCount,
		Page:       page,
		PageSize:   pageSize,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// getAdsAccount handles GET /api/v1/console/ads/accounts/{id}
// Admin can view any ads account details
func (h *Handler) getAdsAccount(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract account ID from URL path
	accountID := extractIDFromPath(r.URL.Path, "/api/v1/console/ads/accounts/")
	if accountID == "" {
		http.Error(w, "Account ID is required", http.StatusBadRequest)
		return
	}

	// Get account from Adscenter service
	account, err := h.ServiceClients.Adscenter.GetAccount(ctx, accountID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get account: %v", err), http.StatusInternalServerError)
		return
	}

	// Enrich with user info
	var userEmail, userName string
	h.DB.QueryRow(ctx, `SELECT email, name FROM "User" WHERE id = $1`, account.UserID).Scan(&userEmail, &userName)

	response := AccountWithUser{
		Account:   *account,
		UserEmail: userEmail,
		UserName:  userName,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// getAdsAccountStats handles GET /api/v1/console/ads/stats
// Returns overall statistics about ads accounts
func (h *Handler) getAdsAccountStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get ads account statistics from database
	var totalAccounts, activeAccounts, pendingAccounts int

	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM ads_accounts`).Scan(&totalAccounts)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM ads_accounts WHERE status = 'active'`).Scan(&activeAccounts)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM ads_accounts WHERE status = 'pending'`).Scan(&pendingAccounts)

	// Get accounts by platform
	type PlatformCount struct {
		Platform string `json:"platform"`
		Count    int    `json:"count"`
	}

	platformCounts := []PlatformCount{}
	rows, err := h.DB.Query(ctx, `
		SELECT platform, COUNT(*) as count
		FROM ads_accounts
		GROUP BY platform
		ORDER BY count DESC
	`)

	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var pc PlatformCount
			rows.Scan(&pc.Platform, &pc.Count)
			platformCounts = append(platformCounts, pc)
		}
	}

	// Get recent accounts (last 7 days)
	var recentAccounts int
	h.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM ads_accounts
		WHERE created_at >= NOW() - INTERVAL '7 days'
	`).Scan(&recentAccounts)

	// Get top users by account count
	type TopUser struct {
		UserID       string `json:"userId"`
		UserEmail    string `json:"userEmail"`
		AccountCount int    `json:"accountCount"`
	}

	topUsers := []TopUser{}
	userRows, err := h.DB.Query(ctx, `
		SELECT
			a.user_id,
			u.email,
			COUNT(*) as account_count
		FROM ads_accounts a
		LEFT JOIN "User" u ON a.user_id = u.id
		GROUP BY a.user_id, u.email
		ORDER BY account_count DESC
		LIMIT 10
	`)

	if err == nil {
		defer userRows.Close()
		for userRows.Next() {
			var tu TopUser
			userRows.Scan(&tu.UserID, &tu.UserEmail, &tu.AccountCount)
			topUsers = append(topUsers, tu)
		}
	}

	stats := map[string]interface{}{
		"totalAccounts":   totalAccounts,
		"activeAccounts":  activeAccounts,
		"pendingAccounts": pendingAccounts,
		"recentAccounts":  recentAccounts,
		"platformCounts":  platformCounts,
		"topUsers":        topUsers,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// getBulkOperations handles GET /api/v1/console/ads/bulk-operations
// Admin can list all bulk operations across all users
func (h *Handler) getBulkOperations(w http.ResponseWriter, r *http.Request) {
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

	statusFilter := strings.TrimSpace(query.Get("status"))
	userIDFilter := strings.TrimSpace(query.Get("userId"))

	offset := (page - 1) * pageSize

	// Build query with filters
	whereClause := "WHERE 1=1"
	args := []interface{}{}
	argIndex := 1

	if statusFilter != "" {
		whereClause += fmt.Sprintf(" AND bo.status = $%d", argIndex)
		args = append(args, statusFilter)
		argIndex++
	}

	if userIDFilter != "" {
		whereClause += fmt.Sprintf(" AND bo.user_id = $%d", argIndex)
		args = append(args, userIDFilter)
		argIndex++
	}

	// Get total count
	var totalCount int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM bulk_operations bo
		%s
	`, whereClause)

	err := h.DB.QueryRow(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to count bulk operations: %v", err), http.StatusInternalServerError)
		return
	}

	// Get bulk operations with pagination
	listQuery := fmt.Sprintf(`
		SELECT
			bo.id,
			bo.user_id,
			bo.status,
			bo.total_actions,
			bo.completed_actions,
			bo.failed_actions,
			bo.created_at,
			bo.updated_at,
			u.email,
			u.name
		FROM bulk_operations bo
		LEFT JOIN "User" u ON bo.user_id = u.id
		%s
		ORDER BY bo.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIndex, argIndex+1)

	args = append(args, pageSize, offset)

	rows, err := h.DB.Query(ctx, listQuery, args...)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to query bulk operations: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type BulkOperationWithUser struct {
		clients.BulkOperation
		UserEmail string `json:"userEmail,omitempty"`
		UserName  string `json:"userName,omitempty"`
	}

	items := []BulkOperationWithUser{}
	for rows.Next() {
		var item BulkOperationWithUser
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Status,
			&item.TotalActions,
			&item.CompletedActions,
			&item.FailedActions,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.UserEmail,
			&item.UserName,
		)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to scan bulk operation: %v", err), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}

	response := map[string]interface{}{
		"items":      items,
		"totalCount": totalCount,
		"page":       page,
		"pageSize":   pageSize,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// adsAccountsTree handles ads accounts sub-routes
func (h *Handler) adsAccountsTree(w http.ResponseWriter, r *http.Request) {
	// Extract account ID and action from path
	// Format: /api/v1/console/ads/accounts/{id} or /api/v1/console/ads/stats or /api/v1/console/ads/bulk-operations
	path := r.URL.Path
	prefix := "/api/v1/console/ads/"

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

	// Check first segment
	switch parts[0] {
	case "stats":
		if r.Method == http.MethodGet {
			h.getAdsAccountStats(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return

	case "bulk-operations":
		if r.Method == http.MethodGet {
			h.getBulkOperations(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return

	case "accounts":
		// Handle accounts sub-routes
		if len(parts) == 1 {
			// /api/v1/console/ads/accounts
			if r.Method == http.MethodGet {
				h.getAdsAccounts(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		// /api/v1/console/ads/accounts/{id}
		if len(parts) >= 2 {
			accountID := strings.TrimSpace(parts[1])
			if accountID != "" {
				if r.Method == http.MethodGet {
					h.getAdsAccount(w, r)
				} else {
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return
			}
		}

	default:
		http.NotFound(w, r)
		return
	}

	http.NotFound(w, r)
}
