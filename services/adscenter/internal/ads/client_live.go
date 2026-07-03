//go:build ads_live

package ads

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"strconv"
	"strings"
)

// Live client placeholder for future Google Ads SDK wiring.
// Intentionally avoids importing the SDK to keep builds lightweight.

type LiveConfig struct {
	DeveloperToken    string
	OAuthClientID     string
	OAuthClientSecret string
	RefreshToken      string
	LoginCustomerID   string
}

type LiveClient struct {
	http     *http.Client
	devToken string
	loginCID string
	ts       oauth2.TokenSource
}

func NewClient(ctx context.Context, cfg LiveConfig) (*LiveClient, error) {
	conf := &oauth2.Config{
		ClientID:     cfg.OAuthClientID,
		ClientSecret: cfg.OAuthClientSecret,
		Endpoint:     google.Endpoint,
		Scopes:       []string{"https://www.googleapis.com/auth/adwords"},
	}
	ts := conf.TokenSource(ctx, &oauth2.Token{RefreshToken: cfg.RefreshToken})
	return &LiveClient{http: &http.Client{Timeout: 5 * time.Second}, devToken: cfg.DeveloperToken, loginCID: cfg.LoginCustomerID, ts: ts}, nil
}

func (c *LiveClient) Close() error { return nil }

func (c *LiveClient) authHeaders(ctx context.Context) (http.Header, error) {
	tok, err := c.ts.Token()
	if err != nil {
		return nil, err
	}
	h := http.Header{}
	h.Set("Authorization", "Bearer "+tok.AccessToken)
	h.Set("developer-token", c.devToken)
	if c.loginCID != "" {
		h.Set("login-customer-id", c.loginCID)
	}
	h.Set("Content-Type", "application/json")
	return h, nil
}

func (c *LiveClient) doJSON(ctx context.Context, method, url string, body any) ([]byte, int, error) {
	var br io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		br = bytes.NewReader(b)
	}
	req, _ := http.NewRequestWithContext(ctx, method, url, br)
	hdr, err := c.authHeaders(ctx)
	if err != nil {
		return nil, 0, err
	}
	req.Header = hdr
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return data, resp.StatusCode, fmt.Errorf("google ads http %d: %s", resp.StatusCode, string(data))
	}
	return data, resp.StatusCode, nil
}

