//go:build !ads_live

package executor

import (
	"context"
	"errors"
	httpx "github.com/ScientificInternet/Google-Monetize/pkg/http"
	"net/http"
	"strings"
	"time"
)

// Action represents a single bulk action unit.
type Action struct {
	Type   string                 `json:"type"`
	Params map[string]interface{} `json:"params,omitempty"`
	Filter map[string]interface{} `json:"filter,omitempty"`
}

// Result captures execution outcome and structured details.
type Result struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message,omitempty"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// Config configures the executor behavior.
type Config struct {
	BrowserExecURL string
	InternalToken  string
	Timeout        time.Duration
	ValidateOnly   bool
	LiveMutate     bool
	// Ads credentials (ignored in stub; used in ads_live build)
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
		cfg.Timeout = 5 * time.Second
	}
	return &Executor{cfg: cfg, http: httpx.New(cfg.Timeout)}
}

// ExecuteOne performs a single action. This is a minimal stub implementation:
// - ADJUST_CPC / ADJUST_BUDGET: simulate success and echo parameters
// - ROTATE_LINK: call browser-exec /resolve-offer for first link/target and produce suffix details
func (e *Executor) ExecuteOne(ctx context.Context, a Action) (Result, error) {
	t := strings.ToUpper(strings.TrimSpace(a.Type))
	switch t {
	case "ADJUST_CPC":
		if e.cfg.ValidateOnly {
			return Result{Success: true, Message: "validateOnly"}, nil
		}
		det := map[string]interface{}{}
		for k, v := range a.Params {
			det[k] = v
		}
		return Result{Success: true, Message: "cpc adjusted (stub)", Details: det}, nil
	case "ADJUST_BUDGET":
		if e.cfg.ValidateOnly {
			return Result{Success: true, Message: "validateOnly"}, nil
		}
		det := map[string]interface{}{}
		for k, v := range a.Params {
			det[k] = v
		}
		return Result{Success: true, Message: "budget adjusted (stub)", Details: det}, nil
	case "ROTATE_LINK":
		return e.rotateLink(ctx, a)
	default:
		return Result{Success: false, Message: "unsupported action"}, errors.New("unsupported action")
	}
}

func (e *Executor) rotateLink(ctx context.Context, a Action) (Result, error) {
	// Determine a candidate URL or domain
	var url string
	if v, ok := a.Params["links"].([]interface{}); ok && len(v) > 0 {
		if s, ok2 := v[0].(string); ok2 {
			url = strings.TrimSpace(s)
		}
	}
	if url == "" {
		if s, ok := a.Params["targetDomain"].(string); ok {
			url = strings.TrimSpace(s)
		}
	}
	if url == "" {
		return Result{Success: false, Message: "links/targetDomain missing"}, errors.New("rotate_link: links/targetDomain missing")
	}
	if e.cfg.ValidateOnly {
		return Result{Success: true, Message: "validateOnly", Details: map[string]interface{}{"target": url}}, nil
	}
	// best-effort call browser-exec /resolve-offer
	be := strings.TrimRight(e.cfg.BrowserExecURL, "/")
	if be == "" {
		// fallback simulate suffix
		return Result{Success: true, Message: "rotated (stub)", Details: map[string]interface{}{"target": url, "finalUrlSuffix": time.Now().UTC().Format("20060102150405")}}, nil
	}
	body := map[string]interface{}{"url": url, "timeoutMs": int(e.cfg.Timeout / time.Millisecond)}
	hdr := map[string]string{}
	if e.cfg.InternalToken != "" {
		hdr["Authorization"] = "Bearer " + e.cfg.InternalToken
	}
	out := map[string]interface{}{}
	if err := e.http.DoJSON(ctx, http.MethodPost, be+"/api/v1/browser/resolve-offer", body, hdr, 1, &out); err != nil {
		return Result{Success: false, Message: err.Error()}, err
	}
	return Result{Success: true, Message: "rotated (resolved)", Details: out}, nil
}
