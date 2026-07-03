package test

import (
	"context"
	"fmt"
	"net/url"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// IntegrationTestConfig holds the configuration for integration tests
type IntegrationTestConfig struct {
	DBPool *pgxpool.Pool
}

// SetupIntegrationTest creates a database connection pool for integration tests
// using the preview environment Supabase database
func SetupIntegrationTest(ctx context.Context) (*IntegrationTestConfig, error) {
	// Supabase Transaction Pooler connection string
	// Format: postgresql://postgres.{project_ref}:{password}@{pooler_host}:{port}/{database}
	dbPassword := os.Getenv("SUPABASE_DB_PASSWORD")
	if dbPassword == "" {
		dbPassword = "*HF#9dFnzV5DBA." // Default from supabase-credentials.json
	}

	// URL-encode the password to handle special characters
	// Use proper URL encoding for PostgreSQL connection string
	encodedPassword := url.QueryEscape(dbPassword)

	connectionString := fmt.Sprintf(
		"postgresql://postgres.YOUR_SUPABASE_PROJECT:%s@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres",
		encodedPassword,
	)

	// Create connection pool
	pool, err := pgxpool.New(ctx, connectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &IntegrationTestConfig{
		DBPool: pool,
	}, nil
}

// Cleanup closes the database connection pool
func (c *IntegrationTestConfig) Cleanup() {
	if c.DBPool != nil {
		c.DBPool.Close()
	}
}

// CleanupTestData removes test data from the database
// This should be called after each test to ensure isolation
func (c *IntegrationTestConfig) CleanupTestData(ctx context.Context, userID string) error {
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

// CleanupAllTestData removes ALL test data from the database (pattern-based cleanup)
// This cleans up data from all integration test runs (current and historical)
func (c *IntegrationTestConfig) CleanupAllTestData(ctx context.Context) error {
	queries := []string{
		`DELETE FROM export_history WHERE created_by LIKE 'integration-test-%'`,
		`DELETE FROM feature_flags WHERE updated_by LIKE 'integration-test-%'`,
		`DELETE FROM feature_flag_history WHERE changed_by LIKE 'integration-test-%'`,
		`DELETE FROM notification_templates WHERE created_by LIKE 'integration-test-%'`,
		`DELETE FROM notification_broadcasts WHERE created_by LIKE 'integration-test-%'`,
		`DELETE FROM nps_feedback WHERE user_id LIKE 'integration-test-%'`,
	}

	for _, query := range queries {
		if _, err := c.DBPool.Exec(ctx, query); err != nil {
			// Ignore errors for tables that might not exist
			continue
		}
	}

	return nil
}
