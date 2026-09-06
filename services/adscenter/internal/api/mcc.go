package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	adsstub "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ads"
)

// MCCHandler handles MCC (My Client Center) linking operations
type MCCHandler struct {
	DB *sql.DB
	RC *pcache.Cache
}

// NewMCCHandler creates a new MCC handler
func NewMCCHandler(db *sql.DB, rc *pcache.Cache) *MCCHandler {
	return &MCCHandler{DB: db, RC: rc}
}

// HandleLink sends a manager link invitation to the customer account
// POST /api/v1/adscenter/mcc/link
func (h *MCCHandler) HandleLink(w http.ResponseWriter, r *http.Request) {
	if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid == "" {
		apierrors.Unauthorized("Unauthorized").WriteJSON(w, r)
		return
	}
	writeExecutionUnavailable(w, r, "This legacy Google Ads mutation is unavailable until a validated, approved and idempotent workflow is connected")
}

// HandleStatus retrieves the current status of MCC link for a customer
// GET /api/v1/adscenter/mcc/status?customerId=xxx
func (h *MCCHandler) HandleStatus(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	cid := strings.TrimSpace(r.URL.Query().Get("customerId"))
	if cid == "" {
		apiErr := apierrors.InvalidRequest("param", "customerId required")
		apiErr.WriteJSON(w, r)
		return
	}

	var db *sql.DB
	needClose := false

	if h.DB != nil {
		db = h.DB
	} else {
		dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
		if dbURL == "" {
			apiErr := apierrors.InternalError("DATABASE_URL not set")
			apiErr.WriteJSON(w, r)
			return
		}
		dbInst, err := sql.Open("postgres", dbURL)
		if err != nil {
			apiErr := apierrors.InternalError("db open failed")
			apiErr.Details = map[string]interface{}{"error": err.Error()}
			apiErr.WriteJSON(w, r)
			return
		}
		db = dbInst
		needClose = true
		defer func() {
			if needClose {
				db.Close()
			}
		}()
	}

	// Live mode: fetch from Google Ads API
	live := strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MCC_LIVE")), "true")
	if live {
		cfg, err := loadUserAdsCredentials(r.Context(), db, uid)
		if err != nil {
			apierrors.InvalidRequest("credentials", "Google Ads credentials unavailable").WriteJSON(w, r)
			return
		}
		client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
			DeveloperToken: cfg.DeveloperToken, OAuthClientID: cfg.OAuthClientID,
			OAuthClientSecret: cfg.OAuthClientSecret, RefreshToken: cfg.RefreshToken,
			LoginCustomerID: cfg.LoginCustomerID, CustomerID: cid,
		})

		if err != nil {
			apiErr := apierrors.InvalidRequest("param", "cannot init live client")
			apiErr.WriteJSON(w, r)
			return
		}
		defer client.Close()

		st, err := client.GetManagerLinkStatus(r.Context(), cid)
		if err != nil {
			apiErr := apierrors.InvalidRequest("customer_id", "Failed to get manager link status")
			apiErr.Details = map[string]interface{}{"error": err.Error()}
			apiErr.WriteJSON(w, r)
			return
		}

		norm := strings.ToLower(strings.TrimSpace(st))
		if norm == "approved" || norm == "active" {
			norm = "active"
		}

		// Update DB cache
		_, _ = db.Exec(`INSERT INTO "MccLink"(user_id, customer_id, status) VALUES ($1,$2,$3) ON CONFLICT (user_id, customer_id) DO UPDATE SET status=$3, updated_at=NOW()`,
			uid, cid, norm)

		writeJSON(w, http.StatusOK, map[string]any{"customerId": cid, "status": norm, "live": true})
		return
	}

	// Stub mode: return DB status or default pending
	var status string
	err := db.QueryRow(`SELECT status FROM "MccLink" WHERE user_id=$1 AND customer_id=$2`, uid, cid).Scan(&status)
	if err != nil {
		if err == sql.ErrNoRows {
			apierrors.NotFound("No recorded manager link status", "").WriteJSON(w, r)
			return
		} else {
			apiErr := apierrors.InternalError("query failed")
			apiErr.Details = map[string]interface{}{"error": err.Error()}
			apiErr.WriteJSON(w, r)
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"customerId": cid, "status": status, "live": false, "source": "local_record", "verified": false})
}