func (c *LiveClient) ListAccessibleCustomers(ctx context.Context) ([]string, error) {
	url := "https://googleads.googleapis.com/v16/customers:listAccessibleCustomers"
	data, _, err := c.doJSON(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	var resp struct {
		ResourceNames []string `json:"resourceNames"`
	}
	_ = json.Unmarshal(data, &resp)
	return resp.ResourceNames, nil
}

// AdsAPIPing performs a lightweight call to verify reachability/auth.
func (c *LiveClient) AdsAPIPing(ctx context.Context) error {
	_, err := c.ListAccessibleCustomers(ctx)
	return err
}

func (c *LiveClient) SendManagerLinkInvitation(ctx context.Context, clientCustomerID string) error {
	// Create invitation from client perspective to link to manager (platform MCC)
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/customerManagerLinks:mutate", clientCustomerID)
	body := map[string]any{
		"operations": []any{
			map[string]any{
				"create": map[string]any{
					"manager": fmt.Sprintf("customers/%s", c.loginCID),
				},
			},
		},
	}
	_, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	return err
}

func (c *LiveClient) GetManagerLinkStatus(ctx context.Context, clientCustomerID string) (string, error) {
	// Query via GAQL: filter for platform MCC (loginCID)
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", clientCustomerID)
	q := "SELECT customer_manager_link.resource_name, customer_manager_link.status, customer_manager_link.manager_customer FROM customer_manager_link"
	body := map[string]any{"query": q}
	data, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	if err != nil {
		return "", err
	}
	var arr []map[string]any
	_ = json.Unmarshal(data, &arr)
	for _, msg := range arr {
		if results, ok := msg["results"].([]any); ok {
			for _, it := range results {
				if m, ok := it.(map[string]any); ok {
					if l, ok := m["customerManagerLink"].(map[string]any); ok {
						if mgr, ok := l["managerCustomer"].(string); ok {
							// mgr like "customers/1234567890"
							if strings.HasSuffix(mgr, "/"+c.loginCID) {
								if s, ok := l["status"].(string); ok {
									return s, nil
								}
							}
						}
					}
				}
			}
		}
	}
	return "unknown", nil
}

func (c *LiveClient) RemoveManagerLink(ctx context.Context, clientCustomerID string) error {
	// Find resource name for manager link to platform MCC
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", clientCustomerID)
	q := "SELECT customer_manager_link.resource_name, customer_manager_link.status, customer_manager_link.manager_customer FROM customer_manager_link"
	body := map[string]any{"query": q}
	data, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	if err != nil {
		return err
	}
	var resourceName string
	var arr []map[string]any
	_ = json.Unmarshal(data, &arr)
	for _, msg := range arr {
		if results, ok := msg["results"].([]any); ok {
			for _, it := range results {
				if m, ok := it.(map[string]any); ok {
					if l, ok := m["customerManagerLink"].(map[string]any); ok {
						if mgr, ok := l["managerCustomer"].(string); ok && strings.HasSuffix(mgr, "/"+c.loginCID) {
							if rn, ok := l["resourceName"].(string); ok {
								resourceName = rn
								break
							}
						}
					}
				}
			}
		}
	}
	if resourceName == "" {
		return fmt.Errorf("manager link resource not found")
	}
	// Update status to INACTIVE
	mutateURL := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/customerManagerLinks:mutate", clientCustomerID)
	upd := map[string]any{
		"resourceName": resourceName,
		"status":       "INACTIVE",
	}
	req := map[string]any{
		"operations": []any{map[string]any{"update": upd, "updateMask": "status"}},
	}
	_, _, err = c.doJSON(ctx, http.MethodPost, mutateURL, req)
	return err
}

// ListKeywordCriteriaResourceNames returns ad_group_criterion resource names under an ad group (non-negative, keyword type).
func (c *LiveClient) ListKeywordCriteriaResourceNames(ctx context.Context, customerID, adGroupID string, limit int) ([]string, error) {
	if limit <= 0 {
		limit = 50
	}
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", customerID)
	q := fmt.Sprintf("SELECT ad_group_criterion.resource_name FROM ad_group_criterion WHERE ad_group.id = %s AND ad_group_criterion.type = KEYWORD AND ad_group_criterion.negative = FALSE LIMIT %d", adGroupID, limit)
	data, _, err := c.doJSON(ctx, http.MethodPost, url, map[string]any{"query": q})
	if err != nil {
		return nil, err
	}
	var arr []map[string]any
	if json.Unmarshal(data, &arr) != nil {
		return nil, fmt.Errorf("gaql parse")
	}
	out := []string{}
	for _, chunk := range arr {
		if results, ok := chunk["results"].([]any); ok {
			for _, it := range results {
				if m, ok := it.(map[string]any); ok {
					if agc, ok := m["adGroupCriterion"].(map[string]any); ok {
						if rn, ok2 := agc["resourceName"].(string); ok2 && strings.TrimSpace(rn) != "" {
							out = append(out, rn)
						}
					}
				}
			}
		}
	}
	return out, nil
}

// GetCampaignBudgetResource returns the campaign_budget resource name for the given campaign resource.
func (c *LiveClient) GetCampaignBudgetResource(ctx context.Context, customerID, campaignResource string) (string, error) {
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", customerID)
	q := fmt.Sprintf("SELECT campaign.campaign_budget FROM campaign WHERE campaign.resource_name = '%s'", campaignResource)
	data, _, err := c.doJSON(ctx, http.MethodPost, url, map[string]any{"query": q})
	if err != nil {
		return "", err
	}
	var arr []map[string]any
	if json.Unmarshal(data, &arr) != nil {
		return "", fmt.Errorf("gaql parse")
	}
	for _, chunk := range arr {
		if results, ok := chunk["results"].([]any); ok {
			for _, it := range results {
				if m, ok := it.(map[string]any); ok {
					if camp, ok2 := m["campaign"].(map[string]any); ok2 {
						if rn, ok3 := camp["campaignBudget"].(string); ok3 && strings.TrimSpace(rn) != "" {
							return rn, nil
						}
					}
				}
			}
		}
	}
	return "", nil
}

// GetCampaignsCount returns number of campaigns (last 7 days scope) for a given account.
func (c *LiveClient) GetCampaignsCount(ctx context.Context, accountID string) (int, error) {
	// Use GAQL over searchStream to count campaigns updated/visible; fallback to counting all campaigns.
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", accountID)
	// segments.date DURING LAST_7_DAYS may require permission; if fails, we still count results.
	q := "SELECT campaign.id FROM campaign"
	body := map[string]any{"query": q}
	data, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	if err != nil {
		return 0, err
	}
	// searchStream returns NDJSON-like JSON array chunks
	var arr []map[string]any
	if err := json.Unmarshal(data, &arr); err != nil {
		return 0, err
	}
	total := 0
	for _, chunk := range arr {
		if results, ok := chunk["results"].([]any); ok {
			total += len(results)
		}
	}
	return total, nil
}

// HasActiveConversionTracking checks whether conversion tracking appears enabled.
// Minimal heuristic: attempt to read conversion_tracking_status; success implies enabled.
func (c *LiveClient) HasActiveConversionTracking(ctx context.Context, accountID string) (bool, error) {
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", accountID)
	q := "SELECT customer.conversion_tracking_setting.conversion_tracking_status FROM customer"
	body := map[string]any{"query": q}
	_, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	if err != nil {
		return false, err
	}
	return true, nil
}

// HasSufficientBudget checks if any campaign budget exists (heuristic for non-zero budget configured).
func (c *LiveClient) HasSufficientBudget(ctx context.Context, accountID string) (bool, error) {
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", accountID)
	q := "SELECT campaign_budget.amount_micros FROM campaign_budget LIMIT 1"
	body := map[string]any{"query": q}
	data, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	if err != nil {
		return false, err
	}
	var arr []map[string]any
	if json.Unmarshal(data, &arr) != nil {
		return false, nil
	}
	// if any result chunk contains results, consider sufficient
	for _, chunk := range arr {
		if results, ok := chunk["results"].([]any); ok && len(results) > 0 {
			return true, nil
		}
	}
	return false, nil
}

// CloneAdGroupKeywords clones up to limit keywords from source ad group to target ad group.
// This is a minimal implementation using GAQL + mutate via REST (searchStream + googleAds:mutate).
func (c *LiveClient) CloneAdGroupKeywords(ctx context.Context, customerID, fromAdGroupID, toAdGroupID string, limit int) (int, error) {
	if limit <= 0 {
		limit = 50
	}
	// 1) Query source keywords
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", customerID)
	q := fmt.Sprintf("SELECT ad_group_criterion.criterion_id, ad_group_criterion.negative, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type FROM ad_group_criterion WHERE ad_group.id = %s AND ad_group_criterion.type = KEYWORD AND ad_group_criterion.negative = FALSE LIMIT %d", fromAdGroupID, limit)
	data, _, err := c.doJSON(ctx, http.MethodPost, url, map[string]any{"query": q})
	if err != nil {
		return 0, err
	}
	var arr []map[string]any
	if json.Unmarshal(data, &arr) != nil {
		return 0, fmt.Errorf("gaql parse")
	}
	type kw struct{ text, match string }
	kws := make([]kw, 0, limit)
	for _, chunk := range arr {
		if results, ok := chunk["results"].([]any); ok {
			for _, it := range results {
				if m, ok := it.(map[string]any); ok {
					if agc, ok := m["adGroupCriterion"].(map[string]any); ok {
						if neg, _ := agc["negative"].(bool); neg {
							continue
						}
					}
					if k, ok := m["adGroupCriterion"].(map[string]any); ok {
						if kwm, ok2 := k["keyword"].(map[string]any); ok2 {
							t, _ := kwm["text"].(string)
							mt, _ := kwm["matchType"].(string)
							if strings.TrimSpace(t) != "" {
								kws = append(kws, kw{text: t, match: mt})
							}
						}
					}
				}
			}
		}
	}
	if len(kws) == 0 {
		return 0, nil
	}
	// 2) Build mutate operations to create keywords under target ad group
	target := fmt.Sprintf("customers/%s/adGroups/%s", customerID, toAdGroupID)
	ops := make([]any, 0, len(kws))
	for _, k := range kws {
		op := map[string]any{
			"create": map[string]any{
				"adGroup": target,
				"status":  "ENABLED",
				"keyword": map[string]any{"text": k.text, "matchType": k.match},
			},
		}
		ops = append(ops, map[string]any{"adGroupCriterionOperation": op})
	}
	mutateURL := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:mutate", customerID)
	body := map[string]any{"mutateOperations": ops}
	if _, _, err := c.doJSON(ctx, http.MethodPost, mutateURL, body); err != nil {
		return 0, err
	}
	return len(kws), nil
}

// CloneAdGroupAds clones up to limit Responsive Search Ads from source ad group to target ad group.
// Only supports responsive_search_ad (RSA) with headlines/descriptions/finalUrls.
func (c *LiveClient) CloneAdGroupAds(ctx context.Context, customerID, fromAdGroupID, toAdGroupID string, limit int) (int, error) {
	if limit <= 0 {
		limit = 3
	}
	// 1) Query RSA ads from source ad group
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", customerID)
	q := fmt.Sprintf("SELECT ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE ad_group.id = %s AND ad_group_ad.status = ENABLED LIMIT %d", fromAdGroupID, limit)
	data, _, err := c.doJSON(ctx, http.MethodPost, url, map[string]any{"query": q})
	if err != nil {
		return 0, err
	}
	var arr []map[string]any
	if json.Unmarshal(data, &arr) != nil {
		return 0, fmt.Errorf("gaql parse")
	}
	type rsa struct {
		headlines    []string
		descriptions []string
		finalUrls    []string
	}
	rsas := make([]rsa, 0, limit)
	for _, chunk := range arr {
		if results, ok := chunk["results"].([]any); ok {
			for _, it := range results {
				if m, ok := it.(map[string]any); ok {
					ad, _ := m["ad"].(map[string]any)
					if ad == nil {
						if aga, ok2 := m["adGroupAd"].(map[string]any); ok2 {
							ad, _ = aga["ad"].(map[string]any)
						}
					}
					if ad == nil {
						continue
					}
					rsaNode, _ := ad["responsiveSearchAd"].(map[string]any)
					if rsaNode == nil {
						continue
					}
					hs := []string{}
					if arr, ok := rsaNode["headlines"].([]any); ok {
						for _, h := range arr {
							if item, ok2 := h.(map[string]any); ok2 {
								if t, ok3 := item["text"].(string); ok3 && strings.TrimSpace(t) != "" {
									hs = append(hs, t)
								}
							}
						}
					}
					ds := []string{}
					if arr, ok := rsaNode["descriptions"].([]any); ok {
						for _, d := range arr {
							if item, ok2 := d.(map[string]any); ok2 {
								if t, ok3 := item["text"].(string); ok3 && strings.TrimSpace(t) != "" {
									ds = append(ds, t)
								}
							}
						}
					}
					fus := []string{}
					if arr, ok := ad["finalUrls"].([]any); ok {
						for _, u := range arr {
							if s, ok2 := u.(string); ok2 && strings.TrimSpace(s) != "" {
								fus = append(fus, s)
							}
						}
					}
					if len(hs) == 0 || len(ds) == 0 {
						continue
					}
					// cap headlines/descriptions per API expectations (min 3 headlines, 2 descriptions recommended)
					if len(hs) > 5 {
						hs = hs[:5]
					}
					if len(ds) > 4 {
						ds = ds[:4]
					}
					rsas = append(rsas, rsa{headlines: hs, descriptions: ds, finalUrls: fus})
					if len(rsas) >= limit {
						break
					}
				}
			}
		}
		if len(rsas) >= limit {
			break
		}
	}
	if len(rsas) == 0 {
		return 0, nil
	}
	// 2) Create RSA under target ad group
	target := fmt.Sprintf("customers/%s/adGroups/%s", customerID, toAdGroupID)
	ops := make([]any, 0, len(rsas))
	for _, a := range rsas {
		// build RSA node
		hs := make([]any, 0, len(a.headlines))
		for _, t := range a.headlines {
			hs = append(hs, map[string]any{"text": t})
		}
		ds := make([]any, 0, len(a.descriptions))
		for _, t := range a.descriptions {
			ds = append(ds, map[string]any{"text": t})
		}
		adNode := map[string]any{
			"responsiveSearchAd": map[string]any{"headlines": hs, "descriptions": ds},
		}
		if len(a.finalUrls) > 0 {
			adNode["finalUrls"] = a.finalUrls
		}
		op := map[string]any{
			"adGroupAdOperation": map[string]any{
				"create": map[string]any{
					"adGroup": target,
					"status":  "ENABLED",
					"ad":      adNode,
				},
			},
		}
		ops = append(ops, op)
	}
	mutateURL := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:mutate", customerID)
	body := map[string]any{"mutateOperations": ops}
	if _, _, err := c.doJSON(ctx, http.MethodPost, mutateURL, body); err != nil {
		return 0, err
	}
	return len(rsas), nil
}

// SetAdGroupStatus sets an ad group's status to PAUSED or ENABLED.
func (c *LiveClient) SetAdGroupStatus(ctx context.Context, customerID, adGroupID string, paused bool) error {
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:mutate", customerID)
	rn := fmt.Sprintf("customers/%s/adGroups/%s", customerID, adGroupID)
	status := "ENABLED"
	if paused {
		status = "PAUSED"
	}
	op := map[string]any{
		"adGroupOperation": map[string]any{
			"update":     map[string]any{"resourceName": rn, "status": status},
			"updateMask": "status",
		},
	}
	body := map[string]any{"mutateOperations": []any{op}}
	_, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	return err
}

// GetExperiment fetches basic fields of an experiment by resource name under a customer.
func (c *LiveClient) GetExperiment(ctx context.Context, customerID, experimentResource string) (map[string]any, error) {
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", customerID)
	// GAQL over experiment fields
	q := fmt.Sprintf("SELECT experiment.resource_name, experiment.name, experiment.status FROM experiment WHERE experiment.resource_name = '%s'", experimentResource)
	body := map[string]any{"query": q}
	data, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}
	var arr []map[string]any
	if json.Unmarshal(data, &arr) != nil {
		return nil, fmt.Errorf("gaql parse")
	}
	for _, chunk := range arr {
		if results, ok := chunk["results"].([]any); ok {
			for _, it := range results {
				if m, ok := it.(map[string]any); ok {
					if e, ok := m["experiment"].(map[string]any); ok {
						return e, nil
					}
				}
			}
		}
	}
	return map[string]any{}, nil
}

