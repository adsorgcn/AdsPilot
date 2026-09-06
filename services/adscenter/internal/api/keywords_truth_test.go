package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestKeywordDraftDoesNotMasqueradeAsGoogleResearch(t *testing.T) {
	var first string
	for i := 0; i < 8; i++ {
		req := withUserContext(httptest.NewRequest(http.MethodPost, "/keywords/expand", strings.NewReader(`{"seedKeywords":["car","discount","review"],"seedDomain":"https://example.com","maxResults":12}`)), "local")
		response := httptest.NewRecorder()
		NewKeywordsHandler(nil).HandleExpand(response, req)
		if response.Code != 200 || response.Header().Get("X-AdsPilot-Data-Source") != "local_rule_based_draft" || response.Header().Get("X-AdsPilot-Google-Verified") != "false" {
			t.Fatal("draft provenance not explicit")
		}
		if strings.Contains(response.Body.String(), "avgMonthlySearches") {
			t.Fatal("draft invented provider volume")
		}
		if i == 0 {
			first = response.Body.String()
		} else if response.Body.String() != first {
			t.Fatal("same draft inputs produced nondeterministic ordering")
		}
	}
}
