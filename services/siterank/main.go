package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

	"github.com/ScientificInternet/Google-Monetize/pkg/logger"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/aievaluator"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/browserexec"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/db"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/evaluation"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/events"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/handlers"
	_ "github.com/ScientificInternet/Google-Monetize/services/siterank/internal/metrics" // 注册Prometheus metrics
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/similarweb"
)

var (
	sqlDB  *sql.DB
	ctx    = context.Background()
	zlog   = logger.Get()
	stdlog = log.New(os.Stderr, "[siterank] ", log.LstdFlags)
)

func main() {
	stdlog.Println("Siterank starting...")

	// Setup OpenTelemetry tracing (optional, enabled via TRACES_ENABLED=1)
	shutdown := telemetry.SetupTracing("siterank")
	defer func() { _ = shutdown(context.Background()) }()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		stdlog.Fatal("DATABASE_URL is not set")
	}

	// Initialize FinalAdapter for siterank
	stdlog.Printf("Initializing FinalAdapter...")
	finalAdapterWrapper, err := db.NewFinalAdapterWrapper()
	if err != nil {
		stdlog.Fatalf("Error creating FinalAdapter: %v", err)
	}
	defer finalAdapterWrapper.Close()

	// Create a sql.DB compatible interface
	sqlDB = finalAdapterWrapper.GetAdapter().GetSupabaseDB()

	stdlog.Println("Pinging FinalAdapter...")
	err = finalAdapterWrapper.Ping(ctx)
	if err != nil {
		stdlog.Fatalf("Error pinging FinalAdapter at startup: %v", err)
	}
	stdlog.Println("Successfully connected to the database via FinalAdapter!")
	zlog.Info().Msg("Successfully connected to the database via FinalAdapter!")

	// Database schema is now managed by db-admin service
	// Skip local DDL execution - migrations are handled centrally
	if os.Getenv("SITERANK_SKIP_MIGRATIONS") == "1" {
		stdlog.Println("SITERANK_SKIP_MIGRATIONS=1 -> skipping DB migrations at startup")
	} else {
		stdlog.Println("Database schema managed by db-admin service - no local DDL execution")
		stdlog.Println("If tables are missing, run: dbctl ddl apply siterank 001 --env=preview")
		stdlog.Println("Then run: dbctl ddl apply siterank 002 --env=preview")
		stdlog.Println("Finally run: dbctl ddl apply siterank 003 --env=preview")
	}

	// Initialize the Pub/Sub publisher.
	publisher, err := events.NewPublisher(ctx)
	if err != nil {
		stdlog.Printf("WARN: Failed to create event publisher - async event publishing will be disabled: %v", err)
		zlog.Warn().Err(err).Msg("Failed to create event publisher - async event publishing will be disabled")
		publisher = nil
	} else {
		defer publisher.Close()
	}

	// Note: We'll initialize subscriber after creating evalService and billingClient

	// --- Initialize Services ---

	// Initialize service registry for microservice calls
	serviceRegistry := serviceclient.NewRegistry()
	stdlog.Println("Service registry initialized")

	// Redis client
	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	defer redisClient.Close()

	// Browser-exec client using serviceclient
	browserExecClient := browserexec.NewClient(serviceRegistry)

	// SimilarWeb client with Redis cache (use browser-exec by default)
	// Set USE_DIRECT_SIMILARWEB=1 to bypass browser-exec and call SimilarWeb API directly
	var similarwebClient *similarweb.CachedClient
	if os.Getenv("USE_DIRECT_SIMILARWEB") == "1" {
		stdlog.Println("Using direct SimilarWeb API access")
		similarwebBaseURL := os.Getenv("SIMILARWEB_BASE_URL")
		similarwebClient = similarweb.NewCachedClient(similarwebBaseURL, redisClient)
	} else {
		stdlog.Println("Using browser-exec for SimilarWeb data fetching")
		similarwebClient = similarweb.NewCachedClientWithBrowserExec(browserExecClient, redisClient)
	}

	// AI evaluator
	projectID := os.Getenv("GCP_PROJECT_ID")
	stdlog.Printf("Creating AI evaluator with project ID: %s", projectID)
	aiEval, err := aievaluator.NewService(ctx, projectID)
	if err != nil {
		stdlog.Fatalf("Failed to create AI evaluator: %v", err)
	}
	defer aiEval.Close()
	stdlog.Println("AI evaluator created successfully")

	// Evaluation service - pass FinalAdapter to evaluation service
	evalService := evaluation.NewService(sqlDB, browserExecClient, similarwebClient, aiEval, publisher)

	// Handlers (pure execution - no billing dependencies)
	evalHandler := handlers.NewEvaluationHandler(evalService, publisher)
	swHandler := handlers.NewSimilarWebHandler(similarwebClient)

	// Initialize the Pub/Sub subscriber with all dependencies
	stdlog.Println("Creating event subscriber...")
	subscriber, err := events.NewSubscriber(ctx, sqlDB, publisher, evalService, nil)
	if err != nil {
		// Pub/Sub subscriber is optional - service can run without it
		stdlog.Printf("WARN: Failed to create event subscriber (continuing without it): %v", err)
		zlog.Warn().Err(err).Msg("Failed to create event subscriber - async event processing will be disabled")
		subscriber = nil
	} else {
		stdlog.Println("Event subscriber created successfully")
		// Start listening for events in a background goroutine
		go subscriber.StartListening(ctx)
	}

	// --- HTTP Server Setup ---
	router := chi.NewRouter()

	// Health check endpoints (must be registered before other routes)
	router.Get("/health", healthCheckHandler)
	router.Get("/healthz", healthCheckHandler)

	// Prometheus metrics endpoint
	router.Handle("/metrics", promhttp.Handler())

	// Test routes (no authentication required) - only in non-production
	env := os.Getenv("ENV")
	if env != "production" {
		testHandler := handlers.NewTestHandler(evalService, sqlDB)
		router.Route("/api/test", func(r chi.Router) {
			r.Post("/evaluate", testHandler.TestEvaluate)
			r.Get("/evaluations/{evaluationId}", testHandler.GetEvaluation)
		})
		stdlog.Println("Test endpoints enabled (no authentication)")
		zlog.Info().Msg("Test endpoints enabled (no authentication)")
	}

	// API routes
	router.Route("/api/v1", func(r chi.Router) {
		// Authenticated routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			// Offer evaluations
			r.Post("/offers/{offerId}/evaluate", evalHandler.CreateOfferEvaluation)
			r.Get("/offers/{offerId}/evaluations/latest", evalHandler.GetLatestOfferEvaluation)
			r.Get("/offers/{offerId}/evaluations", evalHandler.ListOfferEvaluations)
			r.Get("/evaluations/{evaluationId}", evalHandler.GetEvaluation)

			// SimilarWeb data
			r.Get("/domains/{domain}/similarweb", swHandler.GetSimilarWebData)
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	stdlog.Printf("Starting HTTP server on port %s (version v1.1.1)", port)
	zlog.Info().Str("port", port).Str("version", "v1.1.1").Msg("Siterank service starting...")
	if err := http.ListenAndServe(":"+port, router); err != nil {
		stdlog.Fatalf("Failed to start server: %v", err)
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	err := sqlDB.Ping()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Health check failed: Database error: %v\n", err)
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}
