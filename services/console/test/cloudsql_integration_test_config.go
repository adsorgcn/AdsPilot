package test

import (
	"context"
	"fmt"
	"net/url"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// CloudSQLTestConfig holds the configuration for Cloud SQL integration tests
type CloudSQLTestConfig struct {
	DBPool *pgxpool.Pool
}

// SetupCloudSQLIntegrationTest creates a database connection pool for integration tests
// using the Cloud SQL database via Cloud SQL Proxy (local) or VPC Connector (Cloud Run Job)
func SetupCloudSQLIntegrationTest(ctx context.Context) (*CloudSQLTestConfig, error) {
	var connectionString string

	// Check if running in Cloud Run Job (has DATABASE_URL from Secret Manager)
	dbURL := os.Getenv("CLOUDSQL_DATABASE_URL")
	if dbURL != "" {
		// Cloud Run Job: use DATABASE_URL directly (already includes VPC IP and encoded password)
		connectionString = dbURL
	} else {
		// Local testing: build connection string for Cloud SQL Proxy
		dbHost := "localhost"
		dbPort := "5432"
		dbName := "gm_db"
		dbUser := "postgres"

		// Get password from environment
		dbPassword := os.Getenv("CLOUDSQL_DB_PASSWORD")
		if dbPassword == "" {
			dbPassword = "$GL(~x]T2Q[M@uX4" // Fallback for local testing
		}

		// URL-encode the password to handle special characters
		encodedPassword := url.QueryEscape(dbPassword)

		connectionString = fmt.Sprintf(
			"postgresql://%s:%s@%s:%s/%s?sslmode=disable",
			dbUser, encodedPassword, dbHost, dbPort, dbName,
		)
	}

	// Create connection pool
	pool, err := pgxpool.New(ctx, connectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database (is Cloud SQL Proxy running?): %w", err)
	}

	return &CloudSQLTestConfig{
		DBPool: pool,
	}, nil
}

// Cleanup closes the database connection pool
func (c *CloudSQLTestConfig) Cleanup() {
	if c.DBPool != nil {
		c.DBPool.Close()
	}
}

// CleanupTestData removes test data from the database
// This should be called after each test to ensure isolation
func (c *CloudSQLTestConfig) CleanupTestData(ctx context.Context, userID string) error {
	queries := []string{
		`DELETE FROM export_history WHERE created_by = $1`,
		`DELETE FROM feature_flags WHERE updated_by = $1`,
		`DELETE FROM feature_flag_history WHERE changed_by = $1`,
		`DELETE FROM notification_templates WHERE created_by = $1`,
		`DELETE FROM notification_broadcasts WHERE created_by = $1`,
		`DELETE FROM nps_feedback WHERE user_id = $1`,
	}

	for _, query := range queries {
		if _, err := c.DBPool.Exec(ctx, query, userID); err != nil {
			// Ignore errors for tables that might not exist
			continue
		}
	}

	return nil
}
