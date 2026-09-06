package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	httpx "github.com/ScientificInternet/Google-Monetize/pkg/http"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	rlredis "github.com/ScientificInternet/Google-Monetize/pkg/ratelimitredis"
	adsstub "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ads"
	adscfg "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/preflight"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ratelimit"
)

// PreflightRequest represents the request for preflight checks
type PreflightRequest struct {
	AccountID    string `json:"accountId"`
	ValidateOnly bool   `json:"validateOnly"`
	LandingURL   string `json:"landingUrl"`
}

// PreflightCheck represents a single preflight check result (backward-compatible)
type PreflightCheck struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Detail string `json:"detail,omitempty"`
}

// PreflightResponse is the legacy response format
type PreflightResponse struct {
	Summary         string           `json:"summary"`
	Checks          []PreflightCheck `json:"checks"`
	Mode            string           `json:"mode"`
	GoogleValidated bool             `json:"googleValidated"`
}

type preflightCache struct {
	val PreflightResponse
	exp time.Time
}

// PreflightHandler handles preflight check requests
type PreflightHandler struct {
	DB   *sql.DB
	RC   *pcache.Cache
	pc   map[string]preflightCache
	pcMu sync.RWMutex
}

// NewPreflightHandler creates a new preflight handler
func NewPreflightHandler(db *sql.DB, rc *pcache.Cache) *PreflightHandler {
	return &PreflightHandler{
		DB: db,
		RC: rc,
		pc: make(map[string]preflightCache),
	}
}

// HandlePreflight processes preflight check requests
// POST /api/v1/adscenter/preflight
func (h *PreflightHandler) HandlePreflight(w http.ResponseWriter, r *http.Request) {
	// Require authenticated user
	uidRaw := r.Context().Value(middleware.UserIDKey)
	uid, _ := uidRaw.(string)
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

	var req PreflightRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiErr := apierrors.InvalidRequest("param", "Invalid request body")
		apiErr.WriteJSON(w, r)
		return
	}

	ctx := r.Context()
	creds, credsErr := adscfg.LoadAdsCreds(ctx)
	flags := adscfg.LoadPrecheckFlags()
	if !req.ValidateOnly {
		if !flags.EnableLive {
			writeExecutionUnavailable(w, r, "Live Google Ads preflight is disabled; use validateOnly for local configuration checks")
			return
		}
		creds, credsErr = loadUserAdsCredentials(ctx, h.DB, uid)
		if credsErr != nil {
			apierrors.InvalidRequest("credentials", "Google Ads credentials unavailable").WriteJSON(w, r)
			return
		}
		if strings.TrimSpace(req.AccountID) == "" {
			apierrors.InvalidRequest("accountId", "explicit target account is required").WriteJSON(w, r)
			return
		}
	}

	if credsErr != nil || creds == nil {
		apierrors.InternalError("Google Ads configuration could not be loaded").WriteJSON(w, r)
		return
	}

	// Optional live client
	var client preflight.LiveClient
	if flags.EnableLive && !req.ValidateOnly {
		baseClient, err := adsstub.NewClient(r.Context(), adsstub.LiveConfig{
			DeveloperToken:    creds.DeveloperToken,
			OAuthClientID:     creds.OAuthClientID,
			OAuthClientSecret: creds.OAuthClientSecret,
			RefreshToken:      creds.RefreshToken,
			LoginCustomerID:   creds.LoginCustomerID,
			CustomerID:        req.AccountID,
		})
		if err != nil {
			writeExecutionUnavailable(w, r, "Live Google Ads preflight client is unavailable")
			return
		}
		client = preflight.WrapWithThrottle(baseClient)
	}

	// Short cache by user + account
	cacheKey := "truthful-v1:" + uid + ":" + req.AccountID + ":vo=" + func() string {
		if req.ValidateOnly {
			return "1"
		}
		return "0"
	}()

	// Cross-instance cache (Redis if available)
	if h.RC != nil && h.RC.Ready() {
		if txt, ok := h.RC.Get(ctx, "ac:preflight:"+cacheKey); ok {
			var legacy PreflightResponse
			if err := json.Unmarshal([]byte(txt), &legacy); err == nil {
				writeJSON(w, http.StatusOK, legacy)
				return
			}
		}
	}

	h.pcMu.RLock()
	if ent, ok := h.pc[cacheKey]; ok && time.Now().Before(ent.exp) {
		h.pcMu.RUnlock()
		writeJSON(w, http.StatusOK, ent.val)
		return
	}
	h.pcMu.RUnlock()

	// Per-user/plan/action rate limiting (LIVE path only)
	if client != nil {
		plan := ratelimit.ResolveUserPlan(r)
		pol := ratelimit.LoadPolicy(r.Context())
		rl := pol.For(plan, "preflight")
		key := uid + ":preflight"
		if strings.TrimSpace(req.AccountID) != "" {
			key += ":" + strings.TrimSpace(req.AccountID)
		}

		// Cross-instance RPM gate via Redis (best-effort)
		if h.RC != nil && h.RC.Ready() && rl.RPM > 0 {
			if rr, _ := rlredis.AllowRPM(r.Context(), h.RC, key, rl.RPM); !rr.Allowed {
				if rr.RetryAfterMs > 0 {
					w.Header().Set("Retry-After", fmt.Sprintf("%d", (rr.RetryAfterMs+999)/1000))
				}
				apiErr := apierrors.RateLimited(int(rr.RetryAfterMs))
				apiErr.WriteJSON(w, r)
				return
			}
		}
		ctx = ratelimit.WithParams(ctx, ratelimit.RateParams{Key: key, RPM: rl.RPM, Concurrency: rl.Concurrency})
	}

	// Run checks with timeout guard
	ctx, cancel := context.WithTimeout(ctx, time.Duration(adscfg.LoadPrecheckFlags().TotalTimeoutMS)*time.Millisecond)
	defer cancel()

	result := preflight.Run(ctx, preflight.EnvInputs{
		DeveloperToken:    creds.DeveloperToken,
		OAuthClientID:     creds.OAuthClientID,
		OAuthClientSecret: creds.OAuthClientSecret,
		RefreshToken:      creds.RefreshToken,
		LoginCustomerID:   creds.LoginCustomerID,
		TestCustomerID:    creds.TestCustomerID,
		AccountID:         req.AccountID,
	}, flags.EnableLive && !req.ValidateOnly, client)

	// Map internal summary (ready|degraded|blocked) -> (ok|warn|error)
	sm := result.Summary
	switch sm {
	case "ready":
		sm = "ok"
	case "degraded":
		sm = "warn"
	case "blocked":
		sm = "error"
	}

	outChecks := make([]map[string]any, 0, len(result.Checks))
	legacyChecks := make([]PreflightCheck, 0, len(result.Checks))

	for _, c := range result.Checks {
		item := map[string]any{
			"code":     c.Code,
			"severity": string(c.Severity),
			"message":  c.Message,
		}
		if c.Details != nil && len(c.Details) > 0 {
			item["details"] = c.Details
		}
		outChecks = append(outChecks, item)

		// legacy for UI cache
		st := string(c.Severity)
		if st == "skip" {
			st = "warn"
		}
		legacyChecks = append(legacyChecks, PreflightCheck{Name: c.Code, Status: st, Detail: c.Message})
	}

	// Optional landing reachability (direct HTTP probe)
	if strings.TrimSpace(req.LandingURL) != "" {
		if c := checkLandingReachability(r.Context(), req.LandingURL); c != nil {
			outChecks = append(outChecks, map[string]any{"code": c.Name, "severity": c.Status, "message": c.Detail})
			legacyChecks = append(legacyChecks, *c)
		}
	}

	mode := "local_checks"
	if client != nil {
		mode = "live_reads"
	}
	resp := map[string]any{"summary": sm, "checks": outChecks, "mode": mode, "googleValidated": false}
	legacy := PreflightResponse{Summary: sm, Checks: legacyChecks, Mode: mode, GoogleValidated: false}

	writeJSON(w, http.StatusOK, resp)

	// Best-effort Firestore UI cache
	_ = writePreflightUI(r.Context(), uid, req.AccountID, legacy)

	// Fill short cache
	ttl := 2 * time.Minute
	if v := strings.TrimSpace(os.Getenv("PREFLIGHT_CACHE_TTL_MS")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			ttl = time.Duration(n) * time.Millisecond
		}
	}

	h.pcMu.Lock()
	if h.pc == nil {
		h.pc = map[string]preflightCache{}
	}
	h.pc[cacheKey] = preflightCache{val: legacy, exp: time.Now().Add(ttl)}
	h.pcMu.Unlock()

	if h.RC != nil && h.RC.Ready() {
		if b, err := json.Marshal(legacy); err == nil {
			h.RC.Set(ctx, "ac:preflight:"+cacheKey, string(b), ttl)
		}
	}
}

