package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	adscfg "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/executor"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ratelimit"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/storage"
)

// BulkRollbackHandler handles bulk operation rollback
type BulkRollbackHandler struct {
	DB *sql.DB
}

// NewBulkRollbackHandler creates a new bulk rollback handler
func NewBulkRollbackHandler(db *sql.DB) *BulkRollbackHandler {
	return &BulkRollbackHandler{DB: db}
}

// HandleRollback marks an operation as rolled_back and applies inverse actions
// POST /api/v1/adscenter/bulk-actions/{id}/rollback
func (h *BulkRollbackHandler) HandleRollback(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	// Extract operation ID from path
	id := r.URL.Query().Get("id")
	if id == "" {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")
		if len(parts) >= 1 {
			id = parts[0]
		}
	}

	if strings.TrimSpace(id) == "" {
		apiErr := apierrors.InvalidRequest("param", "operationId required")
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

	// Ensure tables exist
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionOperation"(id TEXT PRIMARY KEY, user_id TEXT, plan JSONB, status TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`)
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionAudit"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL, snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionSnapshot"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, action_idx INT NOT NULL, action_type TEXT NOT NULL, kind TEXT NOT NULL, snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)

	// Verify ownership
	var owner sql.NullString
	if err := db.QueryRow(`SELECT user_id FROM "BulkActionOperation" WHERE id=$1`, id).Scan(&owner); err != nil {
		if err == sql.ErrNoRows {
			apiErr := apierrors.NotFound("operation not found", "")
			apiErr.WriteJSON(w, r)
			return
		}
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	if !owner.Valid || owner.String != uid {
		apiErr := apierrors.Forbidden("BulkAction", "rollback")
		apiErr.WriteJSON(w, r)
		return
	}

	// Prepare executor with Ads credentials
	cfgAds, _ := adscfg.LoadAdsCreds(r.Context())
	rtEnc, loginCID, _, _ := storage.GetUserRefreshToken(r.Context(), db, uid)
	rt := rtEnc
	if pt, ok := DecryptWithRotation(rtEnc); ok {
		rt = pt
	}

	exec := executor.New(executor.Config{
		BrowserExecURL:    strings.TrimSpace(os.Getenv("BROWSER_EXEC_URL")),
		InternalToken:     strings.TrimSpace(os.Getenv("BROWSER_INTERNAL_TOKEN")),
		Timeout:           8 * time.Second,
		ValidateOnly:      false,
		LiveMutate:        strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_MUTATE_LIVE")), "true"),
		DeveloperToken:    cfgAds.DeveloperToken,
		OAuthClientID:     cfgAds.OAuthClientID,
		OAuthClientSecret: cfgAds.OAuthClientSecret,
		RefreshToken:      rt,
		LoginCustomerID: func() string {
			if cfgAds.LoginCustomerID != "" {
				return cfgAds.LoginCustomerID
			}
			return loginCID
		}(),
		CustomerID: loginCID,
	})

	// Read BEFORE snapshots and construct inverse actions
	rows, err := db.QueryContext(r.Context(), `SELECT action_type, snapshot::text FROM "BulkActionSnapshot" WHERE op_id=$1 AND kind='before' ORDER BY id ASC`, id)
	if err != nil {
		apiErr := apierrors.InternalError("query before snapshots failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer rows.Close()

	type snapItem struct {
		ActionType string
		Resource   string
		Value      any
	}

	var snaps []snapItem

	for rows.Next() {
		var at, stxt string
		if err := rows.Scan(&at, &stxt); err != nil {
			continue
		}

		var obj map[string]any
		if err := json.Unmarshal([]byte(stxt), &obj); err != nil {
			continue
		}

		rn := toString(obj["resourceName"])
		val, _ := obj["value"].(interface{})

		if strings.TrimSpace(rn) == "" {
			continue
		}

		snaps = append(snaps, snapItem{ActionType: strings.ToUpper(strings.TrimSpace(at)), Resource: rn, Value: val})
	}

	if len(snaps) == 0 {
		// No before snapshots - mark rolled_back (noop)
		_, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='rolled_back', updated_at=NOW() WHERE id=$1`, id)
		b, _ := json.Marshal(map[string]any{"summary": map[string]any{"status": "rolled_back", "mode": "noop_no_before"}})
		_, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'rollback',$3::jsonb)`, id, uid, string(b))

		writeJSON(w, http.StatusOK, map[string]any{"operationId": id, "status": "rolled_back", "mode": "noop_no_before"})
		return
	}

	// Apply rollback actions one-by-one
	applied := 0
	failed := 0

	for _, it := range snaps {
		var action executor.Action

		switch it.ActionType {
		case "ADJUST_CPC":
			micros := int64(0)
			switch v := it.Value.(type) {
			case float64:
				micros = int64(v)
			case int64:
				micros = v
			case int:
				micros = int64(v)
			}
			action = executor.Action{Type: "ADJUST_CPC", Params: map[string]any{"targetResourceNames": []any{it.Resource}, "cpcMicros": micros}}

		case "ADJUST_BUDGET":
			amt := int64(0)
			switch v := it.Value.(type) {
			case float64:
				amt = int64(v)
			case int64:
				amt = v
			case int:
				amt = int64(v)
			}
			action = executor.Action{Type: "ADJUST_BUDGET", Params: map[string]any{"campaignBudgetResourceNames": []any{it.Resource}, "amountMicros": amt}}

		case "ROTATE_LINK":
			suffix := toString(it.Value)
			action = executor.Action{Type: "ROTATE_LINK", Params: map[string]any{"adResourceNames": []any{it.Resource}, "finalUrlSuffix": suffix}}

		case "SET_TARGET_CPA":
			v := int64(0)
			switch x := it.Value.(type) {
			case float64:
				v = int64(x)
			case int64:
				v = x
			case int:
				v = int64(x)
			}
			action = executor.Action{Type: "SET_TARGET_CPA", Params: map[string]any{"campaignResourceNames": []any{it.Resource}, "targetCpaMicros": v}}

		case "SET_TARGET_ROAS":
			var roas float64
			switch x := it.Value.(type) {
			case float64:
				roas = x
			case int:
				roas = float64(x)
			case int64:
				roas = float64(x)
			}
			action = executor.Action{Type: "SET_TARGET_ROAS", Params: map[string]any{"campaignResourceNames": []any{it.Resource}, "targetRoas": roas}}

		case "SET_AD_SCHEDULES":
			action = executor.Action{Type: "SET_AD_SCHEDULES", Params: map[string]any{"campaignResourceNames": []any{it.Resource}, "schedules": it.Value}}

		case "PAUSE_ADS", "ENABLE_ADS":
			status := strings.ToUpper(toString(it.Value))
			actType := "PAUSE_ADS"
			if status == "ENABLED" {
				actType = "ENABLE_ADS"
			}
			action = executor.Action{Type: actType, Params: map[string]any{"adResourceNames": []any{it.Resource}}}

		case "PAUSE_AD_GROUPS", "ENABLE_AD_GROUPS":
			status := strings.ToUpper(toString(it.Value))
			actType := "PAUSE_AD_GROUPS"
			if status == "ENABLED" {
				actType = "ENABLE_AD_GROUPS"
			}
			action = executor.Action{Type: actType, Params: map[string]any{"adGroupResourceNames": []any{it.Resource}}}

		case "PAUSE_CAMPAIGNS", "ENABLE_CAMPAIGNS":
			status := strings.ToUpper(toString(it.Value))
			actType := "PAUSE_CAMPAIGNS"
			if status == "ENABLED" {
				actType = "ENABLE_CAMPAIGNS"
			}
			action = executor.Action{Type: actType, Params: map[string]any{"campaignResourceNames": []any{it.Resource}}}

		default:
			// Unsupported types are skipped
			continue
		}

		// Execute with retry
		var res executor.Result
		execErr := ratelimit.Retry(r.Context(), 3, 200*time.Millisecond, 1500*time.Millisecond, func(c context.Context) error {
			rr, e := exec.ExecuteOne(c, action)
			res = rr
			return e
		})

		// Audit as rollback_exec
		snap := map[string]any{"mode": "rollback", "action": action, "result": res, "executedAt": time.Now().UTC()}
		sb, _ := json.Marshal(snap)
		_, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'rollback_exec',$3::jsonb)`, id, uid, string(sb))

		if execErr != nil || !res.Success {
			failed++
		} else {
			applied++
		}
	}

	// Update status and insert rollback summary
	_, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='rolled_back', updated_at=NOW() WHERE id=$1`, id)

	sum := map[string]any{"status": "rolled_back", "applied": applied, "failed": failed}
	b, _ := json.Marshal(map[string]any{"summary": sum})
	_, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'rollback',$3::jsonb)`, id, uid, string(b))

	// Idempotency upsert
	if idemKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idemKey != "" {
		_, _ = db.Exec(`INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at) VALUES ($1,$2,$3,$4,NOW(), NOW()+'24 hours'::interval) ON CONFLICT (key) DO UPDATE SET user_id=EXCLUDED.user_id, scope=EXCLUDED.scope, target_id=EXCLUDED.target_id, expires_at=EXCLUDED.expires_at`,
			idemKey, uid, "adscenter.rollback", id)
	}

	writeJSON(w, http.StatusOK, map[string]any{"operationId": id, "status": "rolled_back", "applied": applied, "failed": failed})
}

// HandleAudits lists audit entries for an operation
// GET /api/v1/adscenter/bulk-actions/{id}/audits
func (h *BulkRollbackHandler) HandleAudits(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/bulk-actions/"), "/")
		if len(parts) >= 2 {
			id = parts[0]
		}
	}

	if strings.TrimSpace(id) == "" {
		apiErr := apierrors.InvalidRequest("param", "operationId required")
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

	rows, err := db.Query(`SELECT kind, snapshot::text, created_at FROM "BulkActionAudit" WHERE op_id=$1 AND user_id=$2 ORDER BY created_at ASC`, id, uid)
	if err != nil {
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer rows.Close()

	type item struct {
		Kind      string          `json:"kind"`
		Snapshot  json.RawMessage `json:"snapshot"`
		CreatedAt time.Time       `json:"createdAt"`
	}

	out := []item{}

	for rows.Next() {
		var it item
		var snapTxt string
		if err := rows.Scan(&it.Kind, &snapTxt, &it.CreatedAt); err == nil {
			it.Snapshot = json.RawMessage(snapTxt)
			out = append(out, it)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

// --- Helper functions ---

// toString converts any value to string
func toString(v any) string {
	if v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return x
	case []byte:
		return string(x)
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}
