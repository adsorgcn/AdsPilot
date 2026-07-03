package api

import (
	"database/sql"
	"net/http"

	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/go-chi/chi/v5"
)

// RegisterRoutes registers all API routes for the refactored handlers
// This function centralizes route registration for the internal/api package
func RegisterRoutes(r chi.Router, db *sql.DB, rc *pcache.Cache) {
	// Initialize handlers
	bulkHandler := NewBulkActionsHandler(db)
	preflightHandler := NewPreflightHandler(db, rc)
	diagnoseHandler := NewDiagnoseHandler(db, rc)

	// Bulk actions routes (with idempotency + looseAuth for staging compatibility)
	// Note: looseAuth is defined in main.go and passed as middleware
	r.Handle("/api/v1/adscenter/bulk-actions",
		middleware.IdempotencyMiddleware(
			middleware.AuthMiddleware(http.HandlerFunc(bulkHandler.HandleSubmitBulkActions))))

	// Preflight route
	r.Handle("/api/v1/adscenter/preflight",
		middleware.AuthMiddleware(http.HandlerFunc(preflightHandler.HandlePreflight)))

	// Diagnose routes
	r.Handle("/api/v1/adscenter/diagnose",
		middleware.AuthMiddleware(http.HandlerFunc(diagnoseHandler.HandleDiagnose)))
	r.Handle("/api/v1/adscenter/diagnose/plan",
		middleware.AuthMiddleware(http.HandlerFunc(diagnoseHandler.HandleDiagnosePlan)))
	r.Handle("/api/v1/adscenter/diagnose/execute",
		middleware.AuthMiddleware(http.HandlerFunc(diagnoseHandler.HandleDiagnoseExecute)))
	r.Handle("/api/v1/adscenter/diagnose/metrics",
		middleware.AuthMiddleware(http.HandlerFunc(diagnoseHandler.HandleDiagnoseMetrics)))

	// A/B Test routes
	abTestHandler := NewABTestHandler(db)
	r.Handle("/api/v1/adscenter/ab-tests",
		middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleList)))
	r.Handle("/api/v1/adscenter/ab-tests/{id}",
		middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleGet)))
	r.Handle("/api/v1/adscenter/ab-tests/{id}/metrics",
		middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleIngestMetrics)))
	r.Handle("/api/v1/adscenter/ab-tests/{id}/refresh-metrics",
		middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleRefreshMetrics)))
	r.Handle("/api/v1/adscenter/ab-tests/{id}/graduate",
		middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleGraduate)))
	r.Handle("/api/v1/adscenter/ab-tests/{id}/apply-winner-plan",
		middleware.AuthMiddleware(http.HandlerFunc(abTestHandler.HandleApplyWinnerPlan)))

	// MCC routes
	mccHandler := NewMCCHandler(db, rc)
	r.Handle("/api/v1/adscenter/mcc/link",
		middleware.AuthMiddleware(http.HandlerFunc(mccHandler.HandleLink)))
	r.Handle("/api/v1/adscenter/mcc/status",
		middleware.AuthMiddleware(http.HandlerFunc(mccHandler.HandleStatus)))
	r.Handle("/api/v1/adscenter/mcc/unlink",
		middleware.AuthMiddleware(http.HandlerFunc(mccHandler.HandleUnlink)))
	r.Handle("/api/v1/adscenter/mcc/refresh",
		middleware.AuthMiddleware(http.HandlerFunc(mccHandler.HandleRefresh)))

	// Keywords routes
	keywordsHandler := NewKeywordsHandler(db)
	r.Handle("/api/v1/adscenter/keywords/expand",
		middleware.AuthMiddleware(http.HandlerFunc(keywordsHandler.HandleExpand)))

	// Bulk Rollback routes
	rollbackHandler := NewBulkRollbackHandler(db)
	r.Handle("/api/v1/adscenter/bulk-actions/{id}/rollback",
		middleware.AuthMiddleware(http.HandlerFunc(rollbackHandler.HandleRollback)))
	r.Handle("/api/v1/adscenter/bulk-actions/{id}/audits",
		middleware.AuthMiddleware(http.HandlerFunc(rollbackHandler.HandleAudits)))

	// Miscellaneous routes (Reports, Strategies, Accounts)
	miscHandler := NewMiscHandler(db, rc)
	r.Handle("/api/v1/adscenter/accounts",
		middleware.AuthMiddleware(http.HandlerFunc(miscHandler.HandleAccounts)))
	r.Handle("/api/v1/adscenter/accounts/stream",
		middleware.AuthMiddleware(http.HandlerFunc(miscHandler.HandleAccountsStream)))
	r.Handle("/api/v1/adscenter/accounts/{id}",
		middleware.AuthMiddleware(http.HandlerFunc(miscHandler.HandleAccountDetail)))
	r.Handle("/api/v1/adscenter/accounts/sync-all",
		middleware.AuthMiddleware(http.HandlerFunc(miscHandler.HandleSyncAllAccounts)))
	r.Handle("/api/v1/adscenter/accounts/{id}/sync",
		middleware.AuthMiddleware(http.HandlerFunc(miscHandler.HandleSyncAccount)))
	r.Handle("/api/v1/adscenter/accounts/{id}/disconnect",
		middleware.AuthMiddleware(http.HandlerFunc(miscHandler.HandleDisconnectAccount)))
	r.Handle("/api/v1/adscenter/strategies",
		middleware.AuthMiddleware(http.HandlerFunc(miscHandler.HandleStrategies)))
	r.Handle("/api/v1/adscenter/reports/basic",
		middleware.AuthMiddleware(http.HandlerFunc(miscHandler.HandleReportsBasic)))
	r.Handle("/api/v1/adscenter/transfer-budget",
		middleware.AuthMiddleware(http.HandlerFunc(miscHandler.HandleTransferBudget)))
}

// RouteConfig holds configuration for route registration
type RouteConfig struct {
	DB              *sql.DB
	Cache           *pcache.Cache
	EnableLooseAuth bool // For staging/testing environments
}

// RegisterRoutesWithConfig registers routes with advanced configuration
func RegisterRoutesWithConfig(r chi.Router, cfg RouteConfig) {
	RegisterRoutes(r, cfg.DB, cfg.Cache)
}
