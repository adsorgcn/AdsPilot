package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	rlredis "github.com/ScientificInternet/Google-Monetize/pkg/ratelimitredis"
	adsstub "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ads"
	adscfg "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/oapi"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ratelimit"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/storage"
)

// DiagnoseHandler handles diagnostic endpoints for Google Ads accounts
type DiagnoseHandler struct {
	DB *sql.DB
	RC *pcache.Cache
}

// NewDiagnoseHandler creates a new diagnose handler
func NewDiagnoseHandler(db *sql.DB, rc *pcache.Cache) *DiagnoseHandler {
	return &DiagnoseHandler{DB: db, RC: rc}
}

// HandleDiagnose analyzes account metrics and returns diagnostic rules + suggested actions
// POST /api/v1/adscenter/diagnose
func (h *DiagnoseHandler) HandleDiagnose(w http.ResponseWriter, r *http.Request) {
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

	var body struct {
		AccountID  string         `json:"accountId"`
		LandingURL string         `json:"landingUrl"`
		Metrics    map[string]any `json:"metrics"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apiErr := apierrors.InvalidRequest("param", "invalid body")
		apiErr.WriteJSON(w, r)
		return
	}

	// Extract or default metrics
	getNum := func(k string, def float64) float64 {
		if body.Metrics == nil {
			return def
		}
		if v, ok := body.Metrics[k]; ok {
			switch t := v.(type) {
			case float64:
				return t
			case int:
				return float64(t)
			case string:
				if f, err := strconv.ParseFloat(t, 64); err == nil {
					return f
				}
			}
		}
		return def
	}

	impressions := getNum("impressions", 0)
	ctr := getNum("ctr", 0)
	_ = getNum("conversions", 0) // placeholder for future use
	qs := getNum("qualityScore", 0)
	budgetPacing := getNum("budgetPacing", 0) // ratio used/budget today
	dailyBudget := getNum("dailyBudget", 0)

	rules := []map[string]any{}
	add := func(code, sev, msg string, details map[string]any) {
		rules = append(rules, map[string]any{"code": code, "severity": sev, "message": msg, "details": details})
	}

	suggest := []map[string]any{}
	addSug := func(kind string, params map[string]any, reason string, impact map[string]any) {
		m := map[string]any{"action": kind, "params": params, "reason": reason}
		if impact != nil && len(impact) > 0 {
			m["impact"] = impact
		}
		suggest = append(suggest, m)
	}

	// Rule: no impressions
	if impressions <= 0 {
		add("NO_IMPRESSIONS", "error", "近7天曝光为0，广告未投放或被限制", map[string]any{"impressions": impressions})
		addSug("ENABLE_CAMPAIGNS", nil, "启用被暂停的广告系列", map[string]any{"expectedImprDelta": "+100~+500"})
		addSug("FIX_TARGETING", map[string]any{"hint": "放宽地域/时段/设备定向"}, "扩大受众范围", map[string]any{"expectedImprDelta": "+10%~+30%"})
	}

	// Rule: low CTR
	if impressions > 100 && ctr < 0.5 {
		add("LOW_CTR", "warn", "点击率较低，建议优化创意与匹配类型", map[string]any{"ctr": ctr, "threshold": 0.8})
		addSug("ADJUST_MATCH_TYPE", map[string]any{"to": "phrase"}, "降低流量噪声并提升相关性", map[string]any{"expectedCtrDelta": "+0.2~+0.5"})
		addSug("ADD_AD_VARIANTS", map[string]any{"count": 2}, "增加创意版本做AB测试", map[string]any{"expectedCtrDelta": "+0.1~+0.3"})
	}

	// Rule: low quality score
	if qs > 0 && qs < 5 {
		add("LOW_QUALITY_SCORE", "warn", "质量得分偏低，建议优化落地页相关性与加载速度", map[string]any{"qualityScore": qs, "threshold": 6})
		addSug("INCREASE_CPC", map[string]any{"percent": 10}, "短期提升排名与曝光", map[string]any{"expectedImprDelta": "+5%~+15%", "risk": "CPC上涨"})
	}

	// Rule: budget issues
	if dailyBudget <= 0 {
		add("BUDGET_MISSING", "error", "未设置或预算为0", map[string]any{"dailyBudget": dailyBudget})
		addSug("ADJUST_BUDGET", map[string]any{"dailyBudget": 50}, "设置合理日预算", map[string]any{"expectedImprDelta": "+20%~+50%"})
	} else if budgetPacing >= 1.0 {
		add("BUDGET_EXHAUSTED", "warn", "预算已耗尽，建议提升预算或优化投放时段", map[string]any{"pacing": budgetPacing})
		addSug("ADJUST_BUDGET", map[string]any{"percent": 20}, "提升预算避免漏量", map[string]any{"expectedImprDelta": "+10%~+30%"})
	}

	// Rule: tracking missing (heuristic based on landing URL)
	if u := strings.TrimSpace(body.LandingURL); u != "" {
		if !strings.Contains(u, "utm_") && !strings.Contains(u, "gclid=") {
			add("TRACKING_MISSING", "warn", "缺少常见跟踪参数（utm_* 或 gclid）", map[string]any{"landingUrl": u})
			addSug("ENABLE_AUTO_TAGGING", nil, "启用自动标记以提升转化归因", map[string]any{"expectedConvDelta": "+5%~+15%"})
		}
	}

	// Rule: no conversions despite impressions and acceptable CTR
	conversions := getNum("conversions", 0)
	if impressions > 300 && ctr >= 0.8 && conversions <= 0 {
		add("NO_CONVERSIONS", "warn", "有曝光和点击但无转化，需检查落地页与转化追踪", map[string]any{"impressions": impressions, "ctr": ctr, "conversions": conversions})
		addSug("IMPROVE_LANDING", map[string]any{"hint": "提升加载速度/相关性"}, "优化落地页体验", map[string]any{"expectedConvDelta": "+5%~+20%"})
		addSug("ENABLE_CONV_TRACKING", map[string]any{"hint": "GA4/Ads 转化事件"}, "完善转化追踪", map[string]any{"expectedConvDelta": "+10%~+30%"})
	}

	// Overall severity
	summary := "ok"
	for _, r := range rules {
		if r["severity"] == "error" {
			summary = "error"
			break
		} else if summary != "error" && r["severity"] == "warn" {
			summary = "warn"
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"summary": summary, "rules": rules, "suggestedActions": suggest})
}

// HandleDiagnosePlan returns a BulkAction plan (validateOnly) inferred from metrics
// POST /api/v1/adscenter/diagnose/plan
func (h *DiagnoseHandler) HandleDiagnosePlan(w http.ResponseWriter, r *http.Request) {
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

	var body struct {
		Metrics   map[string]any         `json:"metrics"`
		Suggested []oapi.SuggestedAction `json:"suggestedActions"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apiErr := apierrors.InvalidRequest("param", "invalid body")
		apiErr.WriteJSON(w, r)
		return
	}

	// Prefer suggestions if provided, otherwise derive from metrics
	var plan struct {
		ValidateOnly bool             `json:"validateOnly"`
		Actions      []map[string]any `json:"actions"`
	}

	if len(body.Suggested) > 0 {
		plan.ValidateOnly = true
		for _, sgg := range body.Suggested {
			t := strings.ToUpper(strings.TrimSpace(sgg.Action))
			p := map[string]any{}
			if sgg.Params != nil {
				for k, v := range *sgg.Params {
					p[k] = v
				}
			}

			switch t {
			case "INCREASE_CPC":
				if _, ok := p["percent"]; !ok {
					p["percent"] = 10
				}
				plan.Actions = append(plan.Actions, map[string]any{"type": "ADJUST_CPC", "params": p})
			case "ADJUST_BUDGET":
				plan.Actions = append(plan.Actions, map[string]any{"type": "ADJUST_BUDGET", "params": p})
			case "ROTATE_LINK":
				// accept either targetDomain string or links[] array
				if _, ok := p["targetDomain"]; ok {
					plan.Actions = append(plan.Actions, map[string]any{"type": "ROTATE_LINK", "params": p})
				} else if v, ok := p["links"].([]any); ok && len(v) > 0 {
					plan.Actions = append(plan.Actions, map[string]any{"type": "ROTATE_LINK", "params": p})
				}
			// other suggestion kinds currently not mapped to supported plan actions
			default:
				// ignore unsupported suggestion types to keep plan valid
			}
		}

		if len(plan.Actions) == 0 {
			// fallback to metrics if nothing mapped
			mplan := buildPlanFromMetrics(body.Metrics)
			plan.ValidateOnly = mplan.ValidateOnly
			plan.Actions = mplan.Actions
		}
	} else {
		mplan := buildPlanFromMetrics(body.Metrics)
		plan.ValidateOnly = mplan.ValidateOnly
		plan.Actions = mplan.Actions
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"plan": plan, "validateOnly": true})
}

