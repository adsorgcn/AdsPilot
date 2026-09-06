//go:build !ads_live

package executor

import (
	"context"
	httpx "github.com/ScientificInternet/Google-Monetize/pkg/http"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ads"
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

// ExecuteOne cannot validate or execute Google Ads operations in a stub build.
func (e *Executor) ExecuteOne(ctx context.Context, a Action) (Result, error) {
	if err := ctx.Err(); err != nil {
		return Result{Success: false, Message: err.Error()}, err
	}
	return Result{Success: false, Message: ads.ErrLiveUnavailable.Error(), Details: map[string]interface{}{
		"mode": "unavailable", "executed": false, "googleValidated": false,
	}}, ads.ErrLiveUnavailable
}
