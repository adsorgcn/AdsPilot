package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"github.com/ScientificInternet/Google-Monetize/services/console/internal/clients"
	"github.com/ScientificInternet/Google-Monetize/services/console/internal/supabase"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type PgxPool interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
	Ping(context.Context) error
	Begin(context.Context) (pgx.Tx, error)
}

type ServiceClients struct {
	Supabase  *supabase.Client
	Billing   *clients.BillingClient
	Offer     *clients.OfferClient
	Adscenter *clients.AdscenterClient
}

type Handler struct {
	DB             PgxPool
	Cache          CacheInterface
	ServiceClients *ServiceClients
}

type CacheInterface interface {
	Get(ctx context.Context, key string) (string, bool)
	Set(ctx context.Context, key, val string, ttl time.Duration)
	Del(ctx context.Context, key string)
	Ready() bool
}

func NewHandler(db *pgxpool.Pool, cache CacheInterface) *Handler {
	return &Handler{
		DB:             db,
		Cache:          cache,
		ServiceClients: NewServiceClients(),
	}
}

func NewServiceClients() *ServiceClients {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	// Initialize service registry for microservice calls
	serviceRegistry := serviceclient.NewRegistry()

	billingURL := os.Getenv("BILLING_SERVICE_URL")
	if billingURL == "" {
		billingURL = "http://billing:8080"
	}

	adscenterURL := os.Getenv("ADSCENTER_SERVICE_URL")
	if adscenterURL == "" {
		adscenterURL = "http://adscenter:8080"
	}

	return &ServiceClients{
		Supabase:  supabase.NewClient(supabaseURL, supabaseKey),
		Billing:   clients.NewBillingClient(billingURL),
		Offer:     clients.NewOfferClient(serviceRegistry),
		Adscenter: clients.NewAdscenterClient(adscenterURL),
	}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	// ========================================
	// Management UI Redirects
	// ========================================
	manageBaseURL := os.Getenv("MANAGE_BASE_URL")
	if manageBaseURL == "" {
		manageBaseURL = "https://www.autoads.dev/manage"
	}

	mux.HandleFunc("/console/", func(w http.ResponseWriter, r *http.Request) {
		newPath := strings.TrimPrefix(r.URL.Path, "/console")
		targetURL := manageBaseURL + newPath
		http.Redirect(w, r, targetURL, http.StatusMovedPermanently)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			http.Redirect(w, r, manageBaseURL, http.StatusMovedPermanently)
			return
		}
		http.NotFound(w, r)
	})

	// ========================================
	// 健康检查端点
	// ========================================
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if err := h.DB.Ping(r.Context()); err != nil {
			http.Error(w, "DB not ready", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/api/health", h.healthAggregate)

	// ========================================
	// 用户管理
	// ========================================
	mux.Handle("/api/v1/console/users", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getUsers))))
	mux.Handle("/api/v1/console/users/", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.usersTree))))

	// ========================================
	// Token管理
	// ========================================
	mux.Handle("/api/v1/console/tokens/stats", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getTokenStats))))
	mux.Handle("/api/v1/console/tokens/balances", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getTokenBalances))))

	// Token分析监控（关键运营指标）
	mux.Handle("/api/v1/console/tokens/consumption-trend", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getTokenConsumptionTrend))))
	mux.Handle("/api/v1/console/tokens/top-consumers", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getTopTokenConsumers))))

	// ========================================
	// 任务管理 (已在tasks.go中实现)
	// ========================================
	mux.Handle("/api/v1/console/tasks/stats", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getTaskStats))))
	mux.Handle("/api/v1/console/tasks", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getTasks))))
	mux.Handle("/api/v1/console/tasks/{id}/cancel", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.cancelTask))))
	mux.Handle("/api/v1/console/tasks/{id}/retry", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.retryTask))))

	// ========================================
	// 统计数据
	// ========================================
	mux.Handle("/api/v1/console/stats", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getAdminStats))))

	// ========================================
	// Dashboard (User-specific)
	// ========================================
	mux.Handle("/api/v1/console/dashboard/stats", middleware.AuthMiddleware(http.HandlerFunc(h.GetDashboardStats)))

	// ========================================
	// 通知广播
	// ========================================
	mux.Handle("/api/v1/console/notifications/broadcast", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.BroadcastNotification))))
	mux.Handle("/api/v1/console/notifications/broadcasts", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.ListBroadcasts))))
	mux.Handle("/api/v1/console/notifications/stats", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.GetBroadcastStats))))
	mux.Handle("/api/v1/console/notifications/templates", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.ListNotificationTemplates))))
	mux.Handle("/api/v1/console/notifications/templates/create", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.CreateNotificationTemplate))))
	mux.Handle("/api/v1/console/notifications/templates/preview", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.PreviewTemplate))))

	// ========================================
	// 订阅管理
	// ========================================
	mux.Handle("/api/v1/console/subscriptions", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getSubscriptions))))
	mux.Handle("/api/v1/console/subscriptions/", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.subscriptionsTree))))

	// ========================================
	// 分析数据
	// ========================================
	mux.Handle("/api/v1/console/analytics/users", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getUserGrowthAnalytics))))
	mux.Handle("/api/v1/console/analytics/tokens", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getTokenConsumptionAnalytics))))
	mux.Handle("/api/v1/console/analytics/revenue", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getRevenueAnalytics))))
	mux.Handle("/api/v1/console/analytics/activity", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getActivityAnalytics))))

	// ========================================
	// Offer管理
	// ========================================
	mux.Handle("/api/v1/console/offers", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.getOffers))))
	mux.Handle("/api/v1/console/offers/", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.offersTree))))

	// ========================================
	// Ads账号管理
	// ========================================
	mux.Handle("/api/v1/console/ads/", middleware.AuthMiddleware(middleware.AdminOnly(http.HandlerFunc(h.adsAccountsTree))))

}

