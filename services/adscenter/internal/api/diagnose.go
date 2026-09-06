package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/oapi"
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

// HandleDiagnoseExecute fails closed until a real approved execution path exists.
func (h *DiagnoseHandler) HandleDiagnoseExecute(w http.ResponseWriter, r *http.Request) {
	if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid == "" {
		apierrors.Unauthorized("Unauthorized").WriteJSON(w, r)
		return
	}
	if r.Method != http.MethodPost {
		apiErr := apierrors.InvalidRequest("method", "Method not allowed")
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}
	writeExecutionUnavailable(w, r, "Diagnostic execution is unavailable: no validated and approved executor is connected")
}

// HandleDiagnoseMetrics never substitutes generated or heuristic values for account metrics.
func (h *DiagnoseHandler) HandleDiagnoseMetrics(w http.ResponseWriter, r *http.Request) {
	if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid == "" {
		apierrors.Unauthorized("Unauthorized").WriteJSON(w, r)
		return
	}
	writeExecutionUnavailable(w, r, "Verified Google Ads diagnostic metrics are not implemented; supply actual metrics to the diagnostic plan endpoint")
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

	out.ValidateOnly = true

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
