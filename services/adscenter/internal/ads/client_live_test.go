//go:build ads_live

package ads

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"golang.org/x/oauth2"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func contractClient(fn roundTripFunc) *LiveClient {
	return &LiveClient{
		http: &http.Client{Transport: fn}, devToken: "test-developer",
		loginCID: "1111111111", customerID: "2222222222",
		ts: oauth2.StaticTokenSource(&oauth2.Token{AccessToken: "test-only"}),
	}
}
func jsonResponse(body string) *http.Response {
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}
}

func TestAccessibleCustomersUseSupportedVersion(t *testing.T) {
	client := contractClient(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != "https://googleads.googleapis.com/v25/customers:listAccessibleCustomers" || r.Method != http.MethodGet {
			t.Fatalf("wrong request: %s %s", r.Method, r.URL)
		}
		return jsonResponse(`{"resourceNames":["customers/2222222222"]}`), nil
	})
	customers, err := client.ListAccessibleCustomers(context.Background())
	if err != nil || len(customers) != 1 {
		t.Fatalf("customers %v error %v", customers, err)
	}
}

func TestKeywordIdeasUseTargetCustomerAndSingleSeed(t *testing.T) {
	client := contractClient(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/v25/customers/2222222222:generateKeywordIdeas" || r.Header.Get("login-customer-id") != "1111111111" {
			t.Fatalf("manager and target confused: %s", r.URL)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		seed, ok := body["keywordAndUrlSeed"].(map[string]any)
		if !ok || seed["url"] != "https://example.com" || body["urlSeed"] != nil || body["keywordSeed"] != nil {
			t.Fatalf("invalid oneof seed: %#v", body)
		}
		return jsonResponse(`{"results":[{"text":"electric cars","keywordIdeaMetrics":{"avgMonthlySearches":"12345","competition":"HIGH"}}]}`), nil
	})
	ideas, err := client.KeywordIdeas(context.Background(), "https://example.com", []string{" cars ", ""})
	if err != nil || len(ideas) != 1 || ideas[0].AvgMonthlySearches == nil || *ideas[0].AvgMonthlySearches != 12345 {
		t.Fatalf("bad Google int64 metrics: %+v %v", ideas, err)
	}
}

func TestKeywordIdeasRequireExplicitTarget(t *testing.T) {
	client := contractClient(func(r *http.Request) (*http.Response, error) { t.Fatal("request must not be sent"); return nil, nil })
	client.customerID = ""
	if _, err := client.KeywordIdeas(context.Background(), "", []string{"cars"}); err == nil {
		t.Fatal("manager was used as an implicit target")
	}
}

func TestLiveClientCannotIssueUnapprovedWrites(t *testing.T) {
	client := contractClient(func(r *http.Request) (*http.Response, error) { t.Fatal("write must not be sent"); return nil, nil })
	_, _, err := client.doJSON(context.Background(), http.MethodPost, APIBaseURL+"/customers/2222222222/googleAds:mutate",
		map[string]any{"mutateOperations": []any{}})
	if !errors.Is(err, ErrLiveWriteUnavailable) {
		t.Fatalf("write returned %v", err)
	}
}

func TestMalformedAndPartialFailureResponsesAreNotSuccess(t *testing.T) {
	for _, body := range []string{"not-json", `{"partialFailureError":{"code":3,"message":"rejected"}}`} {
		client := contractClient(func(r *http.Request) (*http.Response, error) { return jsonResponse(body), nil })
		if _, err := client.ListAccessibleCustomers(context.Background()); err == nil {
			t.Fatalf("accepted %s", body)
		}
	}
}

func TestMissingExperimentIsNotVerified(t *testing.T) {
	client := contractClient(func(r *http.Request) (*http.Response, error) { return jsonResponse("[]"), nil })
	if experiment, err := client.GetExperiment(context.Background(), "2222222222", "customers/2222222222/experiments/123"); experiment != nil || err == nil {
		t.Fatalf("missing experiment falsely verified: %+v %v", experiment, err)
	}
}
func TestTrackingAndBudgetReadActualValues(t *testing.T) {
	for _, tc := range []struct {
		status  string
		want    bool
		wantErr bool
	}{
		{"NOT_CONVERSION_TRACKED", false, false},
		{"CONVERSION_TRACKING_MANAGED_BY_SELF", true, false},
		{"UNKNOWN", false, true},
	} {
		client := contractClient(func(r *http.Request) (*http.Response, error) {
			return jsonResponse(`[{"results":[{"customer":{"conversionTrackingSetting":{"conversionTrackingStatus":"` + tc.status + `"}}}]}]`), nil
		})
		got, err := client.HasActiveConversionTracking(context.Background(), "2222222222")
		if got != tc.want || (err != nil) != tc.wantErr {
			t.Fatalf("tracking %s => %v %v", tc.status, got, err)
		}
	}
	client := contractClient(func(r *http.Request) (*http.Response, error) {
		return jsonResponse(`[{"results":[{"campaignBudget":{"amountMicros":"0"}}]}]`), nil
	})
	if got, err := client.HasSufficientBudget(context.Background(), "2222222222"); got || err != nil {
		t.Fatalf("zero budget treated as sufficient: %v %v", got, err)
	}
}

func TestAdGroupMetricsUseValidDateClause(t *testing.T) {
	client := contractClient(func(r *http.Request) (*http.Response, error) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		query, _ := body["query"].(string)
		if !strings.Contains(query, "AND segments.date DURING LAST_7_DAYS") {
			t.Fatalf("invalid GAQL: %s", query)
		}
		return jsonResponse("[]"), nil
	})
	if _, err := client.RefreshAdGroupMetrics(context.Background(), "2222222222", []string{"123"}, "LAST_7_DAYS"); err != nil {
		t.Fatal(err)
	}
	if _, err := client.RefreshAdGroupMetrics(context.Background(), "2222222222", []string{"1) OR 1=1"}, "LAST_7_DAYS"); err == nil {
		t.Fatal("accepted untrusted GAQL fragment")
	}
}
