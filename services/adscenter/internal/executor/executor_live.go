//go:build ads_live

package executor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	httpx "github.com/ScientificInternet/Google-Monetize/pkg/http"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type Action struct {
	Type   string                 `json:"type"`
	Params map[string]interface{} `json:"params,omitempty"`
	Filter map[string]interface{} `json:"filter,omitempty"`
}

type Result struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message,omitempty"`
	Details map[string]interface{} `json:"details,omitempty"`
}

type Config struct {
	BrowserExecURL    string
	InternalToken     string
	Timeout           time.Duration
	ValidateOnly      bool
	LiveMutate        bool
	DeveloperToken    string
	OAuthClientID     string
	OAuthClientSecret string
	RefreshToken      string
	LoginCustomerID   string
	CustomerID        string
}

type Executor struct {
	cfg  Config
	http *httpx.Client
}

func New(cfg Config) *Executor {
	if cfg.Timeout <= 0 {
		cfg.Timeout = 6 * time.Second
	}
	return &Executor{cfg: cfg, http: httpx.New(cfg.Timeout)}
}

func (e *Executor) ExecuteOne(ctx context.Context, a Action) (Result, error) {
	t := strings.ToUpper(strings.TrimSpace(a.Type))
	switch t {
	case "ADJUST_CPC":
		return e.adjustCPC(ctx, a)
	case "ADJUST_BUDGET":
		return e.adjustBudget(ctx, a)
	case "ROTATE_LINK":
		// reuse stub browser-exec resolve for now
		return (&Executor{cfg: Config{BrowserExecURL: e.cfg.BrowserExecURL, InternalToken: e.cfg.InternalToken, Timeout: e.cfg.Timeout, ValidateOnly: e.cfg.ValidateOnly}}).rotateLink(ctx, a)
	case "SET_AD_SCHEDULES":
		return e.setAdSchedules(ctx, a)
	case "SET_TARGET_CPA":
		return e.setTargetCPA(ctx, a)
	case "SET_TARGET_ROAS":
		return e.setTargetROAS(ctx, a)
	case "ADD_NEGATIVE_KEYWORDS":
		return e.addNegativeKeywords(ctx, a)
	case "REMOVE_NEGATIVE_KEYWORDS":
		return e.removeNegativeKeywords(ctx, a)
	case "PAUSE_ADS":
		return e.setAdsStatus(ctx, a, "PAUSED")
	case "ENABLE_ADS":
		return e.setAdsStatus(ctx, a, "ENABLED")
	case "PAUSE_AD_GROUPS":
		return e.setAdGroupsStatus(ctx, a, "PAUSED")
	case "ENABLE_AD_GROUPS":
		return e.setAdGroupsStatus(ctx, a, "ENABLED")
	case "PAUSE_KEYWORDS":
		return e.setKeywordsStatus(ctx, a, "PAUSED")
	case "ENABLE_KEYWORDS":
		return e.setKeywordsStatus(ctx, a, "ENABLED")
	case "PAUSE_CAMPAIGNS":
		return e.setCampaignsStatus(ctx, a, "PAUSED")
	case "ENABLE_CAMPAIGNS":
		return e.setCampaignsStatus(ctx, a, "ENABLED")
	default:
		return Result{Success: false, Message: "unsupported action"}, errors.New("unsupported action")
	}
}

// addNegativeKeywords creates ad_group_criterion with negative keyword for given ad groups.
// Params:
//
//	adGroupResourceNames: []string (required)
//	keywords: []string (required)
//	matchType: string (EXACT|PHRASE|BROAD, default PHRASE)
func (e *Executor) addNegativeKeywords(ctx context.Context, a Action) (Result, error) {
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	var adGroups []string
	if v, ok := a.Params["adGroupResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok2 := it.(string); ok2 && strings.TrimSpace(s) != "" {
				adGroups = append(adGroups, s)
			}
		}
	}
	var keywords []string
	if v, ok := a.Params["keywords"].([]interface{}); ok {
		for _, it := range v {
			if s, ok2 := it.(string); ok2 && strings.TrimSpace(s) != "" {
				keywords = append(keywords, s)
			}
		}
	}
	matchType := strings.ToUpper(strings.TrimSpace(toString(a.Params["matchType"])))
	if matchType == "" {
		matchType = "PHRASE"
	}
	if len(adGroups) == 0 || len(keywords) == 0 {
		return Result{Success: true, Message: "validateOnly mutate skipped: missing adGroups/keywords"}, nil
	}
	// Fetch existing negatives to avoid duplicates
	existing, _ := e.fetchNegKeywords(ctx, adGroups)
	ops := make([]map[string]any, 0)
	applied, skipped := 0, 0
	for _, ag := range adGroups {
		current := existing[ag]
		for _, kw := range keywords {
			if kw == "" {
				continue
			}
			if containsNegKW(current, kw, matchType) {
				skipped++
				continue
			}
			create := map[string]any{
				"adGroup":  ag,
				"negative": true,
				"status":   "ENABLED",
				"keyword":  map[string]any{"text": kw, "matchType": matchType},
			}
			ops = append(ops, map[string]any{"adGroupCriterionOperation": map[string]any{"create": create}})
			applied++
		}
	}
	details := map[string]any{"targets": adGroups, "keywords": keywords, "matchType": matchType, "applied": applied, "skipped": skipped}
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	res, err := e.mutate(ctx, ops, validateOnly)
	if res.Details == nil {
		res.Details = map[string]any{}
	}
	for k, v := range details {
		res.Details[k] = v
	}
	if len(ops) == 0 {
		res.Success = true
		if res.Message == "" {
			res.Message = "no-op"
		}
	}
	return res, err
}

