package preflight

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

// MockLiveClient implements LiveClient for testing
type MockLiveClient struct {
	ListAccessibleCustomersFunc     func(ctx context.Context) ([]string, error)
	AdsAPIPingFunc                  func(ctx context.Context) error
	GetCampaignsCountFunc           func(ctx context.Context, accountID string) (int, error)
	HasActiveConversionTrackingFunc func(ctx context.Context, accountID string) (bool, error)
	HasSufficientBudgetFunc         func(ctx context.Context, accountID string) (bool, error)
}

func (m *MockLiveClient) ListAccessibleCustomers(ctx context.Context) ([]string, error) {
	if m.ListAccessibleCustomersFunc != nil {
		return m.ListAccessibleCustomersFunc(ctx)
	}
	return []string{"1234567890"}, nil
}

func (m *MockLiveClient) AdsAPIPing(ctx context.Context) error {
	if m.AdsAPIPingFunc != nil {
		return m.AdsAPIPingFunc(ctx)
	}
	return nil
}

func (m *MockLiveClient) GetCampaignsCount(ctx context.Context, accountID string) (int, error) {
	if m.GetCampaignsCountFunc != nil {
		return m.GetCampaignsCountFunc(ctx, accountID)
	}
	return 5, nil
}

func (m *MockLiveClient) HasActiveConversionTracking(ctx context.Context, accountID string) (bool, error) {
	if m.HasActiveConversionTrackingFunc != nil {
		return m.HasActiveConversionTrackingFunc(ctx, accountID)
	}
	return true, nil
}

func (m *MockLiveClient) HasSufficientBudget(ctx context.Context, accountID string) (bool, error) {
	if m.HasSufficientBudgetFunc != nil {
		return m.HasSufficientBudgetFunc(ctx, accountID)
	}
	return true, nil
}

// TestRun_BasicEnvChecks tests basic environment variable checks
func TestRun_BasicEnvChecks(t *testing.T) {
	tests := []struct {
		name         string
		inputs       EnvInputs
		wantSummary  string
		checkCode    string
		wantSeverity Severity
	}{
		{
			name: "missing developer token",
			inputs: EnvInputs{
				DeveloperToken: "",
			},
			wantSummary:  "blocked",
			checkCode:    "env.developer_token",
			wantSeverity: SevError,
		},
		{
			name: "all env vars present",
			inputs: EnvInputs{
				DeveloperToken:    "test-token",
				OAuthClientID:     "test-client-id",
				OAuthClientSecret: "test-secret",
				LoginCustomerID:   "1234567890",
				RefreshToken:      "test-refresh",
			},
			wantSummary:  "degraded", // Will be degraded due to missing security env vars
			checkCode:    "env.developer_token",
			wantSeverity: SevOK,
		},
		{
			name: "invalid login customer ID format",
			inputs: EnvInputs{
				DeveloperToken:    "test-token",
				OAuthClientID:     "test-client-id",
				OAuthClientSecret: "test-secret",
				LoginCustomerID:   "invalid",
				RefreshToken:      "test-refresh",
			},
			wantSummary:  "degraded",
			checkCode:    "env.login_customer_id",
			wantSeverity: SevWarn,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result := Run(ctx, tt.inputs, false, nil)

			assert.Equal(t, tt.wantSummary, result.Summary)

			// Find the specific check
			var found bool
			for _, check := range result.Checks {
				if check.Code == tt.checkCode {
					assert.Equal(t, tt.wantSeverity, check.Severity)
					found = true
					break
				}
			}
			assert.True(t, found, "check %s not found", tt.checkCode)
		})
	}
}

// TestRun_LiveChecksDisabled tests that live checks are skipped when disabled
func TestRun_LiveChecksDisabled(t *testing.T) {
	ctx := context.Background()
	inputs := EnvInputs{
		DeveloperToken:    "test-token",
		OAuthClientID:     "test-client-id",
		OAuthClientSecret: "test-secret",
		LoginCustomerID:   "1234567890",
		RefreshToken:      "test-refresh",
	}

	result := Run(ctx, inputs, false, nil)

	// Check that live checks are skipped
	liveCheckCodes := []string{
		"ads.accessible_customers",
		"ads.api_ping",
		"structure.campaigns",
		"attribution.conversion_tracking",
		"balance.budget",
	}

	for _, code := range liveCheckCodes {
		var found bool
		for _, check := range result.Checks {
			if check.Code == code {
				assert.Equal(t, SevSkip, check.Severity)
				assert.True(t, check.Skipped)
				found = true
				break
			}
		}
		assert.True(t, found, "check %s not found", code)
	}
}