// Keyword ideas via Google Ads REST (generateKeywordIdeas)
type KeywordIdea struct {
	Text               string
	AvgMonthlySearches int
	Competition        string
}

func (c *LiveClient) KeywordIdeas(ctx context.Context, seedDomain string, seeds []string) ([]KeywordIdea, error) {
	cid := c.loginCID
	if cid == "" {
		return nil, fmt.Errorf("login customer id required")
	}
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s:generateKeywordIdeas", cid)
	body := map[string]any{
		"keywordPlanNetwork": "GOOGLE_SEARCH_AND_PARTNERS",
	}
	if seedDomain != "" {
		body["urlSeed"] = map[string]any{"url": seedDomain}
	}
	if len(seeds) > 0 {
		// Trim empties
		arr := make([]string, 0, len(seeds))
		for _, s := range seeds {
			s = strings.TrimSpace(s)
			if s != "" {
				arr = append(arr, s)
			}
		}
		if len(arr) > 0 {
			body["keywordSeed"] = map[string]any{"keywords": arr}
		}
	}
	data, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}
	// Parse results
	var resp struct {
		Results []map[string]any `json:"results"`
	}
	_ = json.Unmarshal(data, &resp)
	out := make([]KeywordIdea, 0, len(resp.Results))
	for _, r := range resp.Results {
		kw := ""
		if t, ok := r["text"].(string); ok {
			kw = t
		}
		avg := 0
		comp := "MEDIUM"
		if m, ok := r["keywordIdeaMetrics"].(map[string]any); ok {
			if v, ok := m["avgMonthlySearches"].(float64); ok {
				avg = int(v)
			}
			if v2, ok := m["competition"].(string); ok && v2 != "" {
				comp = strings.ToUpper(v2)
			}
		}
		if kw != "" {
			out = append(out, KeywordIdea{Text: kw, AvgMonthlySearches: avg, Competition: comp})
		}
	}
	return out, nil
}