// removeNegativeKeywords removes existing negative keywords matched by text/matchType for given ad groups.
// Params:
//
//	adGroupResourceNames: []string (required)
//	keywords: []string (required)
//	matchType: string (optional; if empty, remove any matchType for the text)
func (e *Executor) removeNegativeKeywords(ctx context.Context, a Action) (Result, error) {
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	var adGroups []string
	if v, ok := a.Params["adGroupResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok2 := it.(string); ok2 && strings.TrimSpace(s) != "" {
				adGroups = append(adGroups, s)
			}
		}
	}
	var keywords []string
	if v, ok := a.Params["keywords"].([]interface{}); ok {
		for _, it := range v {
			if s, ok2 := it.(string); ok2 && strings.TrimSpace(s) != "" {
				keywords = append(keywords, s)
			}
		}
	}
	matchType := strings.ToUpper(strings.TrimSpace(toString(a.Params["matchType"]))) // optional
	if len(adGroups) == 0 || len(keywords) == 0 {
		return Result{Success: true, Message: "no-op: missing adGroups/keywords"}, nil
	}
	existing, _ := e.fetchNegKeywords(ctx, adGroups)
	ops := make([]map[string]any, 0)
	applied, skipped := 0, 0
	for _, ag := range adGroups {
		for _, kw := range keywords {
			if kw == "" {
				continue
			}
			// remove all matched entries for kw (+matchType if provided)
			for _, ent := range existing[ag] {
				if !strings.EqualFold(ent.Text, kw) {
					continue
				}
				if matchType != "" && !strings.EqualFold(ent.MatchType, matchType) {
					continue
				}
				if strings.TrimSpace(ent.Resource) == "" {
					continue
				}
				ops = append(ops, map[string]any{"adGroupCriterionOperation": map[string]any{"remove": ent.Resource}})
				applied++
			}
			if applied == 0 {
				skipped++
			}
		}
	}
	details := map[string]any{"targets": adGroups, "keywords": keywords, "matchType": matchType, "applied": applied, "skipped": skipped}
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	res, err := e.mutate(ctx, ops, validateOnly)
	if res.Details == nil {
		res.Details = map[string]any{}
	}
	for k, v := range details {
		res.Details[k] = v
	}
	if len(ops) == 0 {
		res.Success = true
		if res.Message == "" {
			res.Message = "no-op"
		}
	}
	return res, err
}

type negKW struct{ Text, MatchType, Resource string }

func containsNegKW(list []negKW, text, mt string) bool {
	for _, e := range list {
		if strings.EqualFold(e.Text, text) {
			if mt == "" || strings.EqualFold(e.MatchType, mt) {
				return true
			}
		}
	}
	return false
}

// fetchNegKeywords returns existing negative keywords indexed by adGroup resource name.
func (e *Executor) fetchNegKeywords(ctx context.Context, adGroups []string) (map[string][]negKW, error) {
	out := map[string][]negKW{}
	if len(adGroups) == 0 {
		return out, nil
	}
	// Build GAQL to fetch negative keywords for given ad groups
	b := strings.Builder{}
	b.WriteString("SELECT ad_group_criterion.resource_name, ad_group_criterion.ad_group, ad_group_criterion.negative, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion WHERE ad_group_criterion.ad_group IN (")
	for i, rn := range adGroups {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") AND ad_group_criterion.negative = true AND ad_group_criterion.status != REMOVED LIMIT 10000")
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return out, err
	}
	for _, row := range rows {
		if agc, ok := row["adGroupCriterion"].(map[string]any); ok {
			rn, _ := agc["resourceName"].(string)
			ag, _ := agc["adGroup"].(string)
			// keyword nested object may be in row["keyword"]
			text := toStringFromAny(row, []string{"keyword", "text"})
			mt := strings.ToUpper(toStringFromAny(row, []string{"keyword", "matchType"}))
			if ag != "" && rn != "" && text != "" {
				out[ag] = append(out[ag], negKW{Text: text, MatchType: mt, Resource: rn})
			}
		}
	}
	return out, nil
}

func toStringFromAny(m map[string]any, path []string) string {
	cur := any(m)
	for _, p := range path {
		mm, ok := cur.(map[string]any)
		if !ok {
			return ""
		}
		cur, ok = mm[p]
		if !ok {
			return ""
		}
	}
	switch v := cur.(type) {
	case string:
		return v
	default:
		return toString(v)
	}
}

func toString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case fmt.Stringer:
		return t.String()
	case float64:
		return fmt.Sprintf("%v", t)
	case int:
		return fmt.Sprintf("%d", t)
	case int64:
		return fmt.Sprintf("%d", t)
	case bool:
		if t {
			return "true"
		}
		return "false"
	default:
		return ""
	}
}

// --- Campaign Ad Schedules ---
type adSchedule struct {
	DayOfWeek   string
	StartHour   int
	StartMinute string // ZERO, FIFTEEN, THIRTY, FORTY_FIVE
	EndHour     int
	EndMinute   string
}

func normMinute(m string) string {
	s := strings.ToUpper(strings.TrimSpace(m))
	switch s {
	case "0", "00", "ZERO":
		return "ZERO"
	case "15", "FIFTEEN":
		return "FIFTEEN"
	case "30", "THIRTY":
		return "THIRTY"
	case "45", "FORTY_FIVE":
		return "FORTY_FIVE"
	default:
		return "ZERO"
	}
}

func parseSchedules(raw any) []adSchedule {
	out := []adSchedule{}
	arr, ok := raw.([]interface{})
	if !ok {
		return out
	}
	for _, it := range arr {
		m, ok := it.(map[string]any)
		if !ok {
			continue
		}
		day := strings.ToUpper(strings.TrimSpace(toString(m["dayOfWeek"])))
		sh := 0
		if v, ok := m["startHour"].(float64); ok {
			sh = int(v)
		} else if v, ok := m["startHour"].(int); ok {
			sh = v
		}
		eh := 0
		if v, ok := m["endHour"].(float64); ok {
			eh = int(v)
		} else if v, ok := m["endHour"].(int); ok {
			eh = v
		}
		sm := normMinute(toString(m["startMinute"]))
		em := normMinute(toString(m["endMinute"]))
		if day == "" {
			continue
		}
		out = append(out, adSchedule{DayOfWeek: day, StartHour: sh, StartMinute: sm, EndHour: eh, EndMinute: em})
	}
	return out
}

