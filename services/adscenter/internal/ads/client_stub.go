//go:build !ads_live

package ads

import (
	"context"
)

// Client is the interface used by preflight to perform optional live checks.
type Client interface {
	ListAccessibleCustomers(ctx context.Context) ([]string, error)
	SendManagerLinkInvitation(ctx context.Context, clientCustomerID string) error
	GetManagerLinkStatus(ctx context.Context, clientCustomerID string) (string, error)
	RemoveManagerLink(ctx context.Context, clientCustomerID string) error
	KeywordIdeas(ctx context.Context, seedDomain string, seeds []string) ([]KeywordIdea, error)
	// AB test helpers (MVP): minimal live ops
	CopyAdGroupMinimal(ctx context.Context, customerID, srcAdGroupID, nameSuffix string) (newAdGroupID string, err error)
	RefreshAdGroupMetrics(ctx context.Context, customerID string, adGroupIDs []string, dateRange string) (map[string]AdGroupMetrics, error)
	// Experiments (unavailable in this build)
	CreateExperiment(ctx context.Context, customerID, name string) (string, error)
	CreateExperimentArms(ctx context.Context, customerID, experimentResource string, splitA, splitB int) (armA, armB string, err error)
	GetExperiment(ctx context.Context, customerID, experimentResource string) (map[string]interface{}, error)
	CloneAdGroupKeywords(ctx context.Context, customerID, fromAdGroupID, toAdGroupID string, limit int) (int, error)
	CloneAdGroupAds(ctx context.Context, customerID, fromAdGroupID, toAdGroupID string, limit int) (int, error)
	SetAdGroupStatus(ctx context.Context, customerID, adGroupID string, paused bool) error
	ListKeywordCriteriaResourceNames(ctx context.Context, customerID, adGroupID string, limit int) ([]string, error)
	GetCampaignBudgetResource(ctx context.Context, customerID, campaignResource string) (string, error)
	LookupAdGroupCampaign(ctx context.Context, customerID, adGroupID string) (campaignResource, name string, err error)
}

// StubClient implements Client but returns not-available results.
type StubClient struct{}

func NewClientStub() *StubClient   { return &StubClient{} }
func (c *StubClient) Close() error { return nil }

func (c *StubClient) ListAccessibleCustomers(ctx context.Context) ([]string, error) {
	return nil, ErrLiveUnavailable
}

type LiveConfig struct {
	DeveloperToken    string
	OAuthClientID     string
	OAuthClientSecret string
	RefreshToken      string
	LoginCustomerID   string
	CustomerID        string
}

func NewClient(ctx context.Context, cfg LiveConfig) (*StubClient, error) {
	return nil, ErrLiveUnavailable
}

func (c *StubClient) SendManagerLinkInvitation(ctx context.Context, clientCustomerID string) error {
	return ErrLiveUnavailable
}
func (c *StubClient) GetManagerLinkStatus(ctx context.Context, clientCustomerID string) (string, error) {
	return "pending", ErrLiveUnavailable
}
func (c *StubClient) RemoveManagerLink(ctx context.Context, clientCustomerID string) error {
	return ErrLiveUnavailable
}

// Additional methods to satisfy preflight.LiveClient
func (c *StubClient) AdsAPIPing(ctx context.Context) error { return ErrLiveUnavailable }
func (c *StubClient) GetCampaignsCount(ctx context.Context, accountID string) (int, error) {
	return 0, ErrLiveUnavailable
}
func (c *StubClient) HasActiveConversionTracking(ctx context.Context, accountID string) (bool, error) {
	return false, ErrLiveUnavailable
}
func (c *StubClient) HasSufficientBudget(ctx context.Context, accountID string) (bool, error) {
	return false, ErrLiveUnavailable
}

type KeywordIdea struct {
	Text               string
	AvgMonthlySearches int
	Competition        string
}
type AdGroupMetrics struct {
	Impressions int64
	Clicks      int64
	CostMicros  int64
}

func (c *StubClient) KeywordIdeas(ctx context.Context, seedDomain string, seeds []string) ([]KeywordIdea, error) {
	return nil, ErrLiveUnavailable
}

func (c *StubClient) CopyAdGroupMinimal(ctx context.Context, customerID, srcAdGroupID, nameSuffix string) (string, error) {
	return "", ErrLiveUnavailable
}

func (c *StubClient) RefreshAdGroupMetrics(ctx context.Context, customerID string, adGroupIDs []string, dateRange string) (map[string]AdGroupMetrics, error) {
	return nil, ErrLiveUnavailable
}

// --- Experiments (unavailable) ---
func (c *StubClient) CreateExperiment(ctx context.Context, customerID, name string) (string, error) {
	return "", ErrLiveUnavailable
}
func (c *StubClient) CreateExperimentArms(ctx context.Context, customerID, experimentResource string, splitA, splitB int) (string, string, error) {
	return "", "", ErrLiveUnavailable
}
func (c *StubClient) GetExperiment(ctx context.Context, customerID, experimentResource string) (map[string]interface{}, error) {
	return map[string]interface{}{}, ErrLiveUnavailable
}
func (c *StubClient) CloneAdGroupKeywords(ctx context.Context, customerID, fromAdGroupID, toAdGroupID string, limit int) (int, error) {
	return 0, ErrLiveUnavailable
}
func (c *StubClient) CloneAdGroupAds(ctx context.Context, customerID, fromAdGroupID, toAdGroupID string, limit int) (int, error) {
	return 0, ErrLiveUnavailable
}
func (c *StubClient) SetAdGroupStatus(ctx context.Context, customerID, adGroupID string, paused bool) error {
	return ErrLiveUnavailable
}
func (c *StubClient) ListKeywordCriteriaResourceNames(ctx context.Context, customerID, adGroupID string, limit int) ([]string, error) {
	return []string{}, ErrLiveUnavailable
}
func (c *StubClient) GetCampaignBudgetResource(ctx context.Context, customerID, campaignResource string) (string, error) {
	return "", ErrLiveUnavailable
}
func (c *StubClient) LookupAdGroupCampaign(ctx context.Context, customerID, adGroupID string) (string, string, error) {
	return "", "", ErrLiveUnavailable
}