// TestRun_LiveChecksEnabled tests live checks with mock client
func TestRun_LiveChecksEnabled(t *testing.T) {
	tests := []struct {
		name         string
		mockClient   *MockLiveClient
		checkCode    string
		wantSeverity Severity
	}{
		{
			name: "successful API ping",
			mockClient: &MockLiveClient{
				AdsAPIPingFunc: func(ctx context.Context) error {
					return nil
				},
			},
			checkCode:    "ads.api_ping",
			wantSeverity: SevOK,
		},
		{
			name: "failed API ping",
			mockClient: &MockLiveClient{
				AdsAPIPingFunc: func(ctx context.Context) error {
					return errors.New("connection failed")
				},
			},
			checkCode:    "ads.api_ping",
			wantSeverity: SevWarn,
		},
		{
			name: "accessible customers found",
			mockClient: &MockLiveClient{
				ListAccessibleCustomersFunc: func(ctx context.Context) ([]string, error) {
					return []string{"1234567890", "0987654321"}, nil
				},
			},
			checkCode:    "ads.accessible_customers",
			wantSeverity: SevOK,
		},
		{
			name: "no accessible customers",
			mockClient: &MockLiveClient{
				ListAccessibleCustomersFunc: func(ctx context.Context) ([]string, error) {
					return []string{}, nil
				},
			},
			checkCode:    "ads.accessible_customers",
			wantSeverity: SevWarn,
		},
		{
			name: "campaigns found",
			mockClient: &MockLiveClient{
				GetCampaignsCountFunc: func(ctx context.Context, accountID string) (int, error) {
					return 10, nil
				},
			},
			checkCode:    "structure.campaigns",
			wantSeverity: SevOK,
		},
		{
			name: "no campaigns",
			mockClient: &MockLiveClient{
				GetCampaignsCountFunc: func(ctx context.Context, accountID string) (int, error) {
					return 0, nil
				},
			},
			checkCode:    "structure.campaigns",
			wantSeverity: SevWarn,
		},
		{
			name: "conversion tracking enabled",
			mockClient: &MockLiveClient{
				HasActiveConversionTrackingFunc: func(ctx context.Context, accountID string) (bool, error) {
					return true, nil
				},
			},
			checkCode:    "attribution.conversion_tracking",
			wantSeverity: SevOK,
		},
		{
			name: "conversion tracking disabled",
			mockClient: &MockLiveClient{
				HasActiveConversionTrackingFunc: func(ctx context.Context, accountID string) (bool, error) {
					return false, nil
				},
			},
			checkCode:    "attribution.conversion_tracking",
			wantSeverity: SevWarn,
		},
		{
			name: "sufficient budget",
			mockClient: &MockLiveClient{
				HasSufficientBudgetFunc: func(ctx context.Context, accountID string) (bool, error) {
					return true, nil
				},
			},
			checkCode:    "balance.budget",
			wantSeverity: SevOK,
		},
		{
			name: "insufficient budget",
			mockClient: &MockLiveClient{
				HasSufficientBudgetFunc: func(ctx context.Context, accountID string) (bool, error) {
					return false, nil
				},
			},
			checkCode:    "balance.budget",
			wantSeverity: SevWarn,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			inputs := EnvInputs{
				DeveloperToken:    "test-token",
				OAuthClientID:     "test-client-id",
				OAuthClientSecret: "test-secret",
				LoginCustomerID:   "1234567890",
				RefreshToken:      "test-refresh",
				AccountID:         "1234567890",
			}

			result := Run(ctx, inputs, true, tt.mockClient)

			// Find the specific check
			var found bool
			for _, check := range result.Checks {
				if check.Code == tt.checkCode {
					assert.Equal(t, tt.wantSeverity, check.Severity)
					found = true
					break
				}
			}
			assert.True(t, found, "check %s not found", tt.checkCode)
		})
	}
}

