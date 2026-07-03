package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/services/console/internal/clients"
)

// ListOffersResponse represents the response for offers list (console version)
type ListOffersResponse struct {
	Items      []OfferWithUser `json:"items"`
	TotalCount int             `json:"totalCount"`
	Page       int             `json:"page"`
	PageSize   int             `json:"pageSize"`
}

// OfferWithUser extends Offer with user info
type OfferWithUser struct {
	clients.Offer
	UserEmail string `json:"userEmail,omitempty"`
	UserName  string `json:"userName,omitempty"`
}

// getOffers handles GET /api/v1/console/offers
// Admin can list all offers across all users
func (h *Handler) getOffers(w http.ResponseWriter, r *http.Request) {
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
	searchQuery := strings.TrimSpace(query.Get("search"))

	offset := (page - 1) * pageSize

	// If searching or filtering by user, we need to query database
	// Otherwise, we can use the Offer service directly
	if searchQuery != "" {
		// Search by user email/name in database, then fetch offers
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

		// Fetch offers for found users
		allOffers := []OfferWithUser{}
		for _, uid := range userIDs {
			offers, err := h.ServiceClients.Offer.ListOffers(ctx, clients.ListOffersRequest{
				UserID: uid,
				Status: statusFilter,
				Limit:  pageSize,
				Offset: 0,
			})

			if err != nil {
				continue
			}

			// Get user info
			var userEmail, userName string
			h.DB.QueryRow(ctx, `SELECT email, name FROM "User" WHERE id = $1`, uid).Scan(&userEmail, &userName)

			for _, offer := range offers.Items {
				allOffers = append(allOffers, OfferWithUser{
					Offer:     offer,
					UserEmail: userEmail,
					UserName:  userName,
				})
			}
		}

		response := ListOffersResponse{
			Items:      allOffers,
			TotalCount: len(allOffers),
			Page:       page,
			PageSize:   pageSize,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Get all offers from database (we need to query User table for enrichment)
	whereClause := "WHERE 1=1"
	args := []interface{}{}
	argIndex := 1

	if statusFilter != "" {
		whereClause += fmt.Sprintf(" AND o.status = $%d", argIndex)
		args = append(args, statusFilter)
		argIndex++
	}

	if userIDFilter != "" {
		whereClause += fmt.Sprintf(" AND o.\"userId\" = $%d", argIndex)
		args = append(args, userIDFilter)
		argIndex++
	}

	// Get total count from database
	var totalCount int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM "Offer" o
		%s
	`, whereClause)

	err := h.DB.QueryRow(ctx, countQuery, args...).Scan(&totalCount)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to count offers: %v", err), http.StatusInternalServerError)
		return
	}

	// Get offers with pagination
	listQuery := fmt.Sprintf(`
		SELECT
			o.id,
			o."userId",
			o.name,
			o.status,
			o."landingUrl",
			o."createdAt",
			o."updatedAt",
			u.email,
			u.name
		FROM "Offer" o
		LEFT JOIN "User" u ON o."userId" = u.id
		%s
		ORDER BY o."createdAt" DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIndex, argIndex+1)

	args = append(args, pageSize, offset)

	rows, err := h.DB.Query(ctx, listQuery, args...)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to query offers: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []OfferWithUser{}
	for rows.Next() {
		var item OfferWithUser
		err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Name,
			&item.Status,
			&item.LandingURL,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.UserEmail,
			&item.UserName,
		)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to scan offer: %v", err), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}

	response := ListOffersResponse{
		Items:      items,
		TotalCount: totalCount,
		Page:       page,
		PageSize:   pageSize,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// getOffer handles GET /api/v1/console/offers/{id}
// Admin can view any offer details
func (h *Handler) getOffer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract offer ID from URL path
	offerID := extractIDFromPath(r.URL.Path, "/api/v1/console/offers/")
	if offerID == "" {
		http.Error(w, "Offer ID is required", http.StatusBadRequest)
		return
	}

	// Get offer from Offer service
	offer, err := h.ServiceClients.Offer.GetOffer(ctx, offerID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get offer: %v", err), http.StatusInternalServerError)
		return
	}

	// Enrich with user info
	var userEmail, userName string
	h.DB.QueryRow(ctx, `SELECT email, name FROM "User" WHERE id = $1`, offer.UserID).Scan(&userEmail, &userName)

	// Get KPI data
	kpi, _ := h.ServiceClients.Offer.GetOfferKPI(ctx, offerID)

	response := map[string]interface{}{
		"offer": OfferWithUser{
			Offer:     *offer,
			UserEmail: userEmail,
			UserName:  userName,
		},
		"kpi": kpi,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// updateOfferStatus handles PATCH /api/v1/console/offers/{id}/status
// Admin can update offer status (e.g., suspend, activate)
func (h *Handler) updateOfferStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract offer ID from URL path
	offerID := extractIDFromPath(r.URL.Path, "/api/v1/console/offers/")
	if offerID == "" {
		http.Error(w, "Offer ID is required", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req clients.UpdateOfferStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Validate status
	req.Status = strings.ToLower(strings.TrimSpace(req.Status))
	validStatuses := map[string]bool{
		"active":    true,
		"suspended": true,
		"deleted":   true,
		"pending":   true,
	}

	if !validStatuses[req.Status] {
		http.Error(w, "Invalid status. Must be one of: active, suspended, deleted, pending", http.StatusBadRequest)
		return
	}

	// Update offer status via Offer service
	err := h.ServiceClients.Offer.UpdateOfferStatus(ctx, offerID, req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to update offer status: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Offer status updated to %s", req.Status),
	})
}

// getOfferStats handles GET /api/v1/console/offers/stats
// Returns overall statistics about offers
func (h *Handler) getOfferStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get offer statistics from database
	var totalOffers, activeOffers, suspendedOffers int

	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Offer"`).Scan(&totalOffers)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Offer" WHERE status = 'active'`).Scan(&activeOffers)
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Offer" WHERE status = 'suspended'`).Scan(&suspendedOffers)

	// Get recent offers (last 7 days)
	var recentOffers int
	h.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM "Offer"
		WHERE "createdAt" >= NOW() - INTERVAL '7 days'
	`).Scan(&recentOffers)

	// Get top users by offer count
	type TopUser struct {
		UserID     string `json:"userId"`
		UserEmail  string `json:"userEmail"`
		OfferCount int    `json:"offerCount"`
	}

	topUsers := []TopUser{}
	rows, err := h.DB.Query(ctx, `
		SELECT
			o."userId",
			u.email,
			COUNT(*) as offer_count
		FROM "Offer" o
		LEFT JOIN "User" u ON o."userId" = u.id
		GROUP BY o."userId", u.email
		ORDER BY offer_count DESC
		LIMIT 10
	`)

	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var tu TopUser
			rows.Scan(&tu.UserID, &tu.UserEmail, &tu.OfferCount)
			topUsers = append(topUsers, tu)
		}
	}

	stats := map[string]interface{}{
		"totalOffers":     totalOffers,
		"activeOffers":    activeOffers,
		"suspendedOffers": suspendedOffers,
		"recentOffers":    recentOffers,
		"topUsers":        topUsers,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// offersTree handles offer sub-routes
func (h *Handler) offersTree(w http.ResponseWriter, r *http.Request) {
	// Extract offer ID and action from path
	// Format: /api/v1/console/offers/{id} or /api/v1/console/offers/{id}/status or /api/v1/console/offers/stats
	path := r.URL.Path
	prefix := "/api/v1/console/offers/"

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
			h.getOfferStats(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	// Check if there's an action
	if len(parts) >= 2 {
		action := strings.TrimSpace(parts[1])

		switch action {
		case "status":
			if r.Method == http.MethodPatch {
				h.updateOfferStatus(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		default:
			http.NotFound(w, r)
			return
		}
	}

	// No action, just offer ID
	if r.Method == http.MethodGet {
		h.getOffer(w, r)
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
