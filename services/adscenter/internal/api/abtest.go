package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	adsstub "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ads"
)

// ABTestHandler handles A/B testing endpoints
type ABTestHandler struct {
	DB *sql.DB
}

// NewABTestHandler creates a new A/B test handler
func NewABTestHandler(db *sql.DB) *ABTestHandler {
	return &ABTestHandler{DB: db}
}

// HandleCreate creates a new A/B test
// POST /api/v1/adscenter/ab-tests
func (h *ABTestHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid == "" {
		apierrors.Unauthorized("Unauthorized").WriteJSON(w, r)
		return
	}
	writeExecutionUnavailable(w, r, "This legacy Google Ads mutation is unavailable until a validated, approved and idempotent workflow is connected")
}

// HandleList lists A/B tests for the authenticated user
// GET /api/v1/adscenter/ab-tests?limit=20
func (h *ABTestHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	lim := 20
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			lim = n
		}
	}

	// ensure tables exist
	_, _ = h.DB.Exec(`CREATE TABLE IF NOT EXISTS "ABTest"(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, account_id TEXT NOT NULL, offer_id TEXT NOT NULL, seed_ad_group_id TEXT NOT NULL, variant_a_group_id TEXT, variant_b_group_id TEXT, split_a INT NOT NULL DEFAULT 50, split_b INT NOT NULL DEFAULT 50, status TEXT NOT NULL DEFAULT 'planned', notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
	_, _ = h.DB.Exec(`CREATE TABLE IF NOT EXISTS "ABTestMetric"(id BIGSERIAL PRIMARY KEY, test_id TEXT NOT NULL, variant CHAR(1) NOT NULL, impressions BIGINT NOT NULL DEFAULT 0, clicks BIGINT NOT NULL DEFAULT 0, conversions BIGINT NOT NULL DEFAULT 0, cost_cents BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)

	rows, err := h.DB.Query(`SELECT id, account_id, offer_id, seed_ad_group_id, variant_a_group_id, variant_b_group_id, split_a, split_b, status, COALESCE(notes,'') FROM "ABTest" WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, uid, lim)
	if err != nil {
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, acc, off, seed, va, vb, status, notes string
		var sa, sb int
		if err := rows.Scan(&id, &acc, &off, &seed, &va, &vb, &sa, &sb, &status, &notes); err != nil {
			continue
		}

		// load metrics
		var aImp, aClk, bImp, bClk int64
		_ = h.DB.QueryRow(`SELECT COALESCE(SUM(impressions),0), COALESCE(SUM(clicks),0) FROM "ABTestMetric" WHERE test_id=$1 AND variant='A'`, id).Scan(&aImp, &aClk)
		_ = h.DB.QueryRow(`SELECT COALESCE(SUM(impressions),0), COALESCE(SUM(clicks),0) FROM "ABTestMetric" WHERE test_id=$1 AND variant='B'`, id).Scan(&bImp, &bClk)

		// compute recommendation via two-proportion z-test (CTR A vs CTR B)
		rec, p := recommendWinner(aImp, aClk, bImp, bClk)

		items = append(items, map[string]any{
			"id":             id,
			"accountId":      acc,
			"offerId":        off,
			"seedAdGroupId":  seed,
			"variants":       map[string]any{"A": va, "B": vb},
			"split":          map[string]int{"A": sa, "B": sb},
			"status":         status,
			"metrics":        map[string]any{"A": map[string]any{"impressions": aImp, "clicks": aClk}, "B": map[string]any{"impressions": bImp, "clicks": bClk}},
			"recommendation": rec,
			"pValue":         p,
			"notes":          notes,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// HandleGet retrieves a single A/B test by ID
// GET /api/v1/adscenter/ab-tests/{id}
func (h *ABTestHandler) HandleGet(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/ab-tests/"), "/")
	id := strings.TrimSpace(parts[0])
	if id == "" {
		apiErr := apierrors.InvalidRequest("param", "id required")
		apiErr.WriteJSON(w, r)
		return
	}

	var acc, off, seed, va, vb, status, notes string
	var sa, sb int
	var expID sql.NullString

	_, _ = h.DB.Exec(`ALTER TABLE "ABTest" ADD COLUMN IF NOT EXISTS experiment_id TEXT`)

	err := h.DB.QueryRow(`SELECT account_id, offer_id, seed_ad_group_id, variant_a_group_id, variant_b_group_id, split_a, split_b, status, COALESCE(notes,''), COALESCE(experiment_id,'') FROM "ABTest" WHERE id=$1 AND user_id=$2`, id, uid).Scan(&acc, &off, &seed, &va, &vb, &sa, &sb, &status, &notes, &expID)
	if err != nil {
		if err == sql.ErrNoRows {
			apiErr := apierrors.NotFound("ab test not found", "")
			apiErr.WriteJSON(w, r)
			return
		}
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	var aImp, aClk, bImp, bClk int64
	_ = h.DB.QueryRow(`SELECT COALESCE(SUM(impressions),0), COALESCE(SUM(clicks),0) FROM "ABTestMetric" WHERE test_id=$1 AND variant='A'`, id).Scan(&aImp, &aClk)
	_ = h.DB.QueryRow(`SELECT COALESCE(SUM(impressions),0), COALESCE(SUM(clicks),0) FROM "ABTestMetric" WHERE test_id=$1 AND variant='B'`, id).Scan(&bImp, &bClk)

	win, p := recommendWinner(aImp, aClk, bImp, bClk)

	resp := map[string]any{
		"id":             id,
		"accountId":      acc,
		"offerId":        off,
		"seedAdGroupId":  seed,
		"variants":       map[string]any{"A": va, "B": vb},
		"split":          map[string]int{"A": sa, "B": sb},
		"status":         status,
		"metrics":        map[string]any{"A": map[string]any{"impressions": aImp, "clicks": aClk}, "B": map[string]any{"impressions": bImp, "clicks": bClk}},
		"recommendation": win,
		"pValue":         p,
		"notes":          notes,
	}

	if expID.Valid && strings.TrimSpace(expID.String) != "" {
		resp["experimentId"] = expID.String
		resp["experimentVerified"] = false
		if strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_ABTEST_EXPERIMENTS")), "true") &&
			strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_ABTEST_LIVE")), "true") {
			cfgAds, err := loadUserAdsCredentials(r.Context(), h.DB, uid)
			if err == nil {
				client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
					DeveloperToken: cfgAds.DeveloperToken, OAuthClientID: cfgAds.OAuthClientID,
					OAuthClientSecret: cfgAds.OAuthClientSecret, RefreshToken: cfgAds.RefreshToken,
					LoginCustomerID: cfgAds.LoginCustomerID, CustomerID: acc,
				})
				if err == nil {
					defer client.Close()
					if experiment, err := client.GetExperiment(r.Context(), acc, expID.String); err == nil && experiment != nil {
						resp["experiment"] = experiment
						resp["experimentVerified"] = true
					}
				}
			}
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

// HandleIngestMetrics ingests metrics for a specific variant
// POST /api/v1/adscenter/ab-tests/{id}/metrics
func (h *ABTestHandler) HandleIngestMetrics(w http.ResponseWriter, r *http.Request) {
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

	// parse id from path
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/ab-tests/"), "/")
	if len(parts) < 2 || strings.TrimSpace(parts[1]) != "metrics" {
		apiErr := apierrors.InvalidRequest("param", "path not recognized")
		apiErr.WriteJSON(w, r)
		return
	}

	id := strings.TrimSpace(parts[0])
	if id == "" {
		apiErr := apierrors.InvalidRequest("param", "id required")
		apiErr.WriteJSON(w, r)
		return
	}

	var body struct {
		Variant     string `json:"variant"`
		Impressions int64  `json:"impressions"`
		Clicks      int64  `json:"clicks"`
		Conversions int64  `json:"conversions"`
		CostCents   int64  `json:"costCents"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apiErr := apierrors.InvalidRequest("param", "invalid body")
		apiErr.WriteJSON(w, r)
		return
	}

	v := strings.ToUpper(strings.TrimSpace(body.Variant))
	if v != "A" && v != "B" {
		apiErr := apierrors.InvalidRequest("param", "variant must be A or B")
		apiErr.WriteJSON(w, r)
		return
	}

	// Ownership verify (simple): ensure user_id matches
	var owner sql.NullString
	_ = h.DB.QueryRow(`SELECT user_id FROM "ABTest" WHERE id=$1`, id).Scan(&owner)
	if !owner.Valid || owner.String != uid {
		apiErr := apierrors.Forbidden("ABTest", "access")
		apiErr.WriteJSON(w, r)
		return
	}

	// Idempotency: avoid duplicate ingestion
	if idemKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idemKey != "" {
		if ex, ok := h.idemLookup(r.Context(), idemKey, uid, "adscenter.abtest.metrics"+":"+id+":"+v); ok && ex != "" {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "idempotent": true})
			return
		}
	}

	// Upsert by accumulating into latest row
	if _, err := h.DB.Exec(`INSERT INTO "ABTestMetric"(test_id, variant, impressions, clicks, conversions, cost_cents) VALUES ($1,$2,$3,$4,$5,$6)`, id, v, body.Impressions, body.Clicks, body.Conversions, body.CostCents); err != nil {
		apierrors.InternalError("failed to save supplied metrics").WriteJSON(w, r)
		return
	}

	if idemKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idemKey != "" {
		_ = h.idemUpsert(r.Context(), idemKey, uid, "adscenter.abtest.metrics"+":"+id+":"+v, id, 24*time.Hour)
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// HandleRefreshMetrics refreshes metrics from Google Ads API
// POST /api/v1/adscenter/ab-tests/{id}/refresh-metrics
func (h *ABTestHandler) HandleRefreshMetrics(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/ab-tests/"), "/")
	if len(parts) < 2 || strings.TrimSpace(parts[1]) != "refresh-metrics" {
		apiErr := apierrors.InvalidRequest("param", "path not recognized")
		apiErr.WriteJSON(w, r)
		return
	}

	id := strings.TrimSpace(parts[0])
	if id == "" {
		apiErr := apierrors.InvalidRequest("param", "id required")
		apiErr.WriteJSON(w, r)
		return
	}

	// Idempotency short-circuit
	if idemKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idemKey != "" {
		if ex, ok := h.idemLookup(r.Context(), idemKey, uid, "adscenter.abtest.refresh"+":"+id); ok && ex != "" {
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "idempotent": true})
			return
		}
	}

	// lookup test
	var acc, va, vb string
	err := h.DB.QueryRow(`SELECT account_id, variant_a_group_id, variant_b_group_id FROM "ABTest" WHERE id=$1 AND user_id=$2`, id, uid).Scan(&acc, &va, &vb)
	if err != nil {
		apiErr := apierrors.NotFound("ab test not found", "")
		apiErr.WriteJSON(w, r)
		return
	}

	cfgAds, err := loadUserAdsCredentials(r.Context(), h.DB, uid)
	if err != nil {
		apierrors.InvalidRequest("credentials", "Google Ads credentials unavailable").WriteJSON(w, r)
		return
	}
	client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
		DeveloperToken: cfgAds.DeveloperToken, OAuthClientID: cfgAds.OAuthClientID,
		OAuthClientSecret: cfgAds.OAuthClientSecret, RefreshToken: cfgAds.RefreshToken,
		LoginCustomerID: cfgAds.LoginCustomerID, CustomerID: acc,
	})

	if err != nil {
		apiErr := apierrors.InvalidRequest("param", "cannot init live client")
		apiErr.WriteJSON(w, r)
		return
	}

	// fetch metrics last 7 days
	ids := []string{}
	if strings.TrimSpace(va) != "" {
		ids = append(ids, va)
	}
	if strings.TrimSpace(vb) != "" {
		ids = append(ids, vb)
	}

	m, err := client.RefreshAdGroupMetrics(r.Context(), acc, ids, "LAST_7_DAYS")
	if err != nil {
		apiErr := apierrors.InvalidRequest("metrics", "Failed to refresh metrics")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	// upsert snapshot into ABTestMetric (aggregate only: impressions/clicks)
	for adg, v := range m {
		// map to A/B
		var variant string
		if adg == va {
			variant = "A"
		} else if adg == vb {
			variant = "B"
		} else {
			continue
		}

		if _, err := h.DB.Exec(`INSERT INTO "ABTestMetric"(test_id, variant, impressions, clicks, conversions, cost_cents) VALUES ($1,$2,$3,$4,0,$5)`,
			id, variant, v.Impressions, v.Clicks, v.CostMicros/10000); err != nil {
			apierrors.InternalError("failed to save fetched metrics").WriteJSON(w, r)
			return
		}
	}

	if idemKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idemKey != "" {
		_ = h.idemUpsert(r.Context(), idemKey, uid, "adscenter.abtest.refresh"+":"+id, id, 24*time.Hour)
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "fetched": len(m)})
}