func eqSchedules(a, b []adSchedule) bool {
	if len(a) != len(b) {
		return false
	}
	key := func(s adSchedule) string {
		return s.DayOfWeek + "|" + fmt.Sprintf("%02d", s.StartHour) + "|" + s.StartMinute + "|" + fmt.Sprintf("%02d", s.EndHour) + "|" + s.EndMinute
	}
	set := map[string]int{}
	for _, x := range a {
		set[key(x)]++
	}
	for _, y := range b {
		k := key(y)
		if set[k] == 0 {
			return false
		}
		set[k]--
	}
	return true
}

func (e *Executor) fetchCampaignSchedules(ctx context.Context, campaigns []string) (map[string][]adSchedule, map[string][]string, error) {
	res := map[string][]adSchedule{}
	rnByCamp := map[string][]string{} // campaign -> []criterion resource_name
	if len(campaigns) == 0 {
		return res, rnByCamp, nil
	}
	b := strings.Builder{}
	b.WriteString("SELECT campaign_criterion.resource_name, campaign_criterion.campaign, ")
	b.WriteString("campaign_criterion.ad_schedule.day_of_week, ")
	b.WriteString("campaign_criterion.ad_schedule.start_hour, ")
	b.WriteString("campaign_criterion.ad_schedule.start_minute, ")
	b.WriteString("campaign_criterion.ad_schedule.end_hour, ")
	b.WriteString("campaign_criterion.ad_schedule.end_minute ")
	b.WriteString("FROM campaign_criterion WHERE campaign_criterion.campaign IN (")
	for i, rn := range campaigns {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") AND campaign_criterion.type = AD_SCHEDULE AND campaign_criterion.status != REMOVED LIMIT 10000")
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return res, rnByCamp, err
	}
	for _, row := range rows {
		cc, ok := row["campaignCriterion"].(map[string]any)
		if !ok {
			continue
		}
		rn, _ := cc["resourceName"].(string)
		camp, _ := cc["campaign"].(string)
		dow := strings.ToUpper(toStringFromAny(row, []string{"adSchedule", "dayOfWeek"}))
		sh := 0
		if v := toStringFromAny(row, []string{"adSchedule", "startHour"}); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				sh = n
			}
		}
		sm := strings.ToUpper(toStringFromAny(row, []string{"adSchedule", "startMinute"}))
		eh := 0
		if v := toStringFromAny(row, []string{"adSchedule", "endHour"}); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				eh = n
			}
		}
		em := strings.ToUpper(toStringFromAny(row, []string{"adSchedule", "endMinute"}))
		if camp != "" {
			res[camp] = append(res[camp], adSchedule{DayOfWeek: dow, StartHour: sh, StartMinute: sm, EndHour: eh, EndMinute: em})
			rnByCamp[camp] = append(rnByCamp[camp], rn)
		}
	}
	return res, rnByCamp, nil
}

// setAdSchedules replaces campaign ad schedules with provided list (per campaign).
// Params:
//
//	campaignResourceNames: []string
//	schedules: [{ dayOfWeek, startHour, startMinute, endHour, endMinute }]
func (e *Executor) setAdSchedules(ctx context.Context, a Action) (Result, error) {
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	var camps []string
	if v, ok := a.Params["campaignResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok2 := it.(string); ok2 && strings.TrimSpace(s) != "" {
				camps = append(camps, s)
			}
		}
	}
	desired := parseSchedules(a.Params["schedules"])
	if len(camps) == 0 {
		return Result{Success: true, Message: "no campaigns"}, nil
	}
	// Fetch existing
	cur, rnByCamp, _ := e.fetchCampaignSchedules(ctx, camps)
	ops := []map[string]any{}
	applied, skipped := 0, 0
	before := map[string]any{}
	for _, camp := range camps {
		before[camp] = cur[camp]
		if eqSchedules(cur[camp], desired) {
			skipped++
			continue
		}
		// remove existing
		for _, rn := range rnByCamp[camp] {
			ops = append(ops, map[string]any{"campaignCriterionOperation": map[string]any{"remove": rn}})
		}
		// create desired
		for _, sch := range desired {
			create := map[string]any{
				"campaign": camp,
				"adSchedule": map[string]any{
					"dayOfWeek":   sch.DayOfWeek,
					"startHour":   sch.StartHour,
					"startMinute": sch.StartMinute,
					"endHour":     sch.EndHour,
					"endMinute":   sch.EndMinute,
				},
			}
			ops = append(ops, map[string]any{"campaignCriterionOperation": map[string]any{"create": create}})
		}
		applied++
	}
	details := map[string]any{"targets": camps, "applied": applied, "skipped": skipped, "desired": desired}
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	if !validateOnly {
		details["before"] = before
	}
	res, err := e.mutate(ctx, ops, validateOnly)
	if !validateOnly {
		after, _, _ := e.fetchCampaignSchedules(ctx, camps)
		details["after"] = after
	}
	if res.Details == nil {
		res.Details = map[string]any{}
	}
	for k, v := range details {
		res.Details[k] = v
	}
	if len(ops) == 0 {
		res.Success = true
		if res.Message == "" {
			res.Message = "no-op"
		}
	}
	return res, err
}

func (e *Executor) tokenSource(ctx context.Context) oauth2.TokenSource {
	conf := &oauth2.Config{ClientID: e.cfg.OAuthClientID, ClientSecret: e.cfg.OAuthClientSecret, Endpoint: google.Endpoint, Scopes: []string{"https://www.googleapis.com/auth/adwords"}}
	return conf.TokenSource(ctx, &oauth2.Token{RefreshToken: e.cfg.RefreshToken})
}

func (e *Executor) authHeaders(ctx context.Context) (http.Header, error) {
	tok, err := e.tokenSource(ctx).Token()
	if err != nil {
		return nil, err
	}
	h := http.Header{}
	h.Set("Authorization", "Bearer "+tok.AccessToken)
	h.Set("developer-token", e.cfg.DeveloperToken)
	if e.cfg.LoginCustomerID != "" {
		h.Set("login-customer-id", e.cfg.LoginCustomerID)
	}
	h.Set("Content-Type", "application/json")
	return h, nil
}