// ensureUserTable has been removed - DDL operations should be managed through db-admin
// Database schema changes are now handled via YAML migration files
// This function is deprecated and will be removed in a future release
func ensureUserTable(ctx context.Context, db PgxPool) {
	// WARNING: This function is deprecated. Do not call it.
	// All schema changes should be handled through db-admin service
	// using the migration files in services/console/migrations/

	// Log warning for deprecated usage
	fmt.Printf("WARNING: ensureUserTable is deprecated. Use db-admin migrations instead.\n")

	// Check if required tables exist, but do not create them
	// Table creation should be done through proper migration process
	rows, err := db.Query(ctx, `
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'User'
	`)
	if err != nil {
		fmt.Printf("Error checking table existence: %v\n", err)
		return
	}
	defer rows.Close()

	if !rows.Next() {
		fmt.Printf("ERROR: User table does not exist. Please run db-admin migrations.\n")
	}
}

// isAdmin replicates AdminOnly checks for inline scope control
func isAdmin(uid, email string) bool {
	email = strings.TrimSpace(strings.ToLower(email))
	if email != "" {
		if sa := strings.TrimSpace(strings.ToLower(os.Getenv("SUPER_ADMIN_EMAIL"))); sa != "" && sa == email {
			return true
		}
		if list := os.Getenv("ADMIN_EMAILS"); list != "" {
			for _, e := range strings.Split(list, ",") {
				if strings.TrimSpace(strings.ToLower(e)) == email {
					return true
				}
			}
		}
	}
	uid = strings.TrimSpace(uid)
	if uid != "" {
		if list := os.Getenv("ADMIN_UIDS"); list != "" {
			for _, u := range strings.Split(list, ",") {
				if strings.TrimSpace(u) == uid {
					return true
				}
			}
		}
	}
	return false
}

// ========================================
// 核心Handler方法
// ========================================
// 用户管理: users_handlers.go
// Token管理: tokens_handlers.go
// 任务管理: tasks.go
// 健康检查: health_handlers.go

// adminPolicy returns ADMIN allow rules from Secret Manager JSON.
// Env: ADMIN_POLICY_SECRET = projects/<pid>/secrets/<name>/versions/latest
// JSON format: { "emails": ["a@b.com"], "uids": ["uid1"] }
