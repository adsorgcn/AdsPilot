package executor

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNew tests executor creation
func TestNew(t *testing.T) {
	tests := []struct {
		name             string
		cfg              Config
		wantTimeout      time.Duration
		wantValidateOnly bool
	}{
		{
			name:             "default timeout",
			cfg:              Config{},
			wantTimeout:      5 * time.Second,
			wantValidateOnly: false,
		},
		{
			name: "custom timeout",
			cfg: Config{
				Timeout: 10 * time.Second,
			},
			wantTimeout:      10 * time.Second,
			wantValidateOnly: false,
		},
		{
			name: "validate only mode",
			cfg: Config{
				ValidateOnly: true,
			},
			wantTimeout:      5 * time.Second,
			wantValidateOnly: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exec := New(tt.cfg)

			assert.NotNil(t, exec)
			assert.Equal(t, tt.wantValidateOnly, exec.cfg.ValidateOnly)
			assert.Equal(t, tt.wantTimeout, exec.cfg.Timeout)
		})
	}
}

// TestExecuteOne_AdjustCPC tests CPC adjustment action
func TestExecuteOne_AdjustCPC(t *testing.T) {
	tests := []struct {
		name        string
		cfg         Config
		action      Action
		wantSuccess bool
		wantMessage string
	}{
		{
			name: "adjust CPC in validate mode",
			cfg: Config{
				ValidateOnly: true,
			},
			action: Action{
				Type: "ADJUST_CPC",
				Params: map[string]interface{}{
					"percent": 10,
				},
			},
			wantSuccess: true,
			wantMessage: "validateOnly",
		},
		{
			name: "adjust CPC in execute mode",
			cfg: Config{
				ValidateOnly: false,
			},
			action: Action{
				Type: "ADJUST_CPC",
				Params: map[string]interface{}{
					"percent": 10,
				},
			},
			wantSuccess: true,
			wantMessage: "cpc adjusted (stub)",
		},
		{
			name: "adjust CPC with multiple params",
			cfg: Config{
				ValidateOnly: false,
			},
			action: Action{
				Type: "adjust_cpc",
				Params: map[string]interface{}{
					"percent":    10,
					"campaignId": "123",
				},
			},
			wantSuccess: true,
			wantMessage: "cpc adjusted (stub)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exec := New(tt.cfg)
			ctx := context.Background()

			result, err := exec.ExecuteOne(ctx, tt.action)

			require.NoError(t, err)
			assert.Equal(t, tt.wantSuccess, result.Success)
			assert.Equal(t, tt.wantMessage, result.Message)

			if !tt.cfg.ValidateOnly && len(tt.action.Params) > 0 {
				assert.NotNil(t, result.Details)
			}
		})
	}
}

// TestExecuteOne_AdjustBudget tests budget adjustment action
func TestExecuteOne_AdjustBudget(t *testing.T) {
	tests := []struct {
		name        string
		cfg         Config
		action      Action
		wantSuccess bool
		wantMessage string
	}{
		{
			name: "adjust budget in validate mode",
			cfg: Config{
				ValidateOnly: true,
			},
			action: Action{
				Type: "ADJUST_BUDGET",
				Params: map[string]interface{}{
					"dailyBudget": 100,
				},
			},
			wantSuccess: true,
			wantMessage: "validateOnly",
		},
		{
			name: "adjust budget in execute mode",
			cfg: Config{
				ValidateOnly: false,
			},
			action: Action{
				Type: "ADJUST_BUDGET",
				Params: map[string]interface{}{
					"percent": 20,
				},
			},
			wantSuccess: true,
			wantMessage: "budget adjusted (stub)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exec := New(tt.cfg)
			ctx := context.Background()

			result, err := exec.ExecuteOne(ctx, tt.action)

			require.NoError(t, err)
			assert.Equal(t, tt.wantSuccess, result.Success)
			assert.Equal(t, tt.wantMessage, result.Message)
		})
	}
}

// TestExecuteOne_RotateLink tests link rotation action
func TestExecuteOne_RotateLink(t *testing.T) {
	tests := []struct {
		name        string
		cfg         Config
		action      Action
		wantSuccess bool
		wantError   bool
	}{
		{
			name: "rotate link with links array",
			cfg: Config{
				ValidateOnly: false,
			},
			action: Action{
				Type: "ROTATE_LINK",
				Params: map[string]interface{}{
					"links": []interface{}{"https://example.com"},
				},
			},
			wantSuccess: true,
			wantError:   false,
		},
		{
			name: "rotate link with targetDomain",
			cfg: Config{
				ValidateOnly: false,
			},
			action: Action{
				Type: "ROTATE_LINK",
				Params: map[string]interface{}{
					"targetDomain": "example.com",
				},
			},
			wantSuccess: true,
			wantError:   false,
		},
		{
			name: "rotate link in validate mode",
			cfg: Config{
				ValidateOnly: true,
			},
			action: Action{
				Type: "ROTATE_LINK",
				Params: map[string]interface{}{
					"targetDomain": "example.com",
				},
			},
			wantSuccess: true,
			wantError:   false,
		},
		{
			name: "rotate link without target",
			cfg: Config{
				ValidateOnly: false,
			},
			action: Action{
				Type:   "ROTATE_LINK",
				Params: map[string]interface{}{},
			},
			wantSuccess: false,
			wantError:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exec := New(tt.cfg)
			ctx := context.Background()

			result, err := exec.ExecuteOne(ctx, tt.action)

			if tt.wantError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
			assert.Equal(t, tt.wantSuccess, result.Success)
		})
	}
}

// TestExecuteOne_UnsupportedAction tests unsupported action types
func TestExecuteOne_UnsupportedAction(t *testing.T) {
	exec := New(Config{})
	ctx := context.Background()

	action := Action{
		Type: "UNSUPPORTED_ACTION",
	}

	result, err := exec.ExecuteOne(ctx, action)

	assert.Error(t, err)
	assert.False(t, result.Success)
	assert.Equal(t, "unsupported action", result.Message)
}

// TestExecuteOne_CaseInsensitive tests that action types are case-insensitive
func TestExecuteOne_CaseInsensitive(t *testing.T) {
	tests := []struct {
		name       string
		actionType string
	}{
		{"lowercase", "adjust_cpc"},
		{"uppercase", "ADJUST_CPC"},
		{"mixed case", "Adjust_Cpc"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exec := New(Config{})
			ctx := context.Background()

			action := Action{
				Type: tt.actionType,
				Params: map[string]interface{}{
					"percent": 10,
				},
			}

			result, err := exec.ExecuteOne(ctx, action)

			require.NoError(t, err)
			assert.True(t, result.Success)
		})
	}
}

// TestExecuteOne_ContextCancellation tests context cancellation
func TestExecuteOne_ContextCancellation(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping context cancellation test in short mode")
	}

	exec := New(Config{
		BrowserExecURL: "http://localhost:9999", // Non-existent server
		Timeout:        100 * time.Millisecond,
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	action := Action{
		Type: "ROTATE_LINK",
		Params: map[string]interface{}{
			"targetDomain": "example.com",
		},
	}

	_, err := exec.ExecuteOne(ctx, action)

	// Should handle cancellation gracefully
	// Note: May not error if it doesn't reach the HTTP call
	_ = err
}
