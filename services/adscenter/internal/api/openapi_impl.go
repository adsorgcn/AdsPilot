package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	rlredis "github.com/ScientificInternet/Google-Monetize/pkg/ratelimitredis"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/handlers"
	api "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/oapi"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ratelimit"
)

// OASImpl implements the OpenAPI server interface
// It delegates most calls to existing handlers in this package
type OASImpl struct {
	DB    *sql.DB
	Cache *pcache.Cache
}

// NewOASImpl creates a new OpenAPI implementation
func NewOASImpl(db *sql.DB, cache *pcache.Cache) *OASImpl {
	return &OASImpl{
		DB:    db,
		Cache: cache,
	}
}

// OAuth endpoints

func (h *OASImpl) ListAccounts(w http.ResponseWriter, r *http.Request) {
	NewMiscHandler(h.DB, h.Cache).HandleAccounts(w, r)
}

func (h *OASImpl) GetOAuthUrl(w http.ResponseWriter, r *http.Request) {
	NewOAuthHandler(h.DB).HandleOAuthURL(w, r)
}

func (h *OASImpl) OauthCallback(w http.ResponseWriter, r *http.Request) {
	NewOAuthHandler(h.DB).HandleOAuthCallback(w, r)
}

func (h *OASImpl) OauthRevoke(w http.ResponseWriter, r *http.Request) {
	// Local model: revoke the token at Google and delete the on-machine
	// credential. No server-side per-user token storage is involved.
	NewOAuthHandler(h.DB).HandleOAuthRevoke(w, r)
}

// Bulk Actions endpoints

func (h *OASImpl) SubmitBulkActions(w http.ResponseWriter, r *http.Request) {
	// Cross-instance RPM gate for plan submission
	if h != nil && h.Cache != nil && h.Cache.Ready() {
		if uid, _ := r.Context().Value(middleware.UserIDKey).(string); strings.TrimSpace(uid) != "" {
			planName := ratelimit.ResolveUserPlan(r)
			pol := ratelimit.LoadPolicy(r.Context())
			rl := pol.For(planName, "mutate")
			if rl.RPM > 0 {
				if rr, _ := rlredis.AllowRPM(r.Context(), h.Cache, uid+":submit", rl.RPM); !rr.Allowed {
					if rr.RetryAfterMs > 0 {
						w.Header().Set("Retry-After", string(rune((rr.RetryAfterMs+999)/1000)))
					}
					apiErr := apierrors.RateLimited(int(rr.RetryAfterMs))
					apiErr.WriteJSON(w, r)
					return
				}
			}
		}
	}
	NewBulkActionsHandler(h.DB).HandleSubmitBulkActions(w, r)
}

// ListBulkActions, GetBulkAction, GetBulkActionPlan, ValidateBulkActions
// are implemented in openapi_impl_extended.go

// Rollback endpoints

func (h *OASImpl) GetBulkActionAudits(w http.ResponseWriter, r *http.Request, id string) {
	r2 := r.Clone(r.Context())
	r2.URL.Path = "/api/v1/adscenter/bulk-actions/" + id + "/audits"
	NewBulkRollbackHandler(h.DB).HandleAudits(w, r2)
}

func (h *OASImpl) RollbackBulkAction(w http.ResponseWriter, r *http.Request, id string) {
	r2 := r.Clone(r.Context())
	r2.URL.Path = "/api/v1/adscenter/bulk-actions/" + id + "/rollback"
	NewBulkRollbackHandler(h.DB).HandleRollback(w, r2)
}

// GetRollbackPlan, RollbackExecute, GetRollbackReport
// are implemented in openapi_impl_extended.go

// MCC endpoints

func (h *OASImpl) MccLink(w http.ResponseWriter, r *http.Request) {
	NewMCCHandler(h.DB, h.Cache).HandleLink(w, r)
}

func (h *OASImpl) MccStatus(w http.ResponseWriter, r *http.Request, params api.MccStatusParams) {
	// Attach query param to request URL
	q := r.URL.Query()
	q.Set("customerId", params.CustomerId)
	r.URL.RawQuery = q.Encode()
	NewMCCHandler(h.DB, h.Cache).HandleStatus(w, r)
}

func (h *OASImpl) MccUnlink(w http.ResponseWriter, r *http.Request) {
	NewMCCHandler(h.DB, h.Cache).HandleUnlink(w, r)
}

func (h *OASImpl) MccRefresh(w http.ResponseWriter, r *http.Request) {
	NewMCCHandler(h.DB, h.Cache).HandleRefresh(w, r)
}

func (h *OASImpl) ListMccLinks(w http.ResponseWriter, r *http.Request, params api.ListMccLinksParams) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