// HandleUnlink removes an MCC link record
// DELETE /api/v1/adscenter/mcc/link?customerId=xxx
func (h *MCCHandler) HandleUnlink(w http.ResponseWriter, r *http.Request) {
	if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid == "" {
		apierrors.Unauthorized("Unauthorized").WriteJSON(w, r)
		return
	}
	writeExecutionUnavailable(w, r, "This legacy Google Ads mutation is unavailable until a validated, approved and idempotent workflow is connected")
}

// HandleRefresh refreshes statuses for all pending links of current user
// POST /api/v1/adscenter/mcc/refresh
func (h *MCCHandler) HandleRefresh(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	var db *sql.DB
	needClose := false

	if h.DB != nil {
		db = h.DB
	} else {
		dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
		if dbURL == "" {
			apiErr := apierrors.InternalError("DATABASE_URL not set")
			apiErr.WriteJSON(w, r)
			return
		}
		dbInst, err := sql.Open("postgres", dbURL)
		if err != nil {
			apiErr := apierrors.InternalError("db open failed")
			apiErr.Details = map[string]interface{}{"error": err.Error()}
			apiErr.WriteJSON(w, r)
			return
		}
		db = dbInst
		needClose = true
		defer func() {
			if needClose {
				db.Close()
			}
		}()
	}

	// Optional sharding
	shard := -1
	total := 0

	var body struct {
		Shard       *int `json:"shard"`
		TotalShards *int `json:"totalShards"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	if body.TotalShards != nil && *body.TotalShards > 0 {
		total = *body.TotalShards
	}
	if body.Shard != nil && *body.Shard >= 0 {
		shard = *body.Shard
	}

	// Fetch pending links
	rows, err := db.QueryContext(r.Context(), `SELECT customer_id FROM "MccLink" WHERE user_id=$1 AND status IN ('pending','invited')`, uid)
	if err != nil {
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer rows.Close()

	ids := []string{}
	for rows.Next() {
		var cid string
		if rows.Scan(&cid) == nil && cid != "" {
			ids = append(ids, cid)
		}
	}

	if total > 0 && shard >= 0 && shard < total {
		filtered := make([]string, 0, len(ids))
		for _, cid := range ids {
			if fnvHash(cid)%total == shard {
				filtered = append(filtered, cid)
			}
		}
		ids = filtered
	}

	updated := 0
	failed := 0

	// Only attempt LIVE if ADS_MCC_LIVE enabled
	liveEnabled := strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MCC_LIVE")), "true")
	if !liveEnabled {
		writeExecutionUnavailable(w, r, "Google Ads manager-link refresh is disabled")
		return
	}
	if liveEnabled {
		cfg, err := loadUserAdsCredentials(r.Context(), db, uid)
		if err != nil {
			apierrors.InvalidRequest("credentials", "Google Ads credentials unavailable").WriteJSON(w, r)
			return
		}

		// Use platform-level refresh token for batch operations
		client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
			DeveloperToken:    cfg.DeveloperToken,
			OAuthClientID:     cfg.OAuthClientID,
			OAuthClientSecret: cfg.OAuthClientSecret,
			RefreshToken:      cfg.RefreshToken,
			LoginCustomerID:   cfg.LoginCustomerID,
		})

		if err != nil {
			writeExecutionUnavailable(w, r, "Google Ads manager-link client is unavailable")
			return
		}
		if err == nil {
			defer client.Close()

			for _, cid := range ids {
				sVal, err := client.GetManagerLinkStatus(r.Context(), cid)
				if err != nil {
					failed++
					continue
				}

				norm := strings.ToLower(strings.TrimSpace(sVal))
				if norm == "approved" || norm == "active" {
					norm = "active"
				} else if norm == "pending" || norm == "invited" {
					norm = "pending"
				}

				if _, err := db.ExecContext(r.Context(), `UPDATE "MccLink" SET status=$1, updated_at=NOW() WHERE user_id=$2 AND customer_id=$3`,
					norm, uid, cid); err == nil {
					updated++
				} else {
					failed++
				}
			}
		}
	}

	if failed > 0 {
		apiErr := apierrors.New("UPSTREAM_ERROR", "Some manager-link statuses could not be refreshed", map[string]any{"attempted": len(ids), "updated": updated, "failed": failed})
		apiErr.HTTPStatus = http.StatusBadGateway
		apiErr.WriteJSON(w, r)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"checked": len(ids), "updated": updated, "live": liveEnabled})
}
