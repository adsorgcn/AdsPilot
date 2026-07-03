package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"strconv"
	"time"

	_ "github.com/lib/pq"

	"github.com/ScientificInternet/Google-Monetize/pkg/dbadmin"
	"github.com/ScientificInternet/Google-Monetize/pkg/dburl"
	"github.com/ScientificInternet/Google-Monetize/pkg/logger"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/events"
)

var (
	db     *sql.DB
	ctx    = context.Background()
	zlog   = logger.Get()
	stdlog = log.New(os.Stderr, "[siterank-worker] ", log.LstdFlags)
)

func main() {
	stdlog.Println("Siterank Worker service starting with db-admin proxy...")

	// Setup OpenTelemetry tracing
	shutdown := telemetry.SetupTracing("siterank-worker")
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

	// Initialize services
	_, err = events.NewPublisher(ctx)
	if err != nil {
		stdlog.Printf("Warning: Failed to create event publisher: %v", err)
	}

	// Note: Processors will be initialized as needed
	// The original processor package doesn't exist, so we'll handle this differently

	// Start Pub/Sub subscription
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		stdlog.Println("GOOGLE_CLOUD_PROJECT not set, worker will run without Pub/Sub")
		runPeriodicTasks()
		return
	}

	topicID := os.Getenv("PUBSUB_TOPIC_ID")
	if topicID == "" {
		topicID = "gm-events" // default topic
	}

	subscriber, err := events.NewSubscriber(ctx, db, nil, nil, nil)
	if err != nil {
		stdlog.Fatalf("Failed to create subscriber: %v", err)
	}

	// Start the subscriber
	stdlog.Println("Starting Pub/Sub subscriber...")
	subscriber.StartListening(ctx)

	// Block forever
	select {}
}

func runPeriodicTasks() {
	stdlog.Println("Running in periodic task mode (no Pub/Sub)")

	// Configuration for periodic tasks
	evaluationInterval := getEnvDuration("EVALUATION_INTERVAL", 5*time.Minute)
	aiEvalInterval := getEnvDuration("AI_EVAL_INTERVAL", 10*time.Minute)
	browserInterval := getEnvDuration("BROWSER_INTERVAL", 15*time.Minute)
	similarWebInterval := getEnvDuration("SIMILARWEB_INTERVAL", 1*time.Hour)

	// Start periodic tasks
	go startPeriodicTask("Evaluation Processing", evaluationInterval, func() {
		// TODO: Process pending evaluations using db-admin connection
		stdlog.Println("Processing pending evaluations...")
	})

	go startPeriodicTask("AI Evaluation Processing", aiEvalInterval, func() {
		// TODO: Process pending AI evaluations using db-admin connection
		stdlog.Println("Processing pending AI evaluations...")
	})

	go startPeriodicTask("Browser Job Processing", browserInterval, func() {
		// TODO: Process pending browser jobs using db-admin connection
		stdlog.Println("Processing pending browser jobs...")
	})

	go startPeriodicTask("SimilarWeb Data Processing", similarWebInterval, func() {
		// TODO: Process pending SimilarWeb requests using db-admin connection
		stdlog.Println("Processing pending SimilarWeb requests...")
	})

	// Health check task
	go startPeriodicTask("Health Check", 30*time.Second, func() {
		err := db.Ping()
		if err != nil {
			zlog.Error().Err(err).Msg("Database health check failed")
		}
	})

	// Block forever
	select {}
}

func startPeriodicTask(name string, interval time.Duration, task func()) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	zlog.Info().Str("task", name).Dur("interval", interval).Msg("Starting periodic task")

	for {
		select {
		case <-ticker.C:
			start := time.Now()
			func() {
				defer func() {
					if r := recover(); r != nil {
						zlog.Error().Interface("panic", r).Str("task", name).Msg("Task panicked")
					}
				}()
				task()
			}()
			duration := time.Since(start)
			zlog.Debug().Str("task", name).Dur("duration", duration).Msg("Task completed")
		}
	}
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if seconds, err := strconv.Atoi(value); err == nil {
			return time.Duration(seconds) * time.Second
		}
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
		zlog.Warn().Str("key", key).Str("value", value).Msg("Invalid duration format, using default")
	}
	return defaultValue
}