// Helper functions

// checkLandingReachability verifies the landing URL responds with a non-error
// status via a direct HTTP GET (no headless browser involved).
func checkLandingReachability(ctx context.Context, url string) *PreflightCheck {
	cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()

	req, err := http.NewRequestWithContext(cctx, http.MethodGet, url, nil)
	if err != nil {
		return &PreflightCheck{Name: "landing.reachability", Status: "warn", Detail: "invalid url"}
	}

	resp, err := httpx.New(1500 * time.Millisecond).DoRaw(req)
	if err != nil {
		return &PreflightCheck{Name: "landing.reachability", Status: "warn", Detail: "unreachable"}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return &PreflightCheck{Name: "landing.reachability", Status: "ok", Detail: "reachable"}
	}

	return &PreflightCheck{Name: "landing.reachability", Status: "warn", Detail: "unreachable or non-2xx"}
}

// writePreflightUI writes preflight results to Firestore for UI cache
func writePreflightUI(ctx context.Context, userID, accountID string, payload PreflightResponse) error {
	if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" {
		return nil
	}

	pid := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
	if pid == "" {
		pid = strings.TrimSpace(os.Getenv("PROJECT_ID"))
	}

	if pid == "" || userID == "" || accountID == "" {
		return nil
	}

	cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()

	cli, err := firestore.NewClient(cctx, pid)
	if err != nil {
		return err
	}
	defer cli.Close()

	doc := map[string]any{
		"accountId": accountID,
		"updatedAt": time.Now().UTC(),
		"summary":   payload.Summary,
		"checks":    payload.Checks,
	}

	_, err = cli.Collection("users/"+userID+"/adscenter/preflight").Doc(accountID).Set(cctx, doc)
	return err
}