func (e *Executor) adjustCPC(ctx context.Context, a Action) (Result, error) {
	// Use validate-only mutate to verify structure/permission first
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	// Build mutate operations from params
	// Expect: params.targetResourceNames: []string of adGroupCriteria resource names
	//         params.cpcMicros: int (new CPC in micros)
	var targets []string
	if v, ok := a.Params["targetResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok := it.(string); ok && strings.TrimSpace(s) != "" {
				targets = append(targets, s)
			}
		}
	}
	if len(targets) == 0 {
		return Result{Success: true, Message: "validateOnly mutate skipped: no targets"}, nil
	}
	cpcMicros := int64(0)
	percent := 0.0
	switch vv := a.Params["cpcMicros"].(type) {
	case float64:
		cpcMicros = int64(vv)
	case int64:
		cpcMicros = vv
	case int:
		cpcMicros = int64(vv)
	}
	if p, ok := a.Params["percent"].(float64); ok {
		percent = p
	}
	if cpcMicros <= 0 {
		if percent == 0 {
			return Result{Success: true, Message: "validateOnly mutate skipped: cpcMicros missing/<=0"}, nil
		}
	}
	ops := make([]map[string]any, 0, len(targets))
	var before map[string]int64
	var _ = before
	// If percent provided, compute per-target new CPC based on current values
	if percent != 0 {
		bm, _ := e.fetchCriterionCPC(ctx, targets)
		before = bm
		for _, rn := range targets {
			cur := bm[rn]
			if cur <= 0 {
				continue
			}
			nv := int64(float64(cur) * (1.0 + percent/100.0))
			if nv == cur { // conflict/dup: skip
				continue
			}
			upd := map[string]any{"resourceName": rn, "cpcBidMicros": nv}
			ops = append(ops, map[string]any{"adGroupCriterionOperation": map[string]any{"update": upd, "updateMask": "cpc_bid_micros"}})
		}
	} else {
		for _, rn := range targets {
			// fetch current CPC best-effort to avoid no-op
			if before == nil {
				bm, _ := e.fetchCriterionCPC(ctx, []string{rn})
				before = bm
			}
			if before != nil {
				if cur, ok := before[rn]; ok && cur == cpcMicros {
					continue
				}
			}
			upd := map[string]any{"resourceName": rn, "cpcBidMicros": cpcMicros}
			ops = append(ops, map[string]any{"adGroupCriterionOperation": map[string]any{"update": upd, "updateMask": "cpc_bid_micros"}})
		}
	}
	// validateOnly unless LiveMutate 且未显式 ValidateOnly
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	details := map[string]any{"targets": targets, "cpcMicros": cpcMicros, "applied": len(ops), "skipped": len(targets) - len(ops)}
	if percent != 0 {
		details["percent"] = percent
	}
	// best-effort before/after fetch when live mutate
	if !validateOnly {
		if before == nil {
			before, _ = e.fetchCriterionCPC(ctx, targets)
		}
		if before != nil {
			details["before"] = before
		}
		res, err := e.mutate(ctx, ops, false)
		if err != nil {
			return Result{Success: false, Message: res.Message, Details: details}, err
		}
		after, _ := e.fetchCriterionCPC(ctx, targets)
		if after != nil {
			details["after"] = after
		}
		return Result{Success: true, Message: "mutate ok", Details: details}, nil
	}
	res, err := e.mutate(ctx, ops, true)
	res.Details = details
	return res, err
}

func (e *Executor) adjustBudget(ctx context.Context, a Action) (Result, error) {
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	// params.campaignBudgetResourceNames: []string, params.amountMicros: int64
	var targets []string
	if v, ok := a.Params["campaignBudgetResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok := it.(string); ok && strings.TrimSpace(s) != "" {
				targets = append(targets, s)
			}
		}
	}
	if len(targets) == 0 {
		return Result{Success: true, Message: "validateOnly mutate skipped: no budgets"}, nil
	}
	amt := int64(0)
	percent := 0.0
	switch vv := a.Params["amountMicros"].(type) {
	case float64:
		amt = int64(vv)
	case int64:
		amt = vv
	case int:
		amt = int64(vv)
	}
	// Allow dailyBudget (units) as alternative; convert to micros
	if amt <= 0 {
		switch dv := a.Params["dailyBudget"].(type) {
		case float64:
			amt = int64(dv * 1_000_000.0)
		case int:
			amt = int64(float64(dv) * 1_000_000.0)
		case int64:
			amt = dv * 1_000_000
		}
	}
	if p, ok := a.Params["percent"].(float64); ok {
		percent = p
	}
	if amt <= 0 && percent == 0 {
		return Result{Success: true, Message: "validateOnly mutate skipped: amountMicros/percent missing"}, nil
	}
	ops := make([]map[string]any, 0, len(targets))
	var before map[string]int64
	var _ = before
	if percent != 0 {
		bm, _ := e.fetchBudgetAmounts(ctx, targets)
		before = bm
		for _, rn := range targets {
			cur := bm[rn]
			if cur <= 0 {
				continue
			}
			nv := int64(float64(cur) * (1.0 + percent/100.0))
			if nv == cur {
				continue
			}
			upd := map[string]any{"resourceName": rn, "amountMicros": nv}
			ops = append(ops, map[string]any{"campaignBudgetOperation": map[string]any{"update": upd, "updateMask": "amount_micros"}})
		}
	} else {
		for _, rn := range targets {
			if before == nil {
				bm, _ := e.fetchBudgetAmounts(ctx, []string{rn})
				before = bm
			}
			if before != nil {
				if cur, ok := before[rn]; ok && cur == amt {
					continue
				}
			}
			upd := map[string]any{"resourceName": rn, "amountMicros": amt}
			ops = append(ops, map[string]any{"campaignBudgetOperation": map[string]any{"update": upd, "updateMask": "amount_micros"}})
		}
	}
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	details := map[string]any{"targets": targets, "amountMicros": amt, "applied": len(ops), "skipped": len(targets) - len(ops)}
	if percent != 0 {
		details["percent"] = percent
	}
	if !validateOnly {
		if before == nil {
			before, _ = e.fetchBudgetAmounts(ctx, targets)
		}
		if before != nil {
			details["before"] = before
		}
		res, err := e.mutate(ctx, ops, false)
		if err != nil {
			return Result{Success: false, Message: res.Message, Details: details}, err
		}
		after, _ := e.fetchBudgetAmounts(ctx, targets)
		if after != nil {
			details["after"] = after
		}
		return Result{Success: true, Message: "mutate ok", Details: details}, nil
	}
	res, err := e.mutate(ctx, ops, true)
	res.Details = details
	return res, err
}

