package ads

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
)

var customerIDPattern = regexp.MustCompile(`^[0-9]{10}$`)
var readPathPattern = regexp.MustCompile(`^/customers/[0-9]{10}(/googleAds:searchStream|:generateKeywordIdeas)$`)
var mutatePathPattern = regexp.MustCompile(`^/customers/[0-9]{10}/[A-Za-z]+:mutate$`)
var errorCodePattern = regexp.MustCompile(`^[a-z][A-Za-z]{0,80}Error$`)
var enumPattern = regexp.MustCompile(`^[A-Z][A-Z_0-9]{0,100}$`)
var requestIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

// ValidCustomerID distinguishes explicit client IDs from query/path fragments.
func ValidCustomerID(value string) bool { return customerIDPattern.MatchString(value) }

// ValidateRequestBoundary restricts this optional adapter to its implemented
// read operations and explicit validate-only mutates. Exact canonical paths
// prevent an untrusted customer ID or query suffix bypassing write containment.
func ValidateRequestBoundary(method, rawURL string, body any) error {
	u, err := url.Parse(rawURL)
	if err != nil || u.Scheme != "https" || u.Host != "googleads.googleapis.com" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.RawPath != "" {
		return errors.New("invalid Google Ads request boundary")
	}
	path := strings.TrimPrefix(u.Path, "/"+APIVersion)
	if u.Path != "/"+APIVersion+path {
		return errors.New("unsupported Google Ads API version")
	}
	if method == http.MethodGet && path == "/customers:listAccessibleCustomers" {
		return nil
	}
	if method == http.MethodPost && readPathPattern.MatchString(path) {
		return nil
	}
	if method == http.MethodPost && mutatePathPattern.MatchString(path) {
		request, ok := body.(map[string]any)
		if ok && request["validateOnly"] == true {
			return nil
		}
		return ErrLiveWriteUnavailable
	}
	return errors.New("unsupported Google Ads request method or path")
}

// ProviderError preserves typed diagnostic facts without provider messages,
// triggers, raw bodies, or credentials. Error() is deliberately safe for logs.
type ProviderError struct {
	HTTPStatus int      `json:"httpStatus"`
	Status     string   `json:"status,omitempty"`
	RequestID  string   `json:"requestId,omitempty"`
	Codes      []string `json:"codes,omitempty"`
}

func (e *ProviderError) Error() string {
	return fmt.Sprintf("Google Ads request failed (HTTP %d)", e.HTTPStatus)
}

// NewProviderError extracts only bounded, typed metadata. Callers must not
// return the original response map or raw response bytes in error details.
func NewProviderError(status int, headers http.Header, data []byte) *ProviderError {
	e := &ProviderError{HTTPStatus: status}
	if id := headers.Get("request-id"); requestIDPattern.MatchString(id) {
		e.RequestID = id
	}
	var root map[string]json.RawMessage
	if json.Unmarshal(data, &root) != nil {
		return e
	}
	for _, key := range []string{"error", "partialFailureError"} {
		var envelope struct {
			Status  string `json:"status"`
			Details []struct {
				RequestID string `json:"requestId"`
				Errors    []struct {
					ErrorCode map[string]string `json:"errorCode"`
				} `json:"errors"`
			} `json:"details"`
		}
		if json.Unmarshal(root[key], &envelope) != nil {
			continue
		}
		if enumPattern.MatchString(envelope.Status) {
			e.Status = envelope.Status
		}
		seen := map[string]bool{}
		for _, detail := range envelope.Details {
			if e.RequestID == "" && requestIDPattern.MatchString(detail.RequestID) {
				e.RequestID = detail.RequestID
			}
			for _, failure := range detail.Errors {
				for field, code := range failure.ErrorCode {
					if len(e.Codes) < 100 && errorCodePattern.MatchString(field) && enumPattern.MatchString(code) {
						value := strings.ToUpper(field[:1]) + field[1:] + "." + code
						if !seen[value] {
							e.Codes = append(e.Codes, value)
							seen[value] = true
						}
					}
				}
			}
		}
	}
	sort.Strings(e.Codes)
	return e
}