// HandleDiagnoseExecute generates a plan from metrics and enqueues it as a bulk operation
// POST /api/v1/adscenter/diagnose/execute
func (h *DiagnoseHandler) HandleDiagnoseExecute(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	// Cross-instance RPM gate for diagnose execute (enqueue)
	if h.RC != nil && h.RC.Ready() {
		planName := ratelimit.ResolveUserPlan(r)
		pol := ratelimit.LoadPolicy(r.Context())
		rl := pol.For(planName, "mutate")
		if rl.RPM > 0 {
			if rr, _ := rlredis.AllowRPM(r.Context(), h.RC, uid+":diag_exec", rl.RPM); !rr.Allowed {
				if rr.RetryAfterMs > 0 {
					w.Header().Set("Retry-After", fmt.Sprintf("%d", (rr.RetryAfterMs+999)/1000))
				}
				apiErr := apierrors.RateLimited(int(rr.RetryAfterMs))
				apiErr.WriteJSON(w, r)
				return
			}
		}
	}

	if r.Method != http.MethodPost {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	var body struct {
		Metrics map[string]any `json:"metrics"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apiErr := apierrors.InvalidRequest("param", "invalid body")
		apiErr.WriteJSON(w, r)
		return
	}

	plan := buildPlanFromMetrics(body.Metrics)

	// Enqueue similar to submit handler (minimal)
	var db *sql.DB
	var err error
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
		db, err = sql.Open("postgres", dbURL)
		if err != nil {
			apiErr := apierrors.InternalError("db open failed")
			apiErr.Details = map[string]interface{}{"error": err.Error()}
			apiErr.WriteJSON(w, r)
			return
		}
		needClose = true
		defer func() {
			if needClose {
				db.Close()
			}
		}()
	}

	// Enforce per-plan daily quota before creating an operation
	planName := ratelimit.ResolveUserPlan(r)
	pol := ratelimit.LoadPolicy(r.Context())
	if daily := pol.QuotaDailyFor(planName); daily > 0 {
		usage := 0
		_ = db.QueryRow(`SELECT COUNT(1) FROM "BulkActionOperation" WHERE user_id=$1 AND created_at::date = CURRENT_DATE`, uid).Scan(&usage)
		if usage >= daily {
			apiErr := apierrors.RateLimited(0)
			apiErr.Message = "daily quota exceeded"
			apiErr.Details = map[string]interface{}{"plan": planName}
			apiErr.WriteJSON(w, r)
			return
		}
	}

	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionOperation"(id TEXT PRIMARY KEY, user_id TEXT, plan JSONB, status TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());`)
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionAudit"(id BIGSERIAL PRIMARY KEY, op_id TEXT NOT NULL, user_id TEXT NOT NULL, kind TEXT NOT NULL, snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`)

	planBytes, _ := json.Marshal(plan)
	opID := generateOperationID()

	_, _ = db.Exec(`INSERT INTO "BulkActionOperation"(id, user_id, plan, status) VALUES ($1,$2,$3,'queued')`, opID, uid, string(planBytes))
	_, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'before',$3::jsonb)`, opID, uid, string(planBytes))

	// shard planning
	_, _ = db.Exec(`CREATE TABLE IF NOT EXISTS "BulkActionShard"(
		id BIGSERIAL PRIMARY KEY,
		op_id TEXT NOT NULL,
		seq INT NOT NULL,
		actions JSONB NOT NULL,
		status TEXT NOT NULL DEFAULT 'queued',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)

	if len(plan.Actions) > 0 {
		batchSize := 20
		if v := strings.TrimSpace(os.Getenv("ADS_MUTATE_BATCH_SIZE")); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				batchSize = n
			}
		}

		total := len(plan.Actions)
		if total > batchSize {
			shards := 0
			for i := 0; i < total; i += batchSize {
				j := i + batchSize
				if j > total {
					j = total
				}
				part := plan.Actions[i:j]
				pb, _ := json.Marshal(map[string]any{"actions": part})
				_, _ = db.Exec(`INSERT INTO "BulkActionShard"(op_id, seq, actions, status) VALUES ($1,$2,$3,'queued')`, opID, shards, string(pb))
				shards++
			}

			sp := map[string]any{"kind": "shard_plan", "batchSize": batchSize, "shards": shards, "totalActions": total}
			sb, _ := json.Marshal(sp)
			_, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'other',$3::jsonb)`, opID, uid, string(sb))
		}
	}

	// async update to running->completed with shard simulation
	go func(opId, user string) {
		time.Sleep(300 * time.Millisecond)
		_, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='running', updated_at=NOW() WHERE id=$1`, opId)

		rows, err := db.Query(`SELECT id, seq FROM "BulkActionShard" WHERE op_id=$1 ORDER BY seq ASC`, opId)
		if err == nil {
			for rows.Next() {
				var shardID int64
				var seq int
				if err := rows.Scan(&shardID, &seq); err == nil {
					_, _ = db.Exec(`UPDATE "BulkActionShard" SET status='running', updated_at=NOW() WHERE id=$1`, shardID)
					time.Sleep(200 * time.Millisecond)
					_, _ = db.Exec(`UPDATE "BulkActionShard" SET status='completed', updated_at=NOW() WHERE id=$1`, shardID)
				}
			}
			rows.Close()
		}

		// simulate after snapshot
		snap := map[string]any{"executed": len(plan.Actions)}
		b, _ := json.Marshal(snap)
		_, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'after',$3::jsonb)`, opId, user, string(b))
		_, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='completed', updated_at=NOW() WHERE id=$1`, opId)
	}(opID, uid)

	writeJSON(w, http.StatusAccepted, map[string]any{"operationId": opID, "status": "queued"})
}

