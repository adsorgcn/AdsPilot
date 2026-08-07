//go:build !ads_live

package executor

import (
	"context"
	"errors"
	httpx "github.com/ScientificInternet/Google-Monetize/pkg/http"
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
	Timeout      time.Duration
	ValidateOnly bool
	LiveMutate   bool
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
	default:
		return Result{Success: false, Message: "unsupported action"}, errors.New("unsupported action")
	}
}
