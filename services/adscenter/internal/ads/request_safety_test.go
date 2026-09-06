package ads

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestRequestBoundaryRejectsTargetAndWriteBypasses(t *testing.T) {
	for _, suffix := range []string{
		"/customers/2222222222/googleAds:mutate?validateOnly=false",
		"/customers/2222222222/googleAds:mutate#fragment",
		"/customers/2222222222/googleAds:mutate/",
		"/customers/2222222222:uploadClickConversions",
		"/customers/2222222222/../../customers/3333333333/googleAds:searchStream",
		"/customers/123/googleAds:searchStream",
		"/customers/2222222222%2fgoogleAds:searchStream",
	} {
		if err := ValidateRequestBoundary(http.MethodPost, APIBaseURL+suffix, map[string]any{}); err == nil {
			t.Fatalf("accepted unsafe path %s", suffix)
		}
	}
	for _, method := range []string{http.MethodPut, http.MethodPatch, http.MethodDelete} {
		if err := ValidateRequestBoundary(method, APIBaseURL+"/customers/2222222222/googleAds:searchStream", nil); err == nil {
			t.Fatalf("accepted %s", method)
		}
	}
	if err := ValidateRequestBoundary(http.MethodPost, "https://untrusted.example/v25/customers/2222222222/googleAds:searchStream", nil); err == nil {
		t.Fatal("accepted foreign credential destination")
	}
	if err := ValidateRequestBoundary(http.MethodPost, APIBaseURL+"/customers/2222222222/googleAds:mutate", map[string]any{"validateOnly": true}); err != nil {
		t.Fatal(err)
	}
}

func TestProviderErrorPreservesCodesNotRawMessages(t *testing.T) {
	data := []byte(`{"error":{"status":"PERMISSION_DENIED","message":"private-refresh-token","details":[{"requestId":"request_123","errors":[{"errorCode":{"authorizationError":"DEVELOPER_TOKEN_PROHIBITED"},"message":"private-client-secret","trigger":{"stringValue":"private-developer-token"}}]}]}}`)
	err := NewProviderError(403, make(http.Header), data)
	encoded, _ := json.Marshal(err)
	if strings.Contains(string(encoded)+err.Error(), "private-") {
		t.Fatal("provider error echoed sensitive body data")
	}
	if err.RequestID != "request_123" || err.Status != "PERMISSION_DENIED" || len(err.Codes) != 1 || err.Codes[0] != "AuthorizationError.DEVELOPER_TOKEN_PROHIBITED" {
		t.Fatalf("lost structured diagnostic facts: %s", encoded)
	}
}
