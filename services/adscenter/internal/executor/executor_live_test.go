//go:build ads_live

package executor

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ads"
	"golang.org/x/oauth2"
)

type rawDoerFunc func(*http.Request) (*http.Response, error)

func (f rawDoerFunc) DoRaw(r *http.Request) (*http.Response, error) { return f(r) }

func TestLiveExecutionRequiresApprovedWorkflow(t *testing.T) {
	ex := New(Config{LiveMutate: true})
	res, err := ex.ExecuteOne(context.Background(), Action{Type: "ADJUST_BUDGET"})
	if !errors.Is(err, ads.ErrLiveWriteUnavailable) || res.Success {
		t.Fatalf("unapproved live action: %+v %v", res, err)
	}
}

func TestMutateValidationUsesV25AndNeverClaimsExecution(t *testing.T) {
	ex := New(Config{CustomerID: "2222222222", LoginCustomerID: "1111111111"})
	ex.ts = oauth2.StaticTokenSource(&oauth2.Token{AccessToken: "test-only"})
	ex.http = rawDoerFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/v25/customers/2222222222/googleAds:mutate" {
			t.Fatalf("wrong API version/customer: %s", r.URL)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["validateOnly"] != true || body["partialFailure"] != false {
			t.Fatalf("unsafe mutation: %+v", body)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("{}"))}, nil
	})
	res, err := ex.mutate(context.Background(), []map[string]any{{"campaignOperation": map[string]any{"updateMask": "status"}}}, true)
	if err != nil || !res.Success || res.Details["executed"] != false || res.Details["googleValidated"] != true {
		t.Fatalf("validation result: %+v %v", res, err)
	}
}

func TestMutationErrorsCannotBecomeSuccess(t *testing.T) {
	for _, body := range []string{"not-json", "null", `{"partialFailureError":{"code":3}}`, `{"error":{"status":"PERMISSION_DENIED"}}`, `{} {}`} {
		ex := New(Config{CustomerID: "2222222222"})
		ex.ts = oauth2.StaticTokenSource(&oauth2.Token{AccessToken: "test-only"})
		ex.http = rawDoerFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}, nil
		})
		res, err := ex.mutate(context.Background(), []map[string]any{{"campaignOperation": map[string]any{}}}, true)
		if err == nil || res.Success {
			t.Fatalf("accepted response %s: %+v", body, res)
		}
	}
	ex := New(Config{})
	res, err := ex.mutate(context.Background(), nil, true)
	if err == nil || res.Success {
		t.Fatalf("empty validation falsely passed: %+v", res)
	}
}

func TestValidationErrorsExposeNoRawProviderData(t *testing.T) {
	ex := New(Config{CustomerID: "2222222222"})
	ex.ts = oauth2.StaticTokenSource(&oauth2.Token{AccessToken: "test-only"})
	ex.http = rawDoerFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 400, Body: io.NopCloser(strings.NewReader(`{"error":{"message":"private-refresh-token","details":[{"errors":[{"errorCode":{"fieldError":"REQUIRED"},"trigger":{"stringValue":"private-client-secret"}}]}]}}`))}, nil
	})
	res, err := ex.mutate(context.Background(), []map[string]any{{"campaignOperation": map[string]any{}}}, true)
	data, _ := json.Marshal(res)
	if err == nil || res.Success || strings.Contains(string(data), "private-") {
		t.Fatal("validation exposed raw provider error or claimed success")
	}
	if res.Details["googleValidated"] != false || res.Details["executed"] != false {
		t.Fatal("failed validation lost execution truth")
	}
}

func TestValidationRejectsMalformedCustomerBeforeRequest(t *testing.T) {
	ex := New(Config{CustomerID: "2222222222#fragment"})
	ex.http = rawDoerFunc(func(*http.Request) (*http.Response, error) { t.Fatal("malformed customer sent"); return nil, nil })
	if _, err := ex.mutate(context.Background(), []map[string]any{{"campaignOperation": map[string]any{}}}, true); err == nil {
		t.Fatal("malformed target accepted")
	}
	if _, err := ex.searchStream(context.Background(), "SELECT campaign.id FROM campaign"); err == nil {
		t.Fatal("malformed read target accepted")
	}
}
