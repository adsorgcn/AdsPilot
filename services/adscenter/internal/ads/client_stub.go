//go:build !ads_live

package ads

import (
	"context"
	"strings"
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
	// Experiments (optional, no-op in stub)
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
	return nil, nil
}

type LiveConfig struct {
	DeveloperToken    string
	OAuthClientID     string
	OAuthClientSecret string
	RefreshToken      string
	LoginCustomerID   string
}

func NewClient(ctx context.Context, cfg LiveConfig) (*StubClient, error) {
	return &StubClient{}, nil
}

func (c *StubClient) SendManagerLinkInvitation(ctx context.Context, clientCustomerID string) error {
	return nil
}
func (c *StubClient) GetManagerLinkStatus(ctx context.Context, clientCustomerID string) (string, error) {
	return "pending", nil
}
func (c *StubClient) RemoveManagerLink(ctx context.Context, clientCustomerID string) error {
	return nil
}

// Additional methods to satisfy preflight.LiveClient
func (c *StubClient) AdsAPIPing(ctx context.Context) error { return nil }
func (c *StubClient) GetCampaignsCount(ctx context.Context, accountID string) (int, error) {
	return 0, nil
}
func (c *StubClient) HasActiveConversionTracking(ctx context.Context, accountID string) (bool, error) {
	return false, nil
}
func (c *StubClient) HasSufficientBudget(ctx context.Context, accountID string) (bool, error) {
	return false, nil
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
	// Simple stub: derive few ideas per seed
	base := []string{"best", "cheap", "buy", "review", "discount", "top", "near me"}
	out := make([]KeywordIdea, 0, len(seeds)*len(base))
	for _, s := range seeds {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		for i, b := range base {
			k := strings.TrimSpace(s + " " + b)
			vol := 500 + (i+1)*700 // 1200, 1900, ...
			comp := "MEDIUM"
			if i%5 == 0 {
				comp = "LOW"
			}
			if i%7 == 0 {
				comp = "HIGH"
			}
			out = append(out, KeywordIdea{Text: k, AvgMonthlySearches: vol, Competition: comp})
		}
	}
	if len(out) == 0 && seedDomain != "" {
		// derive from domain
		parts := strings.Split(seedDomain, ".")
		if len(parts) > 0 {
			root := parts[0]
			for i, b := range base {
				k := root + " " + b
				vol := 800 + (i+1)*600
				comp := "MEDIUM"
				if i%3 == 0 {
					comp = "LOW"
				}
				if i%4 == 0 {
					comp = "HIGH"
				}
				out = append(out, KeywordIdea{Text: k, AvgMonthlySearches: vol, Competition: comp})
			}
		}
	}
	return out, nil
}

func (c *StubClient) CopyAdGroupMinimal(ctx context.Context, customerID, srcAdGroupID, nameSuffix string) (string, error) {
	// Stub: return synthetic id
	if nameSuffix == "" {
		nameSuffix = "_B"
	}
	return srcAdGroupID + nameSuffix, nil
}

func (c *StubClient) RefreshAdGroupMetrics(ctx context.Context, customerID string, adGroupIDs []string, dateRange string) (map[string]AdGroupMetrics, error) {
	out := make(map[string]AdGroupMetrics, len(adGroupIDs))
	for _, id := range adGroupIDs {
		out[id] = AdGroupMetrics{}
	}
	return out, nil
}

// --- Experiments (stub no-op) ---
func (c *StubClient) CreateExperiment(ctx context.Context, customerID, name string) (string, error) {
	return "", nil
}
func (c *StubClient) CreateExperimentArms(ctx context.Context, customerID, experimentResource string, splitA, splitB int) (string, string, error) {
	return "", "", nil
}
func (c *StubClient) GetExperiment(ctx context.Context, customerID, experimentResource string) (map[string]interface{}, error) {
	return map[string]interface{}{}, nil
}
func (c *StubClient) CloneAdGroupKeywords(ctx context.Context, customerID, fromAdGroupID, toAdGroupID string, limit int) (int, error) {
	return 0, nil
}
func (c *StubClient) CloneAdGroupAds(ctx context.Context, customerID, fromAdGroupID, toAdGroupID string, limit int) (int, error) {
	return 0, nil
}
func (c *StubClient) SetAdGroupStatus(ctx context.Context, customerID, adGroupID string, paused bool) error {
	return nil
}
func (c *StubClient) ListKeywordCriteriaResourceNames(ctx context.Context, customerID, adGroupID string, limit int) ([]string, error) {
	return []string{}, nil
}
func (c *StubClient) GetCampaignBudgetResource(ctx context.Context, customerID, campaignResource string) (string, error) {
	return "", nil
}
func (c *StubClient) LookupAdGroupCampaign(ctx context.Context, customerID, adGroupID string) (string, string, error) {
	return "", "", nil
}
