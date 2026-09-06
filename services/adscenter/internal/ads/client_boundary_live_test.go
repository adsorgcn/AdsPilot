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

type failingTokenSource struct{}

func (failingTokenSource) Token() (*oauth2.Token, error) {
	return nil, &oauth2.RetrieveError{Body: []byte("private-token-in-provider-error")}
}

func TestLiveProviderAndOAuthErrorsDoNotLeakSecrets(t *testing.T) {
	client := contractClient(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 403, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"error":{"message":"private-token-in-provider-error"}}`))}, nil
	})
	_, err := client.ListAccessibleCustomers(context.Background())
	if err == nil || strings.Contains(err.Error(), "private-token") {
		t.Fatal("provider error not safely redacted")
	}
	client.ts = failingTokenSource{}
	_, err = client.ListAccessibleCustomers(context.Background())
	if err == nil || strings.Contains(err.Error(), "private-token") {
		t.Fatal("OAuth error not safely redacted")
	}
}

func TestLiveClientNeverFollowsRedirectWithCredentials(t *testing.T) {
	calls := 0
	client := contractClient(func(r *http.Request) (*http.Response, error) {
		calls++
		if calls > 1 {
			t.Fatal("credentials forwarded to redirect target")
		}
		return &http.Response{StatusCode: 307, Header: http.Header{"Location": []string{"https://untrusted.example/collect"}}, Body: io.NopCloser(strings.NewReader("{}"))}, nil
	})
	if _, err := client.ListAccessibleCustomers(context.Background()); err == nil || calls != 1 {
		t.Fatal("redirect became successful read")
	}
}

func TestLiveReadRejectsNullAndErrorEnvelopes(t *testing.T) {
	for _, body := range []string{"null", `{"error":{"status":"PERMISSION_DENIED"}}`, `{"resourceNames":["customers/1111111111/extra"]}`} {
		client := contractClient(func(*http.Request) (*http.Response, error) { return jsonResponse(body), nil })
		if _, err := client.ListAccessibleCustomers(context.Background()); err == nil {
			t.Fatalf("invalid read accepted: %s", body)
		}
	}
}

func TestKeywordPaginationAndMissingMetrics(t *testing.T) {
	calls := 0
	client := contractClient(func(r *http.Request) (*http.Response, error) {
		calls++
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if calls == 1 {
			if body["pageToken"] != nil {
				t.Fatal("first page has unexpected token")
			}
			return jsonResponse(`{"results":[{"text":"unknown volume"},{"text":"known zero","keywordIdeaMetrics":{"avgMonthlySearches":"0"}}],"nextPageToken":"next-page"}`), nil
		}
		if body["pageToken"] != "next-page" || body["keywordSeed"] == nil {
			t.Fatal("pagination changed seed parameters")
		}
		return jsonResponse(`{"results":[{"text":"large volume","keywordIdeaMetrics":{"avgMonthlySearches":"9007199254740993"}}]}`), nil
	})
	ideas, err := client.KeywordIdeas(context.Background(), "", []string{"cars"})
	if err != nil || calls != 2 || len(ideas) != 3 {
		t.Fatalf("pagination failed: %v", err)
	}
	if ideas[0].AvgMonthlySearches != nil || ideas[1].AvgMonthlySearches == nil || *ideas[1].AvgMonthlySearches != 0 || *ideas[2].AvgMonthlySearches != 9007199254740993 {
		t.Fatal("unknown, zero or exact int64 lost")
	}
}

func TestKeywordPaginationFailureNeverReturnsPartialAsComplete(t *testing.T) {
	for _, broken := range []string{"repeat", "error"} {
		calls := 0
		client := contractClient(func(*http.Request) (*http.Response, error) {
			calls++
			if calls == 2 && broken == "error" {
				return nil, errors.New("fake network failure")
			}
			return jsonResponse(`{"results":[{"text":"cars"}],"nextPageToken":"same-token"}`), nil
		})
		ideas, err := client.KeywordIdeas(context.Background(), "", []string{"cars"})
		if err == nil || ideas != nil || calls != 2 {
			t.Fatal("incomplete keyword pages returned as successful research")
		}
	}
}

func TestKeywordInvalidMetricsAndTargetFailClosed(t *testing.T) {
	for _, value := range []string{`"-1"`, `1.5`, `"9223372036854775808"`, `true`} {
		client := contractClient(func(*http.Request) (*http.Response, error) {
			return jsonResponse(`{"results":[{"text":"cars","keywordIdeaMetrics":{"avgMonthlySearches":` + value + `}}]}`), nil
		})
		if _, err := client.KeywordIdeas(context.Background(), "", []string{"cars"}); err == nil {
			t.Fatalf("invalid count accepted: %s", value)
		}
	}
	client := contractClient(func(*http.Request) (*http.Response, error) { t.Fatal("invalid target sent"); return nil, nil })
	if _, err := client.GetCampaignsCount(context.Background(), "2222222222?override"); err == nil {
		t.Fatal("invalid customer accepted")
	}
}