// HandleDiagnoseMetrics provides metrics autofill (stub or live)
// GET /api/v1/adscenter/diagnose/metrics?accountId=xxx
func (h *DiagnoseHandler) HandleDiagnoseMetrics(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	// Live mode gated behind ADS_DIAG_LIVE
	live := strings.EqualFold(strings.TrimSpace(os.Getenv("ADS_DIAG_LIVE")), "true")
	accountID := strings.TrimSpace(r.URL.Query().Get("accountId"))
	if accountID == "" {
		accountID = uid
	}

	if live {
		// per-user plan limiter (action=diagnose)
		plan := ratelimit.ResolveUserPlan(r)
		pol := ratelimit.LoadPolicy(r.Context())
		rl := pol.For(plan, "diagnose")

		// Cross-instance RPM via Redis
		if h.RC != nil && h.RC.Ready() && rl.RPM > 0 {
			if rr, _ := rlredis.AllowRPM(r.Context(), h.RC, uid+":diagnose", rl.RPM); !rr.Allowed {
				if rr.RetryAfterMs > 0 {
					w.Header().Set("Retry-After", fmt.Sprintf("%d", (rr.RetryAfterMs+999)/1000))
				}
				apiErr := apierrors.RateLimited(int(rr.RetryAfterMs))
				apiErr.WriteJSON(w, r)
				return
			}
		}

		// Attempt Live client; fallback to stub if errors occur
		cfgAds, _ := adscfg.LoadAdsCreds(r.Context())

		// Try user-level refresh token for better permissions
		tokenEnc, loginCID, _, _ := storage.GetUserRefreshToken(r.Context(), h.DB, uid)
		rt := tokenEnc
		if pt, ok := DecryptWithRotation(tokenEnc); ok {
			rt = pt
		}
		if rt == "" {
			rt = cfgAds.RefreshToken
		}

		client, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
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
		})

		if err == nil && client != nil {
			// campaigns -> derive simple metrics
			n, err2 := client.GetCampaignsCount(r.Context(), accountID)
			if err2 == nil {
				impressions := n*200 + 300 // heuristic
				ctr := 1.2
				if n > 10 {
					ctr = 0.8
				}
				if n > 50 {
					ctr = 0.5
				}
				qs := 6
				if n < 5 {
					qs = 7
				} else if n > 30 {
					qs = 5
				}
				budget := 50 + n
				pacing := 0.3

				writeJSON(w, http.StatusOK, map[string]any{
					"impressions":  impressions,
					"ctr":          ctr,
					"qualityScore": qs,
					"dailyBudget":  budget,
					"budgetPacing": pacing,
				})
				return
			}
		}
		// Fall through to stub if live failed
	}

	// Stub/pseudo: deterministic metrics for consistent UX
	hashVal := fnvHash(accountID)
	impressions := (hashVal%2000 + 100)
	ctr := float64((hashVal%100)+1) / 10.0
	qs := (hashVal%10 + 1)
	budget := (hashVal%200 + 20)
	pacing := float64((hashVal%90)+1) / 100.0

	writeJSON(w, http.StatusOK, map[string]any{
		"impressions":  impressions,
		"ctr":          ctr,
		"qualityScore": qs,
		"dailyBudget":  budget,
		"budgetPacing": pacing,
	})
}