// rotateLink uses stub path (browser-exec) until mutate path implemented.
func (e *Executor) rotateLink(ctx context.Context, a Action) (Result, error) {
	// Determine suffix
	suffix := ""
	if s, ok := a.Params["finalUrlSuffix"].(string); ok {
		suffix = strings.TrimSpace(s)
	}
	// If suffix not provided, try resolve via browser-exec using links/targetDomain
	if suffix == "" {
		var url string
		if v, ok := a.Params["links"].([]interface{}); ok && len(v) > 0 {
			if s0, ok2 := v[0].(string); ok2 {
				url = strings.TrimSpace(s0)
			}
		}
		if url == "" {
			if s0, ok := a.Params["targetDomain"].(string); ok {
				url = strings.TrimSpace(s0)
			}
		}
		if url != "" && strings.TrimSpace(e.cfg.BrowserExecURL) != "" {
			be := strings.TrimRight(e.cfg.BrowserExecURL, "/")
			body := map[string]interface{}{"url": url, "timeoutMs": int(e.cfg.Timeout / time.Millisecond)}
			hdr := map[string]string{}
			if e.cfg.InternalToken != "" {
				hdr["Authorization"] = "Bearer " + e.cfg.InternalToken
			}
			out := map[string]interface{}{}
			if err := e.http.DoJSON(ctx, http.MethodPost, be+"/api/v1/browser/resolve-offer", body, hdr, 1, &out); err == nil {
				if v, ok := out["finalUrlSuffix"].(string); ok {
					suffix = strings.TrimSpace(v)
				}
			}
		}
		if suffix == "" {
			suffix = time.Now().UTC().Format("20060102150405")
		}
	}
	// Targets: adGroupAd resource names
	var targets []string
	if v, ok := a.Params["adResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok2 := it.(string); ok2 && strings.TrimSpace(s) != "" {
				targets = append(targets, s)
			}
		}
	}
	details := map[string]any{"suffix": suffix, "targets": targets}
	if len(targets) == 0 {
		return Result{Success: true, Message: "validateOnly mutate skipped: no targets", Details: details}, nil
	}
	// Build operations
	ops := make([]map[string]any, 0, len(targets))
	// Skip if already equals desired suffix
	curMap, _ := e.fetchAdFinalSuffix(ctx, targets)
	for _, rn := range targets {
		if curMap != nil {
			if cur, ok := curMap[rn]; ok && strings.TrimSpace(cur) == suffix {
				continue
			}
		}
		upd := map[string]any{"resourceName": rn, "ad": map[string]any{"finalUrlSuffix": suffix}}
		ops = append(ops, map[string]any{"adGroupAdOperation": map[string]any{"update": upd, "updateMask": "ad.final_url_suffix"}})
	}
	details["applied"] = len(ops)
	details["skipped"] = len(targets) - len(ops)
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	if !validateOnly {
		before, _ := e.fetchAdFinalSuffix(ctx, targets)
		if before != nil {
			details["before"] = before
		}
		res, err := e.mutate(ctx, ops, false)
		if err != nil {
			return Result{Success: false, Message: res.Message, Details: details}, err
		}
		after, _ := e.fetchAdFinalSuffix(ctx, targets)
		if after != nil {
			details["after"] = after
		}
		return Result{Success: true, Message: "mutate ok", Details: details}, nil
	}
	res, err := e.mutate(ctx, ops, true)
	res.Details = details
	return res, err
}

func (e *Executor) mutate(ctx context.Context, ops []map[string]any, validateOnly bool) (Result, error) {
	if len(ops) == 0 {
		return Result{Success: true, Message: "no-op"}, nil
	}
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:mutate", e.cfg.CustomerID)
	body := map[string]any{"validateOnly": validateOnly, "mutateOperations": ops}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	hdr, err := e.authHeaders(ctx)
	if err != nil {
		return Result{Success: false, Message: err.Error()}, err
	}
	req.Header = hdr
	resp, err := e.http.DoRaw(req)
	if err != nil {
		return Result{Success: false, Message: err.Error()}, err
	}
	defer resp.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	if resp.StatusCode >= 400 {
		return Result{Success: false, Message: fmt.Sprintf("mutate http %d", resp.StatusCode), Details: out}, errors.New("mutate failed")
	}
	return Result{Success: true, Message: "validateOnly mutate ok", Details: out}, nil
}

func (e *Executor) fetchCriterionCPC(ctx context.Context, rns []string) (map[string]int64, error) {
	if len(rns) == 0 {
		return nil, nil
	}
	// Build IN clause for GAQL
	b := strings.Builder{}
	b.WriteString("SELECT ad_group_criterion.resource_name, ad_group_criterion.cpc_bid_micros FROM ad_group_criterion WHERE ad_group_criterion.resource_name IN (")
	for i, rn := range rns {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") LIMIT ")
	b.WriteString(fmt.Sprintf("%d", len(rns)))
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return nil, err
	}
	out := map[string]int64{}
	for _, row := range rows {
		if res, ok := row["adGroupCriterion"].(map[string]any); ok {
			rn, _ := res["resourceName"].(string)
			switch v := res["cpcBidMicros"].(type) {
			case float64:
				out[rn] = int64(v)
			case int64:
				out[rn] = v
			}
		}
	}
	return out, nil
}