// --- AB test live helpers (MVP) ---

type AdGroupMetrics struct {
	Impressions int64
	Clicks      int64
	CostMicros  int64
}

// CopyAdGroupMinimal creates a new ad group under the same campaign with name suffix.
// NOTE: This minimal copy does not clone ads/criteria; it only creates an empty group.
func (c *LiveClient) CopyAdGroupMinimal(ctx context.Context, customerID, srcAdGroupID, nameSuffix string) (string, error) {
	if nameSuffix == "" {
		nameSuffix = "_B"
	}
	// 1) Lookup source ad group campaign and name
	camp, name, err := c.lookupAdGroup(ctx, customerID, srcAdGroupID)
	if err != nil {
		return "", err
	}
	// 2) Create new ad group
	newName := name + nameSuffix
	rn, err := c.createAdGroup(ctx, customerID, camp, newName)
	if err != nil {
		return "", err
	}
	// extract id suffix after last '/'
	id := rn
	if i := strings.LastIndex(rn, "/"); i >= 0 {
		id = rn[i+1:]
	}
	return id, nil
}

func (c *LiveClient) lookupAdGroup(ctx context.Context, customerID, adGroupID string) (campaignResource, name string, err error) {
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", customerID)
	q := fmt.Sprintf("SELECT ad_group.resource_name, ad_group.name, ad_group.campaign FROM ad_group WHERE ad_group.id = %s", adGroupID)
	data, _, err := c.doJSON(ctx, http.MethodPost, url, map[string]any{"query": q})
	if err != nil {
		return "", "", err
	}
	var arr []map[string]any
	if json.Unmarshal(data, &arr) != nil {
		return "", "", fmt.Errorf("gaql parse")
	}
	for _, chunk := range arr {
		if results, ok := chunk["results"].([]any); ok {
			for _, it := range results {
				if m, ok := it.(map[string]any); ok {
					if ag, ok := m["adGroup"].(map[string]any); ok {
						name, _ = ag["name"].(string)
						campaignResource, _ = ag["campaign"].(string)
						if name != "" && campaignResource != "" {
							return campaignResource, name, nil
						}
					}
				}
			}
		}
	}
	return "", "", fmt.Errorf("ad group not found")
}

