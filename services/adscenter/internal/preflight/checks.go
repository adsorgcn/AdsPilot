package preflight

import (
	"context"
	"os"
	"regexp"
	"strings"
	"time"
)

type Severity string

const (
	SevOK    Severity = "ok"
	SevWarn  Severity = "warn"
	SevError Severity = "error"
	SevSkip  Severity = "skip"
)

type Check struct {
	Code     string                 `json:"code"`
	Severity Severity               `json:"severity"`
	Message  string                 `json:"message"`
	Skipped  bool                   `json:"skipped,omitempty"`
	Details  map[string]interface{} `json:"details,omitempty"`
}

type Result struct {
	Summary string  `json:"summary"`
	Checks  []Check `json:"checks"`
}

type EnvInputs struct {
	DeveloperToken    string
	OAuthClientID     string
	OAuthClientSecret string
	RefreshToken      string
	LoginCustomerID   string
	TestCustomerID    string
	AccountID         string
}

type LiveClient interface {
	ListAccessibleCustomers(ctx context.Context) ([]string, error)
	AdsAPIPing(ctx context.Context) error
	GetCampaignsCount(ctx context.Context, accountID string) (int, error)
	HasActiveConversionTracking(ctx context.Context, accountID string) (bool, error)
	HasSufficientBudget(ctx context.Context, accountID string) (bool, error)
}