func (e *Executor) fetchBudgetAmounts(ctx context.Context, rns []string) (map[string]int64, error) {
	if len(rns) == 0 {
		return nil, nil
	}
	b := strings.Builder{}
	b.WriteString("SELECT campaign_budget.resource_name, campaign_budget.amount_micros FROM campaign_budget WHERE campaign_budget.resource_name IN (")
	for i, rn := range rns {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") LIMIT ")
	b.WriteString(fmt.Sprintf("%d", len(rns)))
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return nil, err
	}
	out := map[string]int64{}
	for _, row := range rows {
		if res, ok := row["campaignBudget"].(map[string]any); ok {
			rn, _ := res["resourceName"].(string)
			switch v := res["amountMicros"].(type) {
			case float64:
				out[rn] = int64(v)
			case int64:
				out[rn] = v
			}
		}
	}
	return out, nil
}

func (e *Executor) searchStream(ctx context.Context, query string) ([]map[string]any, error) {
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", e.cfg.CustomerID)
	body := map[string]any{"query": query}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	hdr, err := e.authHeaders(ctx)
	if err != nil {
		return nil, err
	}
	req.Header = hdr
	resp, err := e.http.DoRaw(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("searchStream http %d", resp.StatusCode)
	}
	// searchStream returns JSON array of chunks
	var arr []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&arr); err != nil {
		return nil, err
	}
	rows := make([]map[string]any, 0, len(arr))
	for _, chunk := range arr {
		if results, ok := chunk["results"].([]any); ok {
			for _, r := range results {
				if m, ok := r.(map[string]any); ok {
					rows = append(rows, m)
				}
			}
		}
	}
	return rows, nil
}

func (e *Executor) fetchAdFinalSuffix(ctx context.Context, rns []string) (map[string]string, error) {
	if len(rns) == 0 {
		return nil, nil
	}
	b := strings.Builder{}
	b.WriteString("SELECT ad_group_ad.resource_name, ad.final_url_suffix FROM ad_group_ad WHERE ad_group_ad.resource_name IN (")
	for i, rn := range rns {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") LIMIT ")
	b.WriteString(fmt.Sprintf("%d", len(rns)))
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for _, row := range rows {
		if res, ok := row["adGroupAd"].(map[string]any); ok {
			rn, _ := res["resourceName"].(string)
			if ad, ok2 := row["ad"].(map[string]any); ok2 {
				if s, ok3 := ad["finalUrlSuffix"].(string); ok3 {
					out[rn] = s
				}
			}
		}
	}
	return out, nil
}

// --- Status helpers (ads/adgroups/campaigns) ---
func (e *Executor) fetchAdStatus(ctx context.Context, rns []string) (map[string]string, error) {
	if len(rns) == 0 {
		return nil, nil
	}
	b := strings.Builder{}
	b.WriteString("SELECT ad_group_ad.resource_name, ad_group_ad.status FROM ad_group_ad WHERE ad_group_ad.resource_name IN (")
	for i, rn := range rns {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") LIMIT ")
	b.WriteString(fmt.Sprintf("%d", len(rns)))
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for _, row := range rows {
		if aga, ok := row["adGroupAd"].(map[string]any); ok {
			rn, _ := aga["resourceName"].(string)
			if s, ok2 := aga["status"].(string); ok2 {
				out[rn] = s
			}
		}
	}
	return out, nil
}

func (e *Executor) fetchAdGroupStatus(ctx context.Context, rns []string) (map[string]string, error) {
	if len(rns) == 0 {
		return nil, nil
	}
	b := strings.Builder{}
	b.WriteString("SELECT ad_group.resource_name, ad_group.status FROM ad_group WHERE ad_group.resource_name IN (")
	for i, rn := range rns {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") LIMIT ")
	b.WriteString(fmt.Sprintf("%d", len(rns)))
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for _, row := range rows {
		if ag, ok := row["adGroup"].(map[string]any); ok {
			rn, _ := ag["resourceName"].(string)
			if s, ok2 := ag["status"].(string); ok2 {
				out[rn] = s
			}
		}
	}
	return out, nil
}

func (e *Executor) fetchCampaignStatus(ctx context.Context, rns []string) (map[string]string, error) {
	if len(rns) == 0 {
		return nil, nil
	}
	b := strings.Builder{}
	b.WriteString("SELECT campaign.resource_name, campaign.status FROM campaign WHERE campaign.resource_name IN (")
	for i, rn := range rns {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") LIMIT ")
	b.WriteString(fmt.Sprintf("%d", len(rns)))
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for _, row := range rows {
		if camp, ok := row["campaign"].(map[string]any); ok {
			rn, _ := camp["resourceName"].(string)
			if s, ok2 := camp["status"].(string); ok2 {
				out[rn] = s
			}
		}
	}
	return out, nil
}

// --- Bidding targets (tCPA/tROAS) ---
func (e *Executor) fetchCampaignCPA(ctx context.Context, rns []string) (map[string]int64, error) {
	if len(rns) == 0 {
		return nil, nil
	}
	b := strings.Builder{}
	b.WriteString("SELECT campaign.resource_name, campaign.target_cpa.target_cpa_micros FROM campaign WHERE campaign.resource_name IN (")
	for i, rn := range rns {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") LIMIT ")
	b.WriteString(fmt.Sprintf("%d", len(rns)))
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return nil, err
	}
	out := map[string]int64{}
	for _, row := range rows {
		if camp, ok := row["campaign"].(map[string]any); ok {
			rn, _ := camp["resourceName"].(string)
			if tca, ok2 := camp["targetCpa"].(map[string]any); ok2 {
				switch v := tca["targetCpaMicros"].(type) {
				case float64:
					out[rn] = int64(v)
				case int64:
					out[rn] = v
				case int:
					out[rn] = int64(v)
				}
			}
		}
	}
	return out, nil
}

