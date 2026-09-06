//go:build !ads_live

package executor

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ads"
)

func TestNew(t *testing.T) {
	if got := New(Config{}).cfg.Timeout; got != 5*time.Second {
		t.Fatalf("default timeout = %v", got)
	}
	if got := New(Config{Timeout: time.Second}).cfg.Timeout; got != time.Second {
		t.Fatalf("custom timeout = %v", got)
	}
}

func TestStubCannotValidateOrExecute(t *testing.T) {
	for _, cfg := range []Config{{}, {ValidateOnly: true}, {LiveMutate: true}} {
		for _, typ := range []string{"ADJUST_CPC", "ADJUST_BUDGET", "PAUSE_CAMPAIGNS", "UNSUPPORTED"} {
			result, err := New(cfg).ExecuteOne(context.Background(), Action{Type: typ, Params: map[string]any{"percent": 10}})
			if !errors.Is(err, ads.ErrLiveUnavailable) || result.Success {
				t.Fatalf("config %+v action %s falsely succeeded: %+v, %v", cfg, typ, result, err)
			}
			if result.Details["executed"] != false || result.Details["googleValidated"] != false {
				t.Fatalf("missing explicit unavailable outcome: %+v", result)
			}
		}
	}
}

func TestStubHonorsCancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	result, err := New(Config{}).ExecuteOne(ctx, Action{Type: "ADJUST_CPC"})
	if !errors.Is(err, context.Canceled) || result.Success {
		t.Fatalf("cancelled execution returned %+v, %v", result, err)
	}
}