// Diagnose endpoints

func (h *OASImpl) Diagnose(w http.ResponseWriter, r *http.Request) {
	NewDiagnoseHandler(h.DB, h.Cache).HandleDiagnose(w, r)
}

func (h *OASImpl) DiagnosePlan(w http.ResponseWriter, r *http.Request) {
	NewDiagnoseHandler(h.DB, h.Cache).HandleDiagnosePlan(w, r)
}

func (h *OASImpl) DiagnoseExecute(w http.ResponseWriter, r *http.Request) {
	NewDiagnoseHandler(h.DB, h.Cache).HandleDiagnoseExecute(w, r)
}

func (h *OASImpl) GetDiagnoseMetrics(w http.ResponseWriter, r *http.Request, params api.GetDiagnoseMetricsParams) {
	NewDiagnoseHandler(h.DB, h.Cache).HandleDiagnoseMetrics(w, r)
}

// Keywords endpoints

func (h *OASImpl) ExpandKeywords(w http.ResponseWriter, r *http.Request) {
	NewKeywordsHandler(h.DB).HandleExpand(w, r)
}

// Preflight endpoints

func (h *OASImpl) RunPreflight(w http.ResponseWriter, r *http.Request) {
	NewPreflightHandler(h.DB, h.Cache).HandlePreflight(w, r)
}

// Settings endpoints

func (h *OASImpl) GetLinkRotationSettings(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *OASImpl) UpdateLinkRotationSettings(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

// Audit endpoints

// ListAuditEvents is implemented in openapi_impl_extended.go

// Connection endpoints

func (h *OASImpl) ListAdsConnections(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

// Limits endpoints

func (h *OASImpl) GetLimitsMe(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

// Account endpoints

func (h *OASImpl) AddAccount(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uid, _ := ctx.Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	var req struct {
		AccountID   string `json:"accountId"`
		AccountName string `json:"accountName"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiErr := apierrors.InvalidRequest("body", "Invalid request body")
		apiErr.WriteJSON(w, r)
		return
	}

	if req.AccountID == "" {
		apiErr := apierrors.InvalidRequest("accountId", "accountId is required")
		apiErr.WriteJSON(w, r)
		return
	}

	// Insert account reference
	_, err := h.DB.ExecContext(ctx, `
		INSERT INTO "UserAdsConnection" ("userId", "loginCustomerId", "primaryCustomerId", "refreshToken")
		VALUES ($1, $2, NULL, '')
		ON CONFLICT DO NOTHING
	`, uid, req.AccountID)

	if err != nil {
		apiErr := apierrors.InternalError("Failed to add account")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":    true,
		"account_id": req.AccountID,
	})
}

func (h *OASImpl) DeleteAccount(w http.ResponseWriter, r *http.Request, id string) {
	ctx := r.Context()
	uid, _ := ctx.Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	result, err := h.DB.ExecContext(ctx, `
		DELETE FROM "UserAdsConnection"
		WHERE "userId" = $1 AND id = $2
	`, uid, id)

	if err != nil {
		apiErr := apierrors.InternalError("Failed to delete account")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		apiErr := apierrors.NotFound("account", id)
		apiErr.WriteJSON(w, r)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

func (h *OASImpl) GetAccountDetail(w http.ResponseWriter, r *http.Request, id string) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *OASImpl) SyncAccount(w http.ResponseWriter, r *http.Request, id string) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *OASImpl) DisconnectAccount(w http.ResponseWriter, r *http.Request, id string) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *OASImpl) StreamAccounts(w http.ResponseWriter, r *http.Request) {
	NewMiscHandler(h.DB, h.Cache).HandleAccountsStream(w, r)
}

func (h *OASImpl) SyncAllAccounts(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

// Configuration endpoints

func (h *OASImpl) ListConfigurations(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *OASImpl) CreateConfiguration(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (h *OASImpl) DeleteConfiguration(w http.ResponseWriter, r *http.Request, id string) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

// Execution endpoint

func (h *OASImpl) StartExecution(w http.ResponseWriter, r *http.Request) {
	handlers.NewExecutorHandler(h.DB).HandleExecuteTick(w, r)
}

func (h *OASImpl) GetExecutionReport(w http.ResponseWriter, r *http.Request, params api.GetExecutionReportParams) {
	// TODO: Implement execution report for campaigns
	// This should return execution statistics and status for recent executions
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

// Campaign endpoint

func (h *OASImpl) CreateCampaign(w http.ResponseWriter, r *http.Request) {
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

// TransferBudget endpoint

func (h *OASImpl) TransferBudget(w http.ResponseWriter, r *http.Request) {
	NewMiscHandler(h.DB, h.Cache).HandleTransferBudget(w, r)
}