func (e *Executor) fetchCampaignROAS(ctx context.Context, rns []string) (map[string]float64, error) {
	if len(rns) == 0 {
		return nil, nil
	}
	b := strings.Builder{}
	b.WriteString("SELECT campaign.resource_name, campaign.target_roas FROM campaign WHERE campaign.resource_name IN (")
	for i, rn := range rns {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") LIMIT ")
	b.WriteString(fmt.Sprintf("%d", len(rns)))
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return nil, err
	}
	out := map[string]float64{}
	for _, row := range rows {
		if camp, ok := row["campaign"].(map[string]any); ok {
			rn, _ := camp["resourceName"].(string)
			switch v := camp["targetRoas"].(type) {
			case float64:
				out[rn] = v
			case int:
				out[rn] = float64(v)
			case int64:
				out[rn] = float64(v)
			}
		}
	}
	return out, nil
}

// Params: campaignResourceNames []string, targetCpaMicros int64 | percent float64
func (e *Executor) setTargetCPA(ctx context.Context, a Action) (Result, error) {
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	var targets []string
	if v, ok := a.Params["campaignResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok2 := it.(string); ok2 && strings.TrimSpace(s) != "" {
				targets = append(targets, s)
			}
		}
	}
	if len(targets) == 0 {
		return Result{Success: true, Message: "no campaigns"}, nil
	}
	amt := int64(0)
	switch vv := a.Params["targetCpaMicros"].(type) {
	case float64:
		amt = int64(vv)
	case int64:
		amt = vv
	case int:
		amt = int64(vv)
	}
	percent := 0.0
	if p, ok := a.Params["percent"].(float64); ok {
		percent = p
	}
	cur, _ := e.fetchCampaignCPA(ctx, targets)
	ops := []map[string]any{}
	for _, rn := range targets {
		newv := amt
		if newv <= 0 && percent != 0 {
			if c := cur[rn]; c > 0 {
				newv = int64(float64(c) * (1.0 + percent/100.0))
			}
		}
		if newv <= 0 {
			continue
		}
		if c := cur[rn]; c == newv {
			continue
		}
		upd := map[string]any{"resourceName": rn, "targetCpa": map[string]any{"targetCpaMicros": newv}}
		ops = append(ops, map[string]any{"campaignOperation": map[string]any{"update": upd, "updateMask": "target_cpa.target_cpa_micros"}})
	}
	details := map[string]any{"targets": targets, "applied": len(ops), "skipped": len(targets) - len(ops)}
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	if !validateOnly {
		details["before"] = cur
	}
	res, err := e.mutate(ctx, ops, validateOnly)
	if !validateOnly {
		after, _ := e.fetchCampaignCPA(ctx, targets)
		details["after"] = after
	}
	if res.Details == nil {
		res.Details = map[string]any{}
	}
	for k, v := range details {
		res.Details[k] = v
	}
	if len(ops) == 0 {
		res.Success = true
		if res.Message == "" {
			res.Message = "no-op"
		}
	}
	return res, err
}

// Params: campaignResourceNames []string, targetRoas float64 | percent float64
func (e *Executor) setTargetROAS(ctx context.Context, a Action) (Result, error) {
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	var targets []string
	if v, ok := a.Params["campaignResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok2 := it.(string); ok2 && strings.TrimSpace(s) != "" {
				targets = append(targets, s)
			}
		}
	}
	if len(targets) == 0 {
		return Result{Success: true, Message: "no campaigns"}, nil
	}
	roas := 0.0
	if p, ok := a.Params["targetRoas"].(float64); ok {
		roas = p
	}
	percent := 0.0
	if p, ok := a.Params["percent"].(float64); ok {
		percent = p
	}
	cur, _ := e.fetchCampaignROAS(ctx, targets)
	ops := []map[string]any{}
	for _, rn := range targets {
		newv := roas
		if newv <= 0 && percent != 0 {
			if c := cur[rn]; c > 0 {
				newv = c * (1.0 + percent/100.0)
			}
		}
		if newv <= 0 {
			continue
		}
		if c := cur[rn]; c == newv {
			continue
		}
		upd := map[string]any{"resourceName": rn, "targetRoas": newv}
		ops = append(ops, map[string]any{"campaignOperation": map[string]any{"update": upd, "updateMask": "target_roas"}})
	}
	details := map[string]any{"targets": targets, "applied": len(ops), "skipped": len(targets) - len(ops)}
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	if !validateOnly {
		details["before"] = cur
	}
	res, err := e.mutate(ctx, ops, validateOnly)
	if !validateOnly {
		after, _ := e.fetchCampaignROAS(ctx, targets)
		details["after"] = after
	}
	if res.Details == nil {
		res.Details = map[string]any{}
	}
	for k, v := range details {
		res.Details[k] = v
	}
	if len(ops) == 0 {
		res.Success = true
		if res.Message == "" {
			res.Message = "no-op"
		}
	}
	return res, err
}

func (e *Executor) setAdsStatus(ctx context.Context, a Action, status string) (Result, error) {
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	var targets []string
	if v, ok := a.Params["adResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok := it.(string); ok && strings.TrimSpace(s) != "" {
				targets = append(targets, s)
			}
		}
	}
	if len(targets) == 0 {
		return Result{Success: true, Message: "no targets"}, nil
	}
	ops := make([]map[string]any, 0, len(targets))
	// Skip no-op updates
	curMap, _ := e.fetchAdStatus(ctx, targets)
	for _, rn := range targets {
		if curMap != nil {
			if cur, ok := curMap[rn]; ok && strings.EqualFold(cur, status) {
				continue
			}
		}
		upd := map[string]any{"resourceName": rn, "status": status}
		ops = append(ops, map[string]any{"adGroupAdOperation": map[string]any{"update": upd, "updateMask": "status"}})
	}
	details := map[string]any{"targets": targets, "status": status, "applied": len(ops), "skipped": len(targets) - len(ops)}
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	if !validateOnly {
		if before, _ := e.fetchAdStatus(ctx, targets); before != nil {
			details["before"] = before
		}
	}
	res, err := e.mutate(ctx, ops, validateOnly)
	if !validateOnly {
		if after, _ := e.fetchAdStatus(ctx, targets); after != nil {
			details["after"] = after
		}
	}
	res.Details = details
	return res, err
}