func (c *LiveClient) createAdGroup(ctx context.Context, customerID, campaignResource, name string) (resourceName string, err error) {
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/adGroups:mutate", customerID)
	body := map[string]any{
		"operations": []any{
			map[string]any{
				"create": map[string]any{
					"name":     name,
					"campaign": campaignResource,
					"status":   "ENABLED",
				},
			},
		},
	}
	data, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	if err != nil {
		return "", err
	}
	var resp struct {
		Results []struct {
			ResourceName string `json:"resourceName"`
		} `json:"results"`
	}
	if json.Unmarshal(data, &resp) != nil || len(resp.Results) == 0 {
		return "", fmt.Errorf("create ad group failed")
	}
	return resp.Results[0].ResourceName, nil
}

// LookupAdGroupCampaign exposes campaign resource and ad group name for a given ad group ID.
func (c *LiveClient) LookupAdGroupCampaign(ctx context.Context, customerID, adGroupID string) (campaignResource, name string, err error) {
	return c.lookupAdGroup(ctx, customerID, adGroupID)
}

// RefreshAdGroupMetrics returns last 7 days metrics per ad group (impressions/clicks/cost_micros)
func (c *LiveClient) RefreshAdGroupMetrics(ctx context.Context, customerID string, adGroupIDs []string, dateRange string) (map[string]AdGroupMetrics, error) {
	if dateRange == "" {
		dateRange = "LAST_7_DAYS"
	}
	// Build IN clause for GAQL
	in := make([]string, 0, len(adGroupIDs))
	for _, id := range adGroupIDs {
		in = append(in, id)
	}
	// Note: GAQL IN for id fields expects numeric list
	cond := strings.Join(in, ",")
	q := fmt.Sprintf("SELECT ad_group.id, metrics.impressions, metrics.clicks, metrics.cost_micros FROM ad_group WHERE ad_group.id IN (%s) DURING %s", cond, dateRange)
	url := fmt.Sprintf("https://googleads.googleapis.com/v16/customers/%s/googleAds:searchStream", customerID)
	data, _, err := c.doJSON(ctx, http.MethodPost, url, map[string]any{"query": q})
	if err != nil {
		return nil, err
	}
	var arr []map[string]any
	if json.Unmarshal(data, &arr) != nil {
		return nil, fmt.Errorf("gaql parse")
	}
	out := map[string]AdGroupMetrics{}
	for _, chunk := range arr {
		if results, ok := chunk["results"].([]any); ok {
			for _, it := range results {
				if m, ok := it.(map[string]any); ok {
					var id string
					if ag, ok := m["adGroup"].(map[string]any); ok {
						if v, ok := ag["id"].(string); ok {
							id = v
						}
					}
					if id == "" {
						continue
					}
					var imps, clicks, cost int64
					if mt, ok := m["metrics"].(map[string]any); ok {
						if v, ok := mt["impressions"].(string); ok {
							if n, err := strconv.ParseInt(v, 10, 64); err == nil {
								imps = n
							}
						}
						if v, ok := mt["clicks"].(string); ok {
							if n, err := strconv.ParseInt(v, 10, 64); err == nil {
								clicks = n
							}
						}
						if v, ok := mt["costMicros"].(string); ok {
							if n, err := strconv.ParseInt(v, 10, 64); err == nil {
								cost = n
							}
						}
						if v, ok := mt["cost_micros"].(string); ok {
							if n, err := strconv.ParseInt(v, 10, 64); err == nil {
								cost = n
							}
						}
					}
					out[id] = AdGroupMetrics{Impressions: imps, Clicks: clicks, CostMicros: cost}
				}
			}
		}
	}
	return out, nil
}

