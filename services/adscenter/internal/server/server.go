package server

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/pkg/database"
	apperr "github.com/ScientificInternet/Google-Monetize/pkg/errors"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
	apihandlers "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/api"
	adsconfig "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	api "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/oapi"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	pgxstdlib "github.com/jackc/pgx/v5/stdlib"
	"github.com/prometheus/client_golang/prometheus"
)

// Server represents the adscenter HTTP server with all its dependencies
type Server struct {
	// Core dependencies
	Adapter database.DatabaseAdapter
	cache   *pcache.Cache
	config  *adsconfig.Config

	// HTTP server
	router *chi.Mux
	server *http.Server

	// Metrics
	metrics *Metrics

	// Lazily-built *sql.DB bridge over the Cloud SQL pool (pgx stdlib)
	sqlDBOnce sync.Once
	sqlDB     *sql.DB
}

// GetDB provides backward compatibility with *sql.DB interface
func (s *Server) GetDB() *sql.DB {
	// FinalAdapter is Cloud SQL (pgxpool)-backed. Bridge the pool to a *sql.DB via
	// the pgx stdlib adapter so handlers expecting *sql.DB keep working, instead of
	// panicking. Built once and cached.
	s.sqlDBOnce.Do(func() {
		if pool := s.Adapter.GetCloudSQLPool(); pool != nil {
			s.sqlDB = pgxstdlib.OpenDBFromPool(pool)
			return
		}
		// Fallback: adapters that expose a *sql.DB directly.
		s.sqlDB = s.Adapter.GetSupabaseDB()
	})
	return s.sqlDB
}

// ExecContext executes a query using the adapter
func (s *Server) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return s.Adapter.Exec(ctx, query, args...)
}

// QueryContext executes a query using the adapter
func (s *Server) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return s.Adapter.Query(ctx, query, args...)
}

// QueryRowContext executes a query using the adapter
func (s *Server) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	return s.Adapter.QueryRow(ctx, query, args...)
}

// PingContext checks database health using the adapter
func (s *Server) PingContext(ctx context.Context) error {
	return s.Adapter.Ping(ctx)
}

// Metrics holds Prometheus metrics for the server
type Metrics struct {
	DerivedTargets *prometheus.CounterVec
	OpEnqueued     prometheus.Counter
	OpActions      prometheus.Histogram
	ExecLatency    *prometheus.HistogramVec
	ExecTotal      *prometheus.CounterVec
	ExecErrors     *prometheus.CounterVec
}

// Config holds server configuration
type Config struct {
	Port        string
	DatabaseURL string
}

// NewServer creates a new adscenter server with all dependencies initialized
func NewServer(ctx context.Context, cfg *adsconfig.Config, adapter database.DatabaseAdapter) (*Server, error) {
	if cfg == nil {
		return nil, fmt.Errorf("config is required")
	}
	if adapter == nil {
		return nil, fmt.Errorf("database adapter is required")
	}

	// Initialize cache from environment
	cache := pcache.NewFromEnv()

	// Initialize metrics
	metrics := initMetrics()

	// Create server instance
	srv := &Server{
		Adapter: adapter,
		cache:   cache,
		config:  cfg,
		metrics: metrics,
	}

	// Setup router
	srv.setupRouter()

	return srv, nil
}

// initMetrics initializes and registers Prometheus metrics
func initMetrics() *Metrics {
	metrics := &Metrics{
		DerivedTargets: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "ac_derived_targets_total",
			Help: "Number of derived execution targets (filled/skipped/error)",
		}, []string{"type", "result"}),
		OpEnqueued: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "ac_operation_enqueued_total",
			Help: "Total bulk operations enqueued",
		}),
		OpActions: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "ac_operation_actions",
			Help:    "Action count per enqueued operation",
			Buckets: []float64{1, 5, 10, 20, 50, 100, 200},
		}),
		ExecLatency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "ac_execute_action_latency_seconds",
			Help:    "Latency for executing a single action",
			Buckets: prometheus.DefBuckets,
		}, []string{"type"}),
		ExecTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "ac_execute_action_total",
			Help: "Total actions executed",
		}, []string{"type"}),
		ExecErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "ac_execute_action_errors_total",
			Help: "Total action execution errors",
		}, []string{"type"}),
	}

	// Register metrics (ignore duplicate registration errors)
	_ = prometheus.Register(metrics.DerivedTargets)
	_ = prometheus.Register(metrics.OpEnqueued)
	_ = prometheus.Register(metrics.OpActions)
	_ = prometheus.Register(metrics.ExecLatency)
	_ = prometheus.Register(metrics.ExecTotal)
	_ = prometheus.Register(metrics.ExecErrors)

	return metrics
}

