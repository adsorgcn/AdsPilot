package main

import (
	"context"
	"log"
	"net/http"

	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
	"github.com/ScientificInternet/Google-Monetize/services/proxy-pool/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/proxy-pool/internal/handlers"
	"github.com/ScientificInternet/Google-Monetize/services/proxy-pool/internal/pool"
	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
)

func main() {
	// Setup OpenTelemetry tracing (optional, enabled via TRACES_ENABLED=1)
	shutdown := telemetry.SetupTracing("proxy-pool")
	defer func() { _ = shutdown(context.Background()) }()

	cfg := config.Load()
	ctx := context.Background()

	var manager pool.ManagerInterface

	redisAddr, err := cfg.ParseRedisURL()
	if err != nil {
		log.Printf("[ProxyPool] Invalid REDIS_URL (%v), starting in stub mode", err)
	} else if redisAddr != "" {
		rdb := redis.NewClient(&redis.Options{Addr: redisAddr})
		if err := rdb.Ping(ctx).Err(); err != nil {
			log.Printf("[ProxyPool] Failed to connect to Redis at %s: %v. Falling back to stub mode.", redisAddr, err)
		} else {
			log.Printf("[ProxyPool] Connected to Redis at %s", redisAddr)
			manager = pool.NewManager(
				ctx,
				rdb,
				cfg.ProxyProviderURLs,
				cfg.BatchSize,
				cfg.ProxyTTL,
				cfg.LowWaterMark,
				cfg.RateLimitInterval,
			)
		}
	}

	if manager == nil {
		log.Printf("[ProxyPool] Redis not configured. Running in stub mode with proxy pool disabled.")
		manager = pool.NewNoopManager()
	}

	// Setup HTTP server with Chi
	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	telemetry.RegisterDefaultMetrics("proxy-pool")
	r.Use(telemetry.ChiMiddleware("proxy-pool"))
	r.Use(middleware.LoggingMiddleware("proxy-pool"))
	r.Use(middleware.SecurityHeaders())
	r.Handle("/metrics", telemetry.MetricsHandler())

	handler := handlers.NewHandler(manager)
	handler.RegisterRoutes(r)

	log.Printf("[ProxyPool] Server listening on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("[ProxyPool] Failed to start server: %v", err)
	}
}
