package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/ScientificInternet/Google-Monetize/pkg/logger"
	pkgmiddleware "github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
	"github.com/ScientificInternet/Google-Monetize/services/bff/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/bff/internal/handlers"
	"github.com/ScientificInternet/Google-Monetize/services/bff/internal/middleware"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"
)

var zlog = logger.Get()

func main() {
	ctx := context.Background()
	log.Println("BFF service starting...")

	// Setup OpenTelemetry tracing (optional, enabled via TRACES_ENABLED=1)
	shutdown := telemetry.SetupTracing("bff")
	defer func() { _ = shutdown(context.Background()) }()

	// Initialize service registry for microservice calls
	serviceRegistry := serviceclient.NewRegistry()
	log.Println("Service registry initialized")

	// Redis client for caching
	// Get Redis URL from environment or Secret Manager
	redisAddr, err := config.GetRedisURL(ctx)
	if err != nil {
		log.Printf("WARN: Failed to get Redis URL from Secret Manager: %v", err)
		log.Println("INFO: Caching will be disabled")
		redisAddr = ""
	}

	var redisClient *redis.Client
	if redisAddr != "" {
		redisClient = redis.NewClient(&redis.Options{
			Addr: redisAddr,
		})
		defer redisClient.Close()

		// Test Redis connection
		if err := redisClient.Ping(ctx).Err(); err != nil {
			log.Printf("WARN: Redis connection failed, caching will be disabled: %v", err)
			redisClient = nil
		} else {
			log.Printf("INFO: Redis connected successfully at %s", redisAddr)
		}
	} else {
		log.Println("INFO: Redis URL not configured, caching disabled")
	}

	// Initialize handlers with serviceclient
	dashboardHandler := handlers.NewDashboardHandler(serviceRegistry, redisClient)

	// Setup router
	router := chi.NewRouter()
	// P3-6: Enable gzip compression (level 5 balance between speed and compression)
	router.Use(chimiddleware.Compress(5))

	// Health check endpoints
	router.Get("/health", healthCheckHandler)
	router.Get("/healthz", healthCheckHandler)
	router.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		// Check Redis connectivity if configured
		if redisClient != nil {
			if err := redisClient.Ping(r.Context()).Err(); err != nil {
				http.Error(w, "Redis not ready", http.StatusServiceUnavailable)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
	})

	// Prometheus metrics endpoint
	router.Handle("/metrics", telemetry.MetricsHandler())

	// API routes
	router.Route("/api/v1", func(r chi.Router) {
		// Authenticated routes
		r.Group(func(r chi.Router) {
			// Authentication middleware
			r.Use(pkgmiddleware.AuthMiddleware)
			// Preserve Authorization header in context for downstream calls
			r.Use(middleware.AuthContextMiddleware)

			// Dashboard endpoints
			r.Get("/dashboard/stats", dashboardHandler.GetDashboardStats)
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("BFF service HTTP server listening on port %s (version v1.0.0)", port)
	zlog.Info().Str("port", port).Str("version", "v1.0.0").Msg("BFF service starting...")
	if err := http.ListenAndServe(":"+port, router); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}