// setupRouter configures all HTTP routes and middleware
func (s *Server) setupRouter() {
	r := chi.NewRouter()

	// Global middleware (must be registered before routes)
	r.Use(middleware.RequestID())
	// P3-6: Enable gzip compression (level 5 balance between speed and compression)
	r.Use(chimiddleware.Compress(5))
	r.Use(telemetry.ChiMiddleware("adscenter"))
	r.Use(middleware.LoggingMiddleware("adscenter"))
	r.Use(middleware.SecurityHeaders())

	// Health check endpoints for k8s/Cloud Run probes
	r.Get("/health", s.healthHandler)
	r.Get("/healthz", s.healthHandler)
	r.Get("/readyz", s.readinessHandler)

	// Metrics endpoint
	r.Handle("/metrics", telemetry.MetricsHandler())

	// Register API routes from internal/api package
	apihandlers.RegisterRoutes(r, s.GetDB(), s.cache)

	// Mount OpenAPI generated handlers
	s.mountOpenAPIHandlers(r)

	s.router = r
}

// healthHandler handles basic health checks
func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

// readinessHandler checks if the service is ready to serve traffic
func (s *Server) readinessHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
	defer cancel()

	// Check database connectivity
	if err := s.GetDB().PingContext(ctx); err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "NOT_READY",
			"dependencies not ready", map[string]string{"db": err.Error()})
		return
	}

	// Check cache (Valkey/Redis) connectivity if configured
	if s.cache != nil && s.cache.Ready() {
		cctx, ccancel := context.WithTimeout(ctx, 300*time.Millisecond)
		defer ccancel()
		if err := s.cache.Redis().Ping(cctx).Err(); err != nil {
			apperr.Write(w, r, http.StatusInternalServerError, "NOT_READY",
				"valkey not ready", map[string]string{"valkey": err.Error()})
			return
		}
	}

	w.WriteHeader(http.StatusOK)
}

// mountOpenAPIHandlers mounts the OpenAPI generated handlers
func (s *Server) mountOpenAPIHandlers(r chi.Router) {
	// Create OpenAPI implementation
	oas := apihandlers.NewOASImpl(s.GetDB(), s.cache)

	// Mount OpenAPI handler with middleware
	oapiHandler := api.HandlerWithOptions(oas, api.ChiServerOptions{
		BaseURL: "/",
		Middlewares: []api.MiddlewareFunc{
			func(next http.Handler) http.Handler { return middleware.IdempotencyMiddleware(next) },
			func(next http.Handler) http.Handler { return authExceptLocalOAuth(next) },
		},
		ErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", err.Error(), nil)
		},
	})
	r.Mount("/", oapiHandler)
}

// authExceptLocalOAuth applies the standard bearer AuthMiddleware to every route
// except the local OAuth endpoints. Those run in the single-user local model:
// the callback is reached by Google's browser redirect (which carries no bearer
// token), and /oauth/url and /oauth/revoke are driven locally without a login.
// This assumes adscenter is bound to a loopback address in the local model.
func authExceptLocalOAuth(next http.Handler) http.Handler {
	authed := middleware.AuthMiddleware(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isLocalOAuthPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}
		authed.ServeHTTP(w, r)
	})
}

func isLocalOAuthPath(p string) bool {
	switch p {
	case "/api/v1/adscenter/oauth/url",
		"/api/v1/adscenter/oauth/callback",
		"/api/v1/adscenter/oauth/revoke":
		return true
	}
	return false
}

// Run starts the HTTP server
func (s *Server) Run(ctx context.Context) error {
	port := s.config.Port
	if port == "" {
		port = os.Getenv("PORT")
	}
	if port == "" {
		port = "8080"
	}

	addr := ":" + port
	s.server = &http.Server{
		Addr:         addr,
		Handler:      s.router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("Adscenter server listening on %s", addr)

	// Start server in a goroutine
	errChan := make(chan error, 1)
	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errChan <- fmt.Errorf("server error: %w", err)
		}
	}()

	// Wait for context cancellation or server error
	select {
	case <-ctx.Done():
		log.Println("Shutting down server...")
		return s.Shutdown(context.Background())
	case err := <-errChan:
		return err
	}
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	if s.server == nil {
		return nil
	}

	// Create shutdown context with timeout
	shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Shutdown HTTP server
	if err := s.server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("server shutdown error: %w", err)
	}

	// Close database connection
	if db := s.GetDB(); db != nil {
		if err := db.Close(); err != nil {
			log.Printf("Error closing database: %v", err)
		}
	}

	log.Println("Server shutdown complete")
	return nil
}

// DB returns the database connection
func (s *Server) DB() *sql.DB {
	return s.GetDB()
}

// Cache returns the cache instance
func (s *Server) Cache() *pcache.Cache {
	return s.cache
}

// Config returns the server configuration
func (s *Server) Config() *adsconfig.Config {
	return s.config
}

// Metrics returns the server metrics
func (s *Server) Metrics() *Metrics {
	return s.metrics
}

// RegisterDefaultMetrics registers default telemetry metrics
func RegisterDefaultMetrics() {
	telemetry.RegisterDefaultMetrics("adscenter")
}

// SkipMigrations checks if database migrations should be skipped
func SkipMigrations() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("ADSCENTER_SKIP_MIGRATIONS")), "1")
}
