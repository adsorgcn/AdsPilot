package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
	adsconfig "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
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

	// Load configuration
	cfg, err := adsconfig.Load(ctx)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Run database migrations (unless skipped)
	if !server.SkipMigrations() {
		log.Println("Running database migrations...")
		if err := migrations.Run(cfg.DatabaseURL); err != nil {
			log.Fatalf("Failed to run migrations: %v", err)
		}
	} else {
		log.Println("Skipping database migrations (ADSCENTER_SKIP_MIGRATIONS=1)")
	}

	// Initialize FinalAdapter for unified Cloud SQL access
	adapter, err := database.GetFinalAdapterForService("adscenter")
	if err != nil {
		log.Fatalf("Failed to initialize database adapter: %v", err)
	}
	defer adapter.Close()

	// Create server instance
	srv, err := server.NewServer(ctx, cfg, adapter)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
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