func (e *Executor) setAdGroupsStatus(ctx context.Context, a Action, status string) (Result, error) {
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	var targets []string
	if v, ok := a.Params["adGroupResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok := it.(string); ok && strings.TrimSpace(s) != "" {
				targets = append(targets, s)
			}
		}
	}
	if len(targets) == 0 {
		return Result{Success: true, Message: "no targets"}, nil
	}
	ops := make([]map[string]any, 0, len(targets))
	curMap, _ := e.fetchAdGroupStatus(ctx, targets)
	for _, rn := range targets {
		if curMap != nil {
			if cur, ok := curMap[rn]; ok && strings.EqualFold(cur, status) {
				continue
			}
		}
		upd := map[string]any{"resourceName": rn, "status": status}
		ops = append(ops, map[string]any{"adGroupOperation": map[string]any{"update": upd, "updateMask": "status"}})
	}
	details := map[string]any{"targets": targets, "status": status, "applied": len(ops), "skipped": len(targets) - len(ops)}
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	if !validateOnly {
		if before, _ := e.fetchAdGroupStatus(ctx, targets); before != nil {
			details["before"] = before
		}
	}
	res, err := e.mutate(ctx, ops, validateOnly)
	if !validateOnly {
		if after, _ := e.fetchAdGroupStatus(ctx, targets); after != nil {
			details["after"] = after
		}
	}
	res.Details = details
	return res, err
}

func (e *Executor) setCampaignsStatus(ctx context.Context, a Action, status string) (Result, error) {
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	var targets []string
	if v, ok := a.Params["campaignResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok := it.(string); ok && strings.TrimSpace(s) != "" {
				targets = append(targets, s)
			}
		}
	}
	if len(targets) == 0 {
		return Result{Success: true, Message: "no targets"}, nil
	}
	ops := make([]map[string]any, 0, len(targets))
	curMap, _ := e.fetchCampaignStatus(ctx, targets)
	for _, rn := range targets {
		if curMap != nil {
			if cur, ok := curMap[rn]; ok && strings.EqualFold(cur, status) {
				continue
			}
		}
		upd := map[string]any{"resourceName": rn, "status": status}
		ops = append(ops, map[string]any{"campaignOperation": map[string]any{"update": upd, "updateMask": "status"}})
	}
	details := map[string]any{"targets": targets, "status": status, "applied": len(ops), "skipped": len(targets) - len(ops)}
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	if !validateOnly {
		if before, _ := e.fetchCampaignStatus(ctx, targets); before != nil {
			details["before"] = before
		}
	}
	res, err := e.mutate(ctx, ops, validateOnly)
	if !validateOnly {
		if after, _ := e.fetchCampaignStatus(ctx, targets); after != nil {
			details["after"] = after
		}
	}
	res.Details = details
	return res, err
}

// setKeywordsStatus updates ad_group_criterion.status for provided keyword criterion resource names.
// Params: criterionResourceNames []string
func (e *Executor) setKeywordsStatus(ctx context.Context, a Action, status string) (Result, error) {
	if e.cfg.DeveloperToken == "" || e.cfg.OAuthClientID == "" || e.cfg.OAuthClientSecret == "" || e.cfg.RefreshToken == "" || e.cfg.CustomerID == "" {
		return Result{Success: false, Message: "missing ads credentials/customerId"}, errors.New("missing ads credentials/customerId")
	}
	var targets []string
	if v, ok := a.Params["criterionResourceNames"].([]interface{}); ok {
		for _, it := range v {
			if s, ok := it.(string); ok && strings.TrimSpace(s) != "" {
				targets = append(targets, s)
			}
		}
	}
	if len(targets) == 0 {
		return Result{Success: true, Message: "no targets"}, nil
	}
	ops := make([]map[string]any, 0, len(targets))
	curMap, _ := e.fetchKeywordStatus(ctx, targets)
	for _, rn := range targets {
		if curMap != nil {
			if cur, ok := curMap[rn]; ok && strings.EqualFold(cur, status) {
				continue
			}
		}
		upd := map[string]any{"resourceName": rn, "status": status}
		ops = append(ops, map[string]any{"adGroupCriterionOperation": map[string]any{"update": upd, "updateMask": "status"}})
	}
	details := map[string]any{"targets": targets, "status": status, "applied": len(ops), "skipped": len(targets) - len(ops)}
	validateOnly := !e.cfg.LiveMutate || e.cfg.ValidateOnly
	if !validateOnly {
		if before, _ := e.fetchKeywordStatus(ctx, targets); before != nil {
			details["before"] = before
		}
	}
	res, err := e.mutate(ctx, ops, validateOnly)
	if !validateOnly {
		if after, _ := e.fetchKeywordStatus(ctx, targets); after != nil {
			details["after"] = after
		}
	}
	res.Details = details
	return res, err
}

func (e *Executor) fetchKeywordStatus(ctx context.Context, rns []string) (map[string]string, error) {
	if len(rns) == 0 {
		return nil, nil
	}
	b := strings.Builder{}
	b.WriteString("SELECT ad_group_criterion.resource_name, ad_group_criterion.status FROM ad_group_criterion WHERE ad_group_criterion.resource_name IN (")
	for i, rn := range rns {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString("'" + rn + "'")
	}
	b.WriteString(") LIMIT ")
	b.WriteString(fmt.Sprintf("%d", len(rns)))
	rows, err := e.searchStream(ctx, b.String())
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for _, row := range rows {
		if kw, ok := row["adGroupCriterion"].(map[string]any); ok {
			rn, _ := kw["resourceName"].(string)
			if s, ok2 := kw["status"].(string); ok2 {
				out[rn] = s
			}
		}
	}
	return out, nil
}