// HandleGraduate marks an A/B test as completed and optionally pauses the loser
// POST /api/v1/adscenter/ab-tests/{id}/graduate
func (h *ABTestHandler) HandleGraduate(w http.ResponseWriter, r *http.Request) {
	if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid == "" {
		apierrors.Unauthorized("Unauthorized").WriteJSON(w, r)
		return
	}
	writeExecutionUnavailable(w, r, "This legacy Google Ads mutation is unavailable until a validated, approved and idempotent workflow is connected")
}

// HandleApplyWinnerPlan generates a bulk action plan based on the test winner
// POST /api/v1/adscenter/ab-tests/{id}/apply-winner-plan
func (h *ABTestHandler) HandleApplyWinnerPlan(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/adscenter/ab-tests/"), "/")
	if len(parts) < 2 || strings.TrimSpace(parts[1]) != "apply-winner-plan" {
		apiErr := apierrors.InvalidRequest("param", "path not recognized")
		apiErr.WriteJSON(w, r)
		return
	}

	id := strings.TrimSpace(parts[0])
	if id == "" {
		apiErr := apierrors.InvalidRequest("param", "id required")
		apiErr.WriteJSON(w, r)
		return
	}

	var body struct {
		Winner     string  `json:"winner"`
		Percent    float64 `json:"percent"`
		CpcPercent float64 `json:"cpcPercent"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	if idemKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idemKey != "" {
		if ex, ok := h.idemLookup(r.Context(), idemKey, uid, "adscenter.abtest.applyplan"+":"+id); ok && ex != "" {
			writeJSON(w, http.StatusOK, map[string]any{"plan": map[string]any{"status": "idempotent"}})
			return
		}
	}

	// Load AB test summary and derive default winner if not specified
	var acc, off, va, vb string
	if err := h.DB.QueryRow(`SELECT account_id, offer_id, variant_a_group_id, variant_b_group_id FROM "ABTest" WHERE id=$1 AND user_id=$2`, id, uid).Scan(&acc, &off, &va, &vb); err != nil {
		apiErr := apierrors.NotFound("ab test not found", "")
		apiErr.WriteJSON(w, r)
		return
	}

	var aImp, aClk, bImp, bClk int64
	_ = h.DB.QueryRow(`SELECT COALESCE(SUM(impressions),0), COALESCE(SUM(clicks),0) FROM "ABTestMetric" WHERE test_id=$1 AND variant='A'`, id).Scan(&aImp, &aClk)
	_ = h.DB.QueryRow(`SELECT COALESCE(SUM(impressions),0), COALESCE(SUM(clicks),0) FROM "ABTestMetric" WHERE test_id=$1 AND variant='B'`, id).Scan(&bImp, &bClk)

	autoWin, _ := recommendWinner(aImp, aClk, bImp, bClk)

	win := strings.ToUpper(strings.TrimSpace(body.Winner))
	if win != "A" && win != "B" {
		win = autoWin
	}

	// Default percent adjustments
	pct := body.Percent
	if pct == 0 {
		pct = 20
	}

	cpcPct := body.CpcPercent
	if cpcPct == 0 {
		cpcPct = 10
	}

	// Build plan: boost winner budget percent, reduce loser percent
	loser := "A"
	if win == "A" {
		loser = "B"
	}

	actions := []map[string]any{
		{"type": "ADJUST_BUDGET", "filter": map[string]any{"abTestId": id, "variant": win, "accountId": acc, "offerId": off}, "params": map[string]any{"percent": pct}},
		{"type": "ADJUST_BUDGET", "filter": map[string]any{"abTestId": id, "variant": loser, "accountId": acc, "offerId": off}, "params": map[string]any{"percent": -pct}},
		{"type": "ADJUST_CPC", "filter": map[string]any{"abTestId": id, "variant": win, "accountId": acc, "offerId": off}, "params": map[string]any{"percent": cpcPct}},
		{"type": "ADJUST_CPC", "filter": map[string]any{"abTestId": id, "variant": loser, "accountId": acc, "offerId": off}, "params": map[string]any{"percent": -cpcPct}},
	}

	// Include adGroupId in filter to便于执行阶段目标派生
	for i := range actions {
		f, _ := actions[i]["filter"].(map[string]any)
		if f == nil {
			f = map[string]any{}
		}

		if variant, ok := f["variant"].(string); ok {
			if strings.EqualFold(variant, "A") {
				f["adGroupId"] = va
			} else if strings.EqualFold(variant, "B") {
				f["adGroupId"] = vb
			}
		}

		actions[i]["filter"] = f
	}

	plan := map[string]any{"validateOnly": true, "actions": actions}

	if idemKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key")); idemKey != "" {
		_ = h.idemUpsert(r.Context(), idemKey, uid, "adscenter.abtest.applyplan"+":"+id, id, 24*time.Hour)
	}

	writeJSON(w, http.StatusOK, map[string]any{"plan": plan})
}

// --- Helper functions ---

// recommendWinner returns "A"/"B"/"inconclusive" and p-value for CTR difference
func recommendWinner(aImp, aClk, bImp, bClk int64) (string, float64) {
	if aImp <= 0 || bImp <= 0 {
		return "inconclusive", 1.0
	}

	pA := float64(aClk) / float64(aImp)
	pB := float64(bClk) / float64(bImp)

	// pooled proportion
	p := float64(aClk+bClk) / float64(aImp+bImp)

	// guard division by zero
	denom := p * (1 - p) * (1/float64(aImp) + 1/float64(bImp))
	if denom <= 0 {
		return "inconclusive", 1.0
	}

	z := (pA - pB) / (math.Sqrt(denom))

	// two-tailed p-value approximated via error function
	pval := 2 * (1 - 0.5*(1+math.Erf(math.Abs(z)/math.Sqrt2)))

	winner := "inconclusive"
	if pval < 0.05 {
		if pA > pB {
			winner = "A"
		} else {
			winner = "B"
		}
	}

	return winner, pval
}

// idemLookup checks if an idempotency key exists
func (h *ABTestHandler) idemLookup(ctx context.Context, key, userID, scope string) (string, bool) {
	if h.DB == nil || key == "" || userID == "" || scope == "" {
		return "", false
	}

	var id string
	c, cancel := context.WithTimeout(ctx, 800*time.Millisecond)
	defer cancel()

	if err := h.DB.QueryRowContext(c, `SELECT target_id FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()`, key, userID, scope).Scan(&id); err != nil {
		return "", false
	}

	return id, id != ""
}

// idemUpsert upserts an idempotency key
func (h *ABTestHandler) idemUpsert(ctx context.Context, key, userID, scope, targetID string, ttl time.Duration) error {
	if h.DB == nil || key == "" || userID == "" || scope == "" || targetID == "" {
		return nil
	}

	c, cancel := context.WithTimeout(ctx, 800*time.Millisecond)
	defer cancel()

	_, err := h.DB.ExecContext(c, `
        INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at)
        VALUES ($1,$2,$3,$4,NOW(), NOW()+$5::interval)
        ON CONFLICT (key) DO UPDATE SET user_id=EXCLUDED.user_id, scope=EXCLUDED.scope, target_id=EXCLUDED.target_id, expires_at=EXCLUDED.expires_at
    `, key, userID, scope, targetID, fmt.Sprintf("%d hours", int(ttl.Hours())))

	return err
}
