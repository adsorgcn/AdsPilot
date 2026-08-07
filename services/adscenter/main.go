package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
	adsconfig "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/localpg"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/migrations"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/server"
)

func main() {
	log.Println("Starting Adscenter service...")
	ctx := context.Background()

	// Setup telemetry (tracing and metrics)
	shutdown := telemetry.SetupTracing("adscenter")
	defer func() { _ = shutdown(context.Background()) }()

	// Register default metrics
	server.RegisterDefaultMetrics()

	// Single-user local model: when no database is configured, boot an
	// embedded PostgreSQL so the service is self-contained on the user's
	// machine (no Docker, no external DB setup).
	//
	// die replaces log.Fatalf on paths after the embedded DB starts:
	// log.Fatalf skips deferred calls, which would orphan the postgres child
	// process.
	stopPG := func() {}
	die := func(format string, args ...interface{}) {
		log.Printf(format, args...)
		stopPG()
		os.Exit(1)
	}
	if middleware.LocalMode() && os.Getenv("DATABASE_URL") == "" && os.Getenv("DATABASE_URL_SECRET_NAME") == "" {
		dsn, stop, err := localpg.StartIfNeeded()
		if err != nil {
			log.Fatalf("Failed to start embedded PostgreSQL: %v", err)
		}
		stopPG = stop
		defer stopPG()
		os.Setenv("DATABASE_URL", dsn)
	}

	// Load configuration
	cfg, err := adsconfig.Load(ctx)
	if err != nil {
		die("Failed to load config: %v", err)
	}

	// Run database migrations (unless skipped)
	if !server.SkipMigrations() {
		log.Println("Running database migrations...")
		if middleware.LocalMode() {
			if err := migrations.RunLocal(cfg.DatabaseURL); err != nil {
				die("Failed to run local migrations: %v", err)
			}
		} else if err := migrations.Run(cfg.DatabaseURL); err != nil {
			die("Failed to run migrations: %v", err)
		}
	} else {
		log.Println("Skipping database migrations (ADSCENTER_SKIP_MIGRATIONS=1)")
	}

	// Initialize FinalAdapter for unified Cloud SQL access
	adapter, err := database.GetFinalAdapterForService("adscenter")
	if err != nil {
		die("Failed to initialize database adapter: %v", err)
	}
	defer adapter.Close()

	// Create server instance
	srv, err := server.NewServer(ctx, cfg, adapter)
	if err != nil {
		die("Failed to create server: %v", err)
	}

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Listen for shutdown signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Start server in a goroutine
	errChan := make(chan error, 1)
	go func() {
		if err := srv.Run(ctx); err != nil {
			errChan <- err
		}
	}()

	// Wait for shutdown signal or error
	select {
	case sig := <-sigChan:
		log.Printf("Received signal: %v", sig)
		cancel()
	case err := <-errChan:
		log.Printf("Server error: %v", err)
		cancel()
	}

	// Graceful shutdown
	log.Println("Shutting down gracefully...")
	if err := srv.Shutdown(context.Background()); err != nil {
		log.Printf("Shutdown error: %v", err)
	}

	log.Println("Server stopped")
}