// --- Helper functions ---

// buildPlanFromMetrics produces a plan using only allowed action types (ADJUST_BUDGET, ADJUST_CPC)
func buildPlanFromMetrics(metrics map[string]any) (out struct {
	Actions      []map[string]any `json:"actions"`
	ValidateOnly bool             `json:"validateOnly"`
}) {
	getNum := func(k string, def float64) float64 {
		if metrics == nil {
			return def
		}
		if v, ok := metrics[k]; ok {
			switch t := v.(type) {
			case float64:
				return t
			case int:
				return float64(t)
			case string:
				if f, err := strconv.ParseFloat(t, 64); err == nil {
					return f
				}
			}
		}
		return def
	}

	impressions := getNum("impressions", 0)
	ctr := getNum("ctr", 0)
	qs := getNum("qualityScore", 0)
	pacing := getNum("budgetPacing", 0)
	dailyBudget := getNum("dailyBudget", 0)

	out.ValidateOnly = false

	add := func(typ string, params map[string]any) {
		out.Actions = append(out.Actions, map[string]any{"type": typ, "params": params})
	}

	if dailyBudget <= 0 {
		add("ADJUST_BUDGET", map[string]any{"dailyBudget": 50})
	} else if pacing >= 1.0 {
		add("ADJUST_BUDGET", map[string]any{"percent": 20})
	}

	if impressions > 100 && ctr < 0.5 {
		add("ADJUST_CPC", map[string]any{"percent": 10})
	}

	if qs > 0 && qs < 5 {
		add("ADJUST_CPC", map[string]any{"percent": 10})
	}

	return
}
