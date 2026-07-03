package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	adsstub "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ads"
	adscfg "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ratelimit"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/storage"
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
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	if r.Method != http.MethodPost {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	var req struct {
		CustomerID string `json:"customerId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiErr := apierrors.InvalidRequest("param", "invalid body")
		apiErr.WriteJSON(w, r)
		return
	}

	cid := strings.TrimSpace(req.CustomerID)
	if cid == "" {
		apiErr := apierrors.InvalidRequest("param", "customerId required")
		apiErr.WriteJSON(w, r)
		return
	}

	// Idempotency check with direct DATABASE_URL connection
	if dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL")); dbURL != "" {
		if idem := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idem != "" {
			if db, err := sql.Open("postgres", dbURL); err == nil {
				defer db.Close()
				scope := "adscenter.mcc.link"
				var target string
				_ = db.QueryRow(`SELECT target_id FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()`,
					idem, uid, scope).Scan(&target)
				if target != "" {
					writeJSON(w, http.StatusAccepted, map[string]any{
						"status":     "queued",
						"message":    "idempotent",
						"customerId": cid,
					})
					return
				}
			}
		}
	}

	// Ensure MccLink table exists (idempotent)
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

	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "MccLink"(
		id BIGSERIAL PRIMARY KEY,
		user_id TEXT NOT NULL,
		customer_id TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)

	// Live mode: Send manager link invitation via Google Ads API
	live := strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MCC_ENABLE_LIVE")), "true")
	if live {
		ctx := r.Context()
		plan := ratelimit.ResolveUserPlan(r)
		pol := ratelimit.LoadPolicy(ctx)
		rl := pol.For(plan, "mcc")
		if rl.RPM > 0 || rl.Concurrency > 0 {
			ctx = ratelimit.WithParams(ctx, ratelimit.RateParams{
				Key:         fmt.Sprintf("mcc:%s", uid),
				RPM:         rl.RPM,
				Concurrency: rl.Concurrency,
			})
		}

		// Note: KeyedManager 是 main.go 中的全局实例，这里仅设置上下文参数供外层拦截器使用。

		// Load Google Ads credentials
		cfg, _ := adscfg.LoadAdsCreds(ctx)

		// Refresh token comes from the deployer's own config (self-hosted).
		// The user-service token-custody call was removed; per-user local OAuth
		// is handled separately (token stays on the user's machine).
		rt := cfg.RefreshToken
		loginCID := cfg.LoginCustomerID

		client, err := adsstub.NewClient(ctx, adsstub.LiveConfig{
			DeveloperToken:    cfg.DeveloperToken,
			OAuthClientID:     cfg.OAuthClientID,
			OAuthClientSecret: cfg.OAuthClientSecret,
			RefreshToken:      rt,
			LoginCustomerID: func() string {
				if cfg.LoginCustomerID != "" {
					return cfg.LoginCustomerID
				}
				return loginCID
			}(),
		})

		if err != nil {
			apiErr := apierrors.InvalidRequest("param", "cannot init live client")
			apiErr.WriteJSON(w, r)
			return
		}
		defer client.Close()

		if err := client.SendManagerLinkInvitation(ctx, cid); err != nil {
			apiErr := apierrors.InvalidRequest("customer_id", "Failed to send manager link invitation")
			apiErr.Details = map[string]interface{}{"error": err.Error()}
			apiErr.WriteJSON(w, r)
			return
		}

		// Update DB with invited status
		_, _ = db.Exec(`INSERT INTO "MccLink"(user_id, customer_id, status) VALUES ($1,$2,'invited') ON CONFLICT (user_id, customer_id) DO UPDATE SET status='invited', updated_at=NOW()`,
			uid, cid)
	} else {
		// Stub mode: insert pending link
		_, _ = db.Exec(`INSERT INTO "MccLink"(user_id, customer_id, status) VALUES ($1,$2,'pending') ON CONFLICT (user_id, customer_id) DO UPDATE SET status='pending', updated_at=NOW()`,
			uid, cid)
	}

	// Idempotency upsert if key provided
	if idemKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idemKey != "" {
		scope := "adscenter.mcc.link"
		_, _ = db.Exec(`INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at) VALUES ($1,$2,$3,$4,NOW(), NOW()+'24 hours'::interval) ON CONFLICT (key) DO UPDATE SET user_id=EXCLUDED.user_id, scope=EXCLUDED.scope, target_id=EXCLUDED.target_id, expires_at=EXCLUDED.expires_at`,
			idemKey, uid, scope, cid)
	}

	writeJSON(w, http.StatusAccepted, map[string]any{
		"status":     "queued",
		"customerId": cid,
		"live":       live,
	})
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
		cfg, _ := adscfg.LoadAdsCreds(r.Context())

		tokenEnc, loginCID, _, _ := storage.GetUserRefreshToken(r.Context(), db, uid)
		rt := tokenEnc
		if pt, ok := DecryptWithRotation(tokenEnc); ok {
			rt = pt
		}
		if rt == "" {
			rt = cfg.RefreshToken
		}

		client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
			DeveloperToken:    cfg.DeveloperToken,
			OAuthClientID:     cfg.OAuthClientID,
			OAuthClientSecret: cfg.OAuthClientSecret,
			RefreshToken:      rt,
			LoginCustomerID: func() string {
				if cfg.LoginCustomerID != "" {
					return cfg.LoginCustomerID
				}
				return loginCID
			}(),
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
			status = "pending"
		} else {
			apiErr := apierrors.InternalError("query failed")
			apiErr.Details = map[string]interface{}{"error": err.Error()}
			apiErr.WriteJSON(w, r)
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"customerId": cid, "status": status, "live": false})
}

// HandleUnlink removes an MCC link record
// DELETE /api/v1/adscenter/mcc/link?customerId=xxx
func (h *MCCHandler) HandleUnlink(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	if r.Method != http.MethodDelete {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
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

	_, _ = db.Exec(`DELETE FROM "MccLink" WHERE user_id=$1 AND customer_id=$2`, uid, cid)

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
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

	// Only attempt LIVE if ADS_MCC_LIVE enabled
	liveEnabled := strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MCC_LIVE")), "true")
	if liveEnabled {
		cfg, _ := adscfg.LoadAdsCreds(r.Context())

		// Use platform-level refresh token for batch operations
		client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
			DeveloperToken:    cfg.DeveloperToken,
			OAuthClientID:     cfg.OAuthClientID,
			OAuthClientSecret: cfg.OAuthClientSecret,
			RefreshToken:      cfg.RefreshToken,
			LoginCustomerID:   cfg.LoginCustomerID,
		})

		if err == nil {
			defer client.Close()

			for _, cid := range ids {
				sVal, err := client.GetManagerLinkStatus(r.Context(), cid)
				if err != nil {
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
				}
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"checked": len(ids), "updated": updated, "live": liveEnabled})
}
