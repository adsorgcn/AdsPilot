package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIncompleteExecutionEndpointsFailClosed(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://unreachable.invalid/database")
	diagnose := NewDiagnoseHandler(nil, nil)
	oas := &OASImpl{}
	ab := NewABTestHandler(nil)
	mcc := NewMCCHandler(nil, nil)
	rollback := NewBulkRollbackHandler(nil)
	handlers := map[string]http.HandlerFunc{
		"ab create":         ab.HandleCreate,
		"ab graduate":       ab.HandleGraduate,
		"mcc link":          mcc.HandleLink,
		"mcc unlink":        mcc.HandleUnlink,
		"legacy rollback":   rollback.HandleRollback,
		"diagnose execute":  diagnose.HandleDiagnoseExecute,
		"diagnose metrics":  diagnose.HandleDiagnoseMetrics,
		"google validation": oas.ValidateBulkActions,
		"rollback plan":     func(w http.ResponseWriter, r *http.Request) { oas.GetRollbackPlan(w, r, "operation") },
		"rollback execute":  func(w http.ResponseWriter, r *http.Request) { oas.RollbackExecute(w, r, "operation") },
	}
	for name, handler := range handlers {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(`{"metrics":{"dailyBudget":0}}`))
			req = withUserContext(req, "test-user")
			w := httptest.NewRecorder()
			handler(w, req)
			if w.Code != http.StatusNotImplemented {
				t.Fatalf("unsupported endpoint returned %d: %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestDiagnosticPlansRemainValidateOnly(t *testing.T) {
	plan := buildPlanFromMetrics(map[string]any{"dailyBudget": 0})
	if !plan.ValidateOnly || len(plan.Actions) == 0 {
		t.Fatalf("unsafe or empty diagnostic plan: %+v", plan)
	}
}
func TestLivePreflightNeverFallsBackToLocalChecks(t *testing.T) {
	t.Setenv("ADS_PRECHECK_ENABLE_LIVE", "false")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/adscenter/preflight",
		bytes.NewBufferString(`{"accountId":"2222222222","validateOnly":false}`))
	req = withUserContext(req, "test-user")
	w := httptest.NewRecorder()
	NewPreflightHandler(nil, nil).HandlePreflight(w, req)
	if w.Code != http.StatusNotImplemented {
		t.Fatalf("live preflight silently fell back: %d %s", w.Code, w.Body.String())
	}
}

func TestLocalPreflightIsExplicitlyNotGoogleValidation(t *testing.T) {
	t.Setenv("ADS_PRECHECK_ENABLE_LIVE", "false")
	t.Setenv("FIRESTORE_ENABLED", "0")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/adscenter/preflight",
		bytes.NewBufferString(`{"accountId":"2222222222","validateOnly":true}`))
	req = withUserContext(req, "test-user")
	w := httptest.NewRecorder()
	NewPreflightHandler(nil, nil).HandlePreflight(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("local preflight failed: %d %s", w.Code, w.Body.String())
	}
	if !bytes.Contains(w.Body.Bytes(), []byte(`"googleValidated":false`)) ||
		!bytes.Contains(w.Body.Bytes(), []byte(`"mode":"local_checks"`)) {
		t.Fatalf("local checks presented as live validation: %s", w.Body.String())
	}
}