// TestRun_SecurityChecks tests security-related environment checks
func TestRun_SecurityChecks(t *testing.T) {
	// Save original env vars
	origStateSecret := os.Getenv("OAUTH_STATE_SECRET")
	origEncKey := os.Getenv("REFRESH_TOKEN_ENC_KEY_B64")
	origRedirectURL := os.Getenv("ADS_OAUTH_REDIRECT_URL")

	// Restore after test
	defer func() {
		os.Setenv("OAUTH_STATE_SECRET", origStateSecret)
		os.Setenv("REFRESH_TOKEN_ENC_KEY_B64", origEncKey)
		os.Setenv("ADS_OAUTH_REDIRECT_URL", origRedirectURL)
	}()

	tests := []struct {
		name         string
		setupEnv     func()
		checkCode    string
		wantSeverity Severity
	}{
		{
			name: "missing OAuth state secret",
			setupEnv: func() {
				os.Unsetenv("OAUTH_STATE_SECRET")
			},
			checkCode:    "security.oauth_state_secret",
			wantSeverity: SevWarn,
		},
		{
			name: "OAuth state secret present",
			setupEnv: func() {
				os.Setenv("OAUTH_STATE_SECRET", "test-secret")
			},
			checkCode:    "security.oauth_state_secret",
			wantSeverity: SevOK,
		},
		{
			name: "missing token encryption key",
			setupEnv: func() {
				os.Unsetenv("REFRESH_TOKEN_ENC_KEY_B64")
			},
			checkCode:    "security.token_encryption_key",
			wantSeverity: SevWarn,
		},
		{
			name: "token encryption key present",
			setupEnv: func() {
				os.Setenv("REFRESH_TOKEN_ENC_KEY_B64", "test-key")
			},
			checkCode:    "security.token_encryption_key",
			wantSeverity: SevOK,
		},
		{
			name: "missing OAuth redirect URLs",
			setupEnv: func() {
				os.Unsetenv("ADS_OAUTH_REDIRECT_URL")
				os.Unsetenv("ADS_OAUTH_REDIRECT_URLS")
			},
			checkCode:    "config.oauth_redirect_urls",
			wantSeverity: SevWarn,
		},
		{
			name: "OAuth redirect URL present",
			setupEnv: func() {
				os.Setenv("ADS_OAUTH_REDIRECT_URL", "https://example.com/callback")
			},
			checkCode:    "config.oauth_redirect_urls",
			wantSeverity: SevOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setupEnv()

			ctx := context.Background()
			inputs := EnvInputs{
				DeveloperToken:    "test-token",
				OAuthClientID:     "test-client-id",
				OAuthClientSecret: "test-secret",
			}

			result := Run(ctx, inputs, false, nil)

			// Find the specific check
			var found bool
			for _, check := range result.Checks {
				if check.Code == tt.checkCode {
					assert.Equal(t, tt.wantSeverity, check.Severity)
					found = true
					break
				}
			}
			assert.True(t, found, "check %s not found", tt.checkCode)
		})
	}
}

// TestRun_SummaryCalculation tests summary calculation logic
func TestRun_SummaryCalculation(t *testing.T) {
	tests := []struct {
		name        string
		inputs      EnvInputs
		wantSummary string
	}{
		{
			name: "all checks pass",
			inputs: EnvInputs{
				DeveloperToken:    "test-token",
				OAuthClientID:     "test-client-id",
				OAuthClientSecret: "test-secret",
				LoginCustomerID:   "1234567890",
				RefreshToken:      "test-refresh",
			},
			wantSummary: "degraded", // Will be degraded due to missing security env vars
		},
		{
			name: "error present",
			inputs: EnvInputs{
				DeveloperToken: "", // Missing - causes error
			},
			wantSummary: "blocked",
		},
		{
			name: "warning present",
			inputs: EnvInputs{
				DeveloperToken:    "test-token",
				OAuthClientID:     "test-client-id",
				OAuthClientSecret: "test-secret",
				LoginCustomerID:   "invalid", // Invalid format - causes warning
			},
			wantSummary: "degraded",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result := Run(ctx, tt.inputs, false, nil)

			assert.Equal(t, tt.wantSummary, result.Summary)
		})
	}
}

// TestTernary tests the ternary helper function
func TestTernary(t *testing.T) {
	assert.Equal(t, "yes", ternary(true, "yes", "no"))
	assert.Equal(t, "no", ternary(false, "yes", "no"))
	assert.Equal(t, 1, ternary(true, 1, 2))
	assert.Equal(t, 2, ternary(false, 1, 2))
}