// Run executes preflight checks with optional live calls via client (may be nil).
func Run(ctx context.Context, in EnvInputs, liveEnabled bool, client LiveClient) Result {
	checks := make([]Check, 0, 8)
	add := func(c Check) { checks = append(checks, c) }

	// Basic env checks
	if in.DeveloperToken == "" {
		add(Check{Code: "env.developer_token", Severity: SevError, Message: "missing GOOGLE_ADS_DEVELOPER_TOKEN"})
	} else {
		add(Check{Code: "env.developer_token", Severity: SevOK, Message: "present"})
	}
	if in.OAuthClientID == "" {
		add(Check{Code: "env.oauth_client_id", Severity: SevError, Message: "missing GOOGLE_ADS_OAUTH_CLIENT_ID"})
	} else {
		add(Check{Code: "env.oauth_client_id", Severity: SevOK, Message: "present"})
	}
	if in.OAuthClientSecret == "" {
		add(Check{Code: "env.oauth_client_secret", Severity: SevError, Message: "missing GOOGLE_ADS_OAUTH_CLIENT_SECRET"})
	} else {
		add(Check{Code: "env.oauth_client_secret", Severity: SevOK, Message: "present"})
	}
	if in.LoginCustomerID == "" {
		add(Check{Code: "env.login_customer_id", Severity: SevError, Message: "missing GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC)"})
	} else {
		if ok, _ := regexp.MatchString(`^[0-9]{10}$`, in.LoginCustomerID); !ok {
			add(Check{Code: "env.login_customer_id", Severity: SevWarn, Message: "format not 10-digit numeric"})
		} else {
			add(Check{Code: "env.login_customer_id", Severity: SevOK, Message: "present"})
		}
	}
	if in.RefreshToken == "" {
		add(Check{Code: "env.refresh_token", Severity: SevWarn, Message: "missing GOOGLE_ADS_REFRESH_TOKEN (required for server-side calls)"})
	} else {
		add(Check{Code: "env.refresh_token", Severity: SevOK, Message: "present"})
	}
	if in.TestCustomerID != "" {
		if ok, _ := regexp.MatchString(`^[0-9]{10}$`, in.TestCustomerID); !ok {
			add(Check{Code: "env.test_customer_id", Severity: SevWarn, Message: "format not 10-digit numeric"})
		} else {
			add(Check{Code: "env.test_customer_id", Severity: SevOK, Message: "present"})
		}
	}
	if in.AccountID == "" {
		add(Check{Code: "request.account_id", Severity: SevWarn, Message: "accountId not provided in request"})
	} else {
		if ok, _ := regexp.MatchString(`^[0-9]{10}$`, in.AccountID); !ok {
			add(Check{Code: "request.account_id", Severity: SevWarn, Message: "format not 10-digit numeric"})
		} else {
			add(Check{Code: "request.account_id", Severity: SevOK, Message: "present"})
		}
	}

	// Security & config checks
	if v := strings.TrimSpace(os.Getenv("OAUTH_STATE_SECRET")); v == "" {
		add(Check{Code: "security.oauth_state_secret", Severity: SevWarn, Message: "missing OAUTH_STATE_SECRET"})
	} else {
		add(Check{Code: "security.oauth_state_secret", Severity: SevOK, Message: "present"})
	}
	if v := strings.TrimSpace(os.Getenv("REFRESH_TOKEN_ENC_KEY_B64")); v == "" {
		add(Check{Code: "security.token_encryption_key", Severity: SevWarn, Message: "missing REFRESH_TOKEN_ENC_KEY_B64 (plaintext token storage)"})
	} else {
		add(Check{Code: "security.token_encryption_key", Severity: SevOK, Message: "present"})
	}
	if urls := strings.TrimSpace(os.Getenv("ADS_OAUTH_REDIRECT_URL")) + strings.TrimSpace(os.Getenv("ADS_OAUTH_REDIRECT_URLS")); urls == "" {
		add(Check{Code: "config.oauth_redirect_urls", Severity: SevWarn, Message: "missing ADS_OAUTH_REDIRECT_URL(S)"})
	} else {
		add(Check{Code: "config.oauth_redirect_urls", Severity: SevOK, Message: "present"})
	}

	// Live checks
	if !liveEnabled || client == nil {
		add(Check{Code: "ads.accessible_customers", Severity: SevSkip, Message: "live check disabled", Skipped: true})
		add(Check{Code: "ads.api_ping", Severity: SevSkip, Message: "live check disabled", Skipped: true})
		add(Check{Code: "structure.campaigns", Severity: SevSkip, Message: "live check disabled", Skipped: true})
		add(Check{Code: "attribution.conversion_tracking", Severity: SevSkip, Message: "live check disabled", Skipped: true})
		add(Check{Code: "balance.budget", Severity: SevSkip, Message: "live check disabled", Skipped: true})
		add(Check{Code: "landing.reachability", Severity: SevSkip, Message: "no offer context in preflight", Skipped: true})
	} else {
		// API ping (soft-fail)
		ctxPing, cancelPing := context.WithTimeout(ctx, 1200*time.Millisecond)
		if err := client.AdsAPIPing(ctxPing); err != nil {
			add(Check{Code: "ads.api_ping", Severity: SevWarn, Message: "ads api ping failed", Details: map[string]interface{}{"error": err.Error()}})
		} else {
			add(Check{Code: "ads.api_ping", Severity: SevOK, Message: "reachable"})
		}
		cancelPing()

		// Accessible customers (soft-fail)
		ctx1, cancel1 := context.WithTimeout(ctx, 1500*time.Millisecond)
		customers, err := client.ListAccessibleCustomers(ctx1)
		if err != nil {
			add(Check{Code: "ads.accessible_customers", Severity: SevWarn, Message: "failed to list accessible customers", Details: map[string]interface{}{"error": err.Error()}})
		} else {
			ok := len(customers) > 0
			add(Check{Code: "ads.accessible_customers", Severity: ternary(ok, SevOK, SevWarn), Message: ternary(ok, "ok", "empty list"), Details: map[string]interface{}{"count": len(customers)}})
		}
		cancel1()

		// Structure: campaigns count
		ctx2, cancel2 := context.WithTimeout(ctx, 1500*time.Millisecond)
		if n, err := client.GetCampaignsCount(ctx2, in.AccountID); err != nil {
			add(Check{Code: "structure.campaigns", Severity: SevWarn, Message: "failed to get campaigns", Details: map[string]interface{}{"error": err.Error()}})
		} else {
			sev := SevOK
			msg := "ok"
			if n == 0 {
				sev = SevWarn
				msg = "no campaigns"
			}
			add(Check{Code: "structure.campaigns", Severity: sev, Message: msg, Details: map[string]interface{}{"count": n}})
		}
		cancel2()

		// Attribution: conversion tracking enabled
		ctx3, cancel3 := context.WithTimeout(ctx, 1500*time.Millisecond)
		if on, err := client.HasActiveConversionTracking(ctx3, in.AccountID); err != nil {
			add(Check{Code: "attribution.conversion_tracking", Severity: SevWarn, Message: "failed to verify conversion tracking", Details: map[string]interface{}{"error": err.Error()}})
		} else {
			add(Check{Code: "attribution.conversion_tracking", Severity: ternary(on, SevOK, SevWarn), Message: ternary(on, "enabled", "not enabled")})
		}
		cancel3()

		// Balance: budget
		ctx4, cancel4 := context.WithTimeout(ctx, 1200*time.Millisecond)
		if ok, err := client.HasSufficientBudget(ctx4, in.AccountID); err != nil {
			add(Check{Code: "balance.budget", Severity: SevWarn, Message: "failed to query budget", Details: map[string]interface{}{"error": err.Error()}})
		} else {
			add(Check{Code: "balance.budget", Severity: ternary(ok, SevOK, SevWarn), Message: ternary(ok, "sufficient", "insufficient or zero")})
		}
		cancel4()

		// Landing: no offer context at preflight, skip
		add(Check{Code: "landing.reachability", Severity: SevSkip, Message: "no offer context in preflight", Skipped: true})
	}

	// Summary
	summary := "ready"
	for _, c := range checks {
		if c.Severity == SevError {
			summary = "blocked"
			break
		}
		if c.Severity == SevWarn && summary != "blocked" {
			summary = "degraded"
		}
	}
	return Result{Summary: summary, Checks: checks}
}

func ternary[T any](cond bool, a, b T) T {
	if cond {
		return a
	}
	return b
}