// --- Experiments (minimal) ---

// CreateExperiment creates a minimal Experiment resource and returns its resource name.
// Note: This is a best-effort minimal REST call. Fields may vary across API versions.
func (c *LiveClient) CreateExperiment(ctx context.Context, customerID, name string) (string, error) {
	url := "https://googleads.googleapis.com/v16/customers/" + customerID + "/experiments:mutate"
	body := map[string]any{
		"operations": []any{
			map[string]any{
				"create": map[string]any{
					"name": name,
					// Keep type generic to avoid additional constraints; server may assign defaults.
					// "type": "SEARCH_CUSTOM",
					// Optional start/end time may be set by user later.
				},
			},
		},
	}
	data, _, err := c.doJSON(ctx, http.MethodPost, url, body)
	if err != nil {
		return "", err
	}
	var resp struct {
		Results []struct {
			ResourceName string `json:"resourceName"`
		} `json:"results"`
	}
	if json.Unmarshal(data, &resp) != nil || len(resp.Results) == 0 {
		return "", fmt.Errorf("experiment create parse failed")
	}
	return resp.Results[0].ResourceName, nil
}

// CreateExperimentArms creates two arms with traffic split. Best-effort minimal payload.
// The API expects Experiment resource name and per-arm trafficSplit (0-100).
func (c *LiveClient) CreateExperimentArms(ctx context.Context, customerID, experimentResource string, splitA, splitB int) (armA, armB string, err error) {
	if splitA < 0 {
		splitA = 0
	}
	if splitB < 0 {
		splitB = 0
	}
	if splitA+splitB == 0 {
		splitA, splitB = 50, 50
	}
	url := "https://googleads.googleapis.com/v16/customers/" + customerID + "/experimentArms:mutate"
	// NOTE: Some fields (e.g., control, trafficSplit, name, experiment) are commonly used in GA.
	ops := []any{
		map[string]any{"create": map[string]any{
			"name":         "A",
			"experiment":   experimentResource,
			"trafficSplit": splitA,
			"control":      true,
		}},
		map[string]any{"create": map[string]any{
			"name":         "B",
			"experiment":   experimentResource,
			"trafficSplit": splitB,
			"control":      false,
		}},
	}
	body := map[string]any{"operations": ops}
	data, _, err2 := c.doJSON(ctx, http.MethodPost, url, body)
	if err2 != nil {
		return "", "", err2
	}
	var resp struct {
		Results []struct {
			ResourceName string `json:"resourceName"`
		} `json:"results"`
	}
	if json.Unmarshal(data, &resp) != nil || len(resp.Results) < 2 {
		return "", "", fmt.Errorf("experiment arms create parse failed")
	}
	a := resp.Results[0].ResourceName
	b := resp.Results[1].ResourceName
	return a, b, nil
}
