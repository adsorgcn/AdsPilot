package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/errors"
)

// GetDashboardStats implements the dashboard stats endpoint for user dashboard
// GET /api/v1/console/dashboard/stats
//
// This endpoint provides aggregated statistics for the current user's dashboard,
// including offers, evaluations, tokens, and ads accounts.
func (h *Handler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context (set by auth middleware)
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "User ID not found in context", nil)
		return
	}

	// Initialize response structure
	stats := map[string]interface{}{
		"userId":      userID,
		"lastUpdated": time.Now().UTC().Format(time.RFC3339),
	}

	// Query helper function
	queryInt := func(sql string, args ...interface{}) int64 {
		var result int64
		if err := h.DB.QueryRow(ctx, sql, args...).Scan(&result); err != nil {
			return 0
		}
		return result
	}

	// 1. Offer Statistics
	stats["totalOffers"] = queryInt(`SELECT COUNT(*) FROM "Offer" WHERE "userId" = $1`, userID)
	stats["evaluatedOffers"] = queryInt(`
		SELECT COUNT(*) FROM "Offer" 
		WHERE "userId" = $1 AND status IN ('evaluated', 'ready_to_deploy', 'deployed')
	`, userID)
	stats["pendingEvaluations"] = queryInt(`
		SELECT COUNT(*) FROM "Offer" 
		WHERE "userId" = $1 AND status IN ('pending_evaluation', 'evaluating')
	`, userID)

	// Offers evaluated today
	stats["evaluatedToday"] = queryInt(`
		SELECT COUNT(*) FROM "Offer" 
		WHERE "userId" = $1 
		AND status IN ('evaluated', 'ready_to_deploy') 
		AND "updatedAt" >= CURRENT_DATE
	`, userID)

	// 2. AI Evaluation Statistics
	stats["aiEvaluationsTotal"] = queryInt(`
		SELECT COUNT(*) FROM "Offer" 
		WHERE "userId" = $1 AND "aiScore" IS NOT NULL
	`, userID)
	stats["aiEvaluationsSuccess"] = queryInt(`
		SELECT COUNT(*) FROM "Offer" 
		WHERE "userId" = $1 AND "aiScore" IS NOT NULL AND status != 'evaluation_failed'
	`, userID)
	stats["aiEvaluationsFailed"] = queryInt(`
		SELECT COUNT(*) FROM "Offer" 
		WHERE "userId" = $1 AND status = 'evaluation_failed'
	`, userID)

	// 3. Token Statistics
	var tokensRemaining int64
	if err := h.DB.QueryRow(ctx, `
		SELECT COALESCE(balance, 0) FROM "UserToken" WHERE "userId" = $1
	`, userID).Scan(&tokensRemaining); err != nil {
		tokensRemaining = 0
	}
	stats["tokensRemaining"] = tokensRemaining
	stats["tokensTotal"] = tokensRemaining // For now, same as remaining
	stats["tokensConsumed"] = 0            // TODO: Track consumed tokens

	// 4. Average Score (simplified - using aiScore)
	var avgScore *float64
	if err := h.DB.QueryRow(ctx, `
		SELECT AVG("aiScore") FROM "Offer" 
		WHERE "userId" = $1 AND "aiScore" IS NOT NULL
	`, userID).Scan(&avgScore); err == nil && avgScore != nil {
		// Convert numeric score to letter grade
		score := *avgScore
		var grade string
		switch {
		case score >= 90:
			grade = "A+"
		case score >= 85:
			grade = "A"
		case score >= 80:
			grade = "A-"
		case score >= 75:
			grade = "B+"
		case score >= 70:
			grade = "B"
		case score >= 65:
			grade = "B-"
		case score >= 60:
			grade = "C+"
		case score >= 55:
			grade = "C"
		default:
			grade = "C-"
		}
		stats["avgScore"] = grade
		stats["scoreTrend"] = "stable" // TODO: Calculate trend
	}

	// 5. Ads Accounts Statistics (if available)
	adsAccountsTotal := queryInt(`
		SELECT COUNT(*) FROM "AdsAccount" WHERE "userId" = $1
	`, userID)

	if adsAccountsTotal > 0 {
		adsStats := map[string]interface{}{
			"totalAccounts":        adsAccountsTotal,
			"activeAccounts":       queryInt(`SELECT COUNT(*) FROM "AdsAccount" WHERE "userId" = $1 AND status = 'active'`, userID),
			"pendingAuthorization": queryInt(`SELECT COUNT(*) FROM "AdsAccount" WHERE "userId" = $1 AND status = 'pending_authorization'`, userID),
			"offersCoverage":       0, // TODO: Calculate coverage percentage
		}
		stats["adsAccounts"] = adsStats
	}

	// 6. Recent Evaluations (last 5)
	rows, err := h.DB.Query(ctx, `
		SELECT 
			id,
			"offerId",
			status,
			"brandName",
			domain,
			"aiScore",
			"createdAt",
			"updatedAt"
		FROM "Offer"
		WHERE "userId" = $1 AND "aiScore" IS NOT NULL
		ORDER BY "updatedAt" DESC
		LIMIT 5
	`, userID)

	if err == nil {
		defer rows.Close()

		recentEvaluations := []map[string]interface{}{}
		for rows.Next() {
			var (
				id, offerId, status, brandName, domain string
				aiScore                                *float64
				createdAt, updatedAt                   time.Time
			)

			if err := rows.Scan(&id, &offerId, &status, &brandName, &domain, &aiScore, &createdAt, &updatedAt); err != nil {
				continue
			}

			eval := map[string]interface{}{
				"id":             id,
				"offerId":        offerId,
				"type":           "ai_evaluation",
				"status":         status,
				"tokensConsumed": 1, // TODO: Track actual token consumption
				"brandName":      brandName,
				"domain":         domain,
				"createdAt":      createdAt.Format(time.RFC3339),
			}

			if aiScore != nil {
				eval["aiScore"] = *aiScore
			}
			if !updatedAt.IsZero() {
				eval["completedAt"] = updatedAt.Format(time.RFC3339)
			}

			recentEvaluations = append(recentEvaluations, eval)
		}

		if len(recentEvaluations) > 0 {
			stats["recentEvaluations"] = recentEvaluations
		} else {
			stats["recentEvaluations"] = []map[string]interface{}{}
		}
	} else {
		stats["recentEvaluations"] = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(stats)
}
