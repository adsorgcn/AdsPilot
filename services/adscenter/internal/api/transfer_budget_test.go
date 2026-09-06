package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUnimplementedTransferBudgetDoesNotReportSuccess(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/adscenter/transfer-budget",
		strings.NewReader(`{"from_account_id":"1111111111","to_account_id":"2222222222","amount":10}`))
	req = withUserContext(req, "test-user")
	w := httptest.NewRecorder()
	(&MiscHandler{}).HandleTransferBudget(w, req)
	if w.Code != http.StatusNotImplemented {
		t.Fatalf("unimplemented transfer returned %d: %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), `"success":true`) || strings.Contains(w.Body.String(), "processed_at") {
		t.Fatalf("transfer claimed a fabricated outcome: %s", w.Body.String())
	}
}
