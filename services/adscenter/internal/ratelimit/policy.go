package ratelimit

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"sync"
	"time"

	cfgpkg "github.com/ScientificInternet/Google-Monetize/pkg/config"
)

// Policy defines per-plan, per-action rate configs with global defaults.
type Policy struct {
	Defaults struct {
		Global  RateLimit            `json:"global"`
		Actions map[string]RateLimit `json:"actions"`
		Quotas  Quotas               `json:"quotas"`
	} `json:"defaults"`
	Plans         map[string]PlanEntry `json:"plans"`
	MaxKeys       int                  `json:"maxKeys"`
	KeyTTLSeconds int                  `json:"keyTTLSeconds"`
}

type RateLimit struct {
	RPM         int `json:"rpm"`
	Concurrency int `json:"concurrency"`
}

type PlanEntry struct {
	Global  *RateLimit           `json:"global,omitempty"`
	Actions map[string]RateLimit `json:"actions,omitempty"`
	Quotas  *Quotas              `json:"quotas,omitempty"`
}

// Quotas defines per-plan quota caps.
type Quotas struct {
	Daily int `json:"daily"` // per-day operations hard cap (0=unlimited)
}

var (
	polOnce sync.Once
	polVal  *Policy
)

// LoadPolicy loads policy from Secret Manager or env JSON, caches in-process for 5 minutes.
func LoadPolicy(ctx context.Context) *Policy {
	polOnce.Do(func() {
		polVal = &Policy{}
		// defaults
		polVal.Defaults.Global = RateLimit{RPM: 60, Concurrency: 4}
		polVal.Defaults.Actions = map[string]RateLimit{
			"preflight": {RPM: 60, Concurrency: 4},
			"mutate":    {RPM: 30, Concurrency: 2},
			"diagnose":  {RPM: 30, Concurrency: 2},
			"mcc":       {RPM: 10, Concurrency: 1},
		}
		polVal.Defaults.Quotas = Quotas{Daily: 1000}
		polVal.Plans = map[string]PlanEntry{}
		polVal.MaxKeys = 1000
		polVal.KeyTTLSeconds = 3600
		// attempt secret
		name := strings.TrimSpace(os.Getenv("ADSCENTER_LIMITS_SECRET"))
		if name != "" {
			if s, err := cfgpkg.SecretCached(ctx, name, 5*time.Minute); err == nil && strings.TrimSpace(s) != "" {
				_ = json.Unmarshal([]byte(s), polVal)
				return
			}
		}
		// fallback env JSON
		if js := strings.TrimSpace(os.Getenv("ADSCENTER_LIMITS_JSON")); js != "" {
			_ = json.Unmarshal([]byte(js), polVal)
		}
	})
	return polVal
}

// For returns the rate limit for a plan and action.
func (p *Policy) For(plan, action string) RateLimit {
	if p == nil {
		return RateLimit{RPM: 60, Concurrency: 4}
	}
	// plan override
	if pl, ok := p.Plans[plan]; ok {
		if pl.Actions != nil {
			if rl, ok2 := pl.Actions[action]; ok2 {
				return rl
			}
		}
		if pl.Global != nil {
			return *pl.Global
		}
	}
	// defaults
	if rl, ok := p.Defaults.Actions[action]; ok {
		return rl
	}
	return p.Defaults.Global
}

// QuotaDailyFor returns the daily quota for the plan (0 = unlimited).
func (p *Policy) QuotaDailyFor(plan string) int {
	if p == nil {
		return 0
	}
	if pl, ok := p.Plans[plan]; ok && pl.Quotas != nil {
		if pl.Quotas.Daily > 0 {
			return pl.Quotas.Daily
		}
	}
	if p.Defaults.Quotas.Daily > 0 {
		return p.Defaults.Quotas.Daily
	}
	return 0
}
