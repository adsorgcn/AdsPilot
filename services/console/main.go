package main

import (
	"compress/gzip"
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
	"github.com/ScientificInternet/Google-Monetize/services/console/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/console/internal/handlers"

	"github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
)

// P3-6: gzipMiddleware wraps an http.Handler to provide gzip compression
type gzipResponseWriter struct {
	http.ResponseWriter
	Writer *gzip.Writer
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if client accepts gzip encoding
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		// Create gzip writer with compression level 5
		gz, err := gzip.NewWriterLevel(w, 5)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}
		defer gz.Close()

		w.Header().Set("Content-Encoding", "gzip")
		gzw := gzipResponseWriter{ResponseWriter: w, Writer: gz}
		next.ServeHTTP(gzw, r)
	})
}

func main() {
	ctx := context.Background()
	// optional OTel trace (no-op if disabled)
	shutdown := telemetry.SetupTracing("console")
	defer func() { _ = shutdown(context.Background()) }()
	cfg, err := config.Load(ctx)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize FinalAdapter for unified database access
	adapter, err := database.GetFinalAdapterForService("console")
	if err != nil {
		log.Fatalf("Unable to create final database adapter: %v", err)
	}
	defer adapter.Close()

	// Get pgxpool for handlers
	dbpool := adapter.GetCloudSQLPool()

	// In a real CQRS system, the console would use a command bus to send commands.
	// For simplicity here, we might pass the publisher directly or use service clients.
	// publisher, err := events.NewPubSubPublisher(ctx, cfg.ProjectID, cfg.PubSubTopicID)
	// if err != nil {
	// 	log.Fatalf("Failed to create PubSub publisher: %v", err)
	// }

	// The console service needs to be authenticated as an admin user.
	// This would typically involve a service account or a specific admin auth mechanism.
	// authClient := auth.NewAdminClient(ctx)

	// Initialize cache (Redis or in-memory fallback)
	c := cache.NewFromEnv()
	if c.Ready() {
		log.Println("Redis cache initialized successfully")
	} else {
		log.Println("Using in-memory cache fallback (REDIS_URL not configured)")
	}

	apiHandler := handlers.NewHandler(dbpool, c) // Publisher would be passed here

	mux := http.NewServeMux()
	// metrics & logging
	telemetry.RegisterDefaultMetrics("console")
	mux.Handle("/metrics", telemetry.MetricsHandler())
	// wrap mux with gzip + CORS + metrics+trace + logging middleware via top-level handler
	// P3-6: Added gzip compression middleware
	root := gzipMiddleware(telemetry.Middleware("console", middleware.LoggingMiddleware("console")(middleware.SecurityHeaders()(middleware.RequestID()(middleware.CORSWithDefaults()(mux))))))
	// The middleware here should verify ADMIN role.
	apiHandler.RegisterRoutes(mux) // Admin middleware would be passed here

	log.Printf("Console service HTTP server listening on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, root); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
