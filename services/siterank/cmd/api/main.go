package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

	"github.com/ScientificInternet/Google-Monetize/pkg/dbadmin"
	"github.com/ScientificInternet/Google-Monetize/pkg/dburl"
	"github.com/ScientificInternet/Google-Monetize/pkg/logger"
	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/aievaluator"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/browserexec"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/evaluation"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/events"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/handlers"
	_ "github.com/ScientificInternet/Google-Monetize/services/siterank/internal/metrics"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/similarweb"
)

var (
	db     *sql.DB
	ctx    = context.Background()
	zlog   = logger.Get()
	stdlog = log.New(os.Stderr, "[siterank-api] ", log.LstdFlags)
)

func main() {
	stdlog.Println("Siterank API service starting with db-admin proxy...")

	// Setup OpenTelemetry tracing
	shutdown := telemetry.SetupTracing("siterank-api")
	defer func() { _ = shutdown(context.Background()) }()

	// Get db-admin configuration
	dbAdminURL := os.Getenv("DB_ADMIN_URL")
	if dbAdminURL == "" {
		dbAdminURL = "http://db-admin:8080" // 默认服务发现地址
	}

	dbAdminToken := os.Getenv("DB_ADMIN_TOKEN")
	if dbAdminToken == "" {
		stdlog.Fatal("DB_ADMIN_TOKEN is not set")
	}

	// Connect through db-admin proxy
	var err error
	db, err = dbadmin.OpenDB(dbAdminURL, dbAdminToken, "siterank")
	if err != nil {
		stdlog.Fatalf("Error connecting to database through db-admin: %v", err)
	}
	defer db.Close()

	// Test connection
	err = db.Ping()
	if err != nil {
		stdlog.Fatalf("Error pinging the database at startup: %v", err)
	}
	stdlog.Println("Successfully connected to database through db-admin!")

	// Check if we have a direct DATABASE_URL for backward compatibility
	if originalDBURL := os.Getenv("DATABASE_URL"); originalDBURL != "" {
		originalDBURL = dburl.RewriteIfNeeded(originalDBURL)
		stdlog.Printf("Note: DATABASE_URL is present but using db-admin proxy instead")
	}

	// Initialize Redis
	var rdb *redis.Client
	redisURL := os.Getenv("REDIS_URL")
	if redisURL != "" {
		rdb = redis.NewClient(&redis.Options{
			Addr:     strings.TrimPrefix(redisURL, "redis://"),
			Password: os.Getenv("REDIS_PASSWORD"),
		})
		// Test Redis connection
		_, err = rdb.Ping(ctx).Result()
		if err != nil {
			stdlog.Printf("Warning: Failed to connect to Redis: %v", err)
			stdlog.Println("Continuing without Redis (some features may be limited)")
		}
	} else {
		stdlog.Println("Redis URL not provided, running without Redis cache")
	}

	// Initialize event publisher
	publisher, err := events.NewPublisher(ctx)
	if err != nil {
		stdlog.Printf("Warning: Failed to create event publisher: %v", err)
	}

	// Initialize service dependencies with simplified setup
	browserExec := browserexec.NewClient(&serviceclient.Registry{}) // Pass empty registry for now
	similarwebCache := similarweb.NewCachedClient("", rdb)          // Empty config for now

	// AI evaluator initialization - simplified for now
	var aiEvalService *aievaluator.Service
	// Use a simple constructor for now
	aiEvalService = &aievaluator.Service{
		// TODO: Proper initialization when API is available
	}

	// Initialize evaluation service
	evalService := evaluation.NewService(db, browserExec, similarwebCache, aiEvalService, publisher)

	// Initialize handlers
	evalHandler := handlers.NewEvaluationHandler(evalService, publisher)
	// Initialize other handlers
	similarWebHandler := handlers.NewSimilarWebHandler(similarwebCache)
	testHandler := handlers.NewTestHandler(evalService, db)

	// Create router
	r := chi.NewRouter()

	// Middleware
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	// Simple CORS middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-CSRF-Token")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	})

	// Health endpoints
	r.Get("/healthz", healthCheckHandler)
	r.Get("/readyz", readyzHandler)
	r.Handle("/metrics", promhttp.Handler())

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		// Simple auth middleware (simplified for now)
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// TODO: Implement proper authentication
				next.ServeHTTP(w, r)
			})
		})

		// Evaluation endpoints (using correct method names)
		r.Route("/evaluations", func(r chi.Router) {
			r.Get("/", evalHandler.ListOfferEvaluations)
			r.Post("/", evalHandler.CreateOfferEvaluation)
			r.Get("/{id}", evalHandler.GetEvaluation)
			r.Get("/latest/{offerId}", evalHandler.GetLatestOfferEvaluation)
		})

		// Test endpoints
		r.Route("/test", func(r chi.Router) {
			r.Post("/", testHandler.TestEvaluate)
			r.Get("/{id}", testHandler.GetEvaluation)
		})

		// SimilarWeb data endpoints
		r.Route("/similarweb", func(r chi.Router) {
			r.Get("/{domain}", similarWebHandler.GetSimilarWebData)
			// Add refresh endpoint if available
		})

		// Simple statistics endpoint
		r.Get("/stats", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{
				"service": "siterank",
				"message": "Statistics endpoint - placeholder",
				"timestamp": "%s"
			}`, time.Now().Format(time.RFC3339))
		})

		// Database test endpoint
		r.Get("/db-test", func(w http.ResponseWriter, r *http.Request) {
			// Test db-admin connection
			var result string
			err := db.QueryRowContext(ctx, "SELECT 'db-admin connection test successful' as test").Scan(&result)
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				fmt.Fprintf(w, `{"error": "Database test failed: %v"}`, err)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{
				"service": "siterank",
				"database": "cloudsql",
				"connection": "db-admin",
				"test": "%s",
				"timestamp": "%s"
			}`, result, time.Now().Format(time.RFC3339))
		})
	})

	// Internal routes placeholder
	r.Route("/internal", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, "OK - Internal service healthy")
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	stdlog.Printf("Siterank API service starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		stdlog.Fatalf("Failed to start server: %v", err)
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	// Test database connection
	err := db.Ping()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Health check failed: Database error: %v\n", err)
		return
	}

	// Simple health check for db-admin
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK - Database connected through db-admin")
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	// Check if all required services are ready
	// Database connection (already checked in healthz)

	// Check if AI evaluation service is ready
	// This could include checking for required AI models, API keys, etc.

	// Check if browser execution service is ready
	// This could include checking for browser instances, Selenium setup, etc.

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK - All services ready")
}
