// Package testutil provides utilities for integration testing
package testutil

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

// PreviewEnvConfig holds configuration for preview environment testing
type PreviewEnvConfig struct {
	// Supabase 配置
	SupabaseURL        string
	SupabaseDBURL      string
	SupabaseServiceKey string

	// Cloud Run 服务 URL
	BillingURL         string
	OfferURL           string
	AdscenterURL       string
	SiterankURL        string
	BrowserExecURL     string
	RecommendationsURL string
	ProxyPoolURL       string

	// 测试用户配置
	TestUserID    string
	TestUserEmail string
	TestUserToken string
}

// LoadPreviewEnvConfig loads preview environment configuration from environment variables
func LoadPreviewEnvConfig() *PreviewEnvConfig {
	return &PreviewEnvConfig{
		SupabaseURL:        getEnv("SUPABASE_URL", "https://YOUR_SUPABASE_PROJECT.supabase.co"),
		SupabaseDBURL:      getEnv("SUPABASE_DB_URL", "postgres://postgres.YOUR_SUPABASE_PROJECT:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"),
		SupabaseServiceKey: getEnv("SUPABASE_SERVICE_KEY", ""),

		BillingURL:         getEnv("BILLING_URL", "https://billing-preview-644672509127.asia-northeast1.run.app"),
		OfferURL:           getEnv("OFFER_URL", "https://offer-preview-644672509127.asia-northeast1.run.app"),
		AdscenterURL:       getEnv("ADSCENTER_URL", "https://adscenter-preview-644672509127.asia-northeast1.run.app"),
		SiterankURL:        getEnv("SITERANK_URL", "https://siterank-preview-yt54xvsg5q-an.a.run.app"),
		BrowserExecURL:     getEnv("BROWSER_EXEC_URL", "https://browser-exec-preview-yt54xvsg5q-an.a.run.app"),
		RecommendationsURL: getEnv("RECOMMENDATIONS_URL", "https://recommendations-preview-yt54xvsg5q-an.a.run.app"),
		ProxyPoolURL:       getEnv("PROXY_POOL_URL", "https://proxy-pool-preview-yt54xvsg5q-an.a.run.app"),

		TestUserID:    getEnv("TEST_USER_ID", fmt.Sprintf("test-user-%d", time.Now().Unix())),
		TestUserEmail: getEnv("TEST_USER_EMAIL", "test@integration.test"),
		TestUserToken: getEnv("TEST_USER_TOKEN", ""),
	}
}

// ConnectToSupabase connects to Supabase PostgreSQL database
func (c *PreviewEnvConfig) ConnectToSupabase(t *testing.T) *sql.DB {
	t.Helper()

	if c.SupabaseDBURL == "" || c.SupabaseDBURL == "postgres://postgres.YOUR_SUPABASE_PROJECT:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require" {
		t.Skip("Supabase database URL not configured. Set SUPABASE_DB_URL environment variable.")
	}

	db, err := sql.Open("postgres", c.SupabaseDBURL)
	if err != nil {
		t.Skipf("Failed to connect to Supabase: %v", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		t.Skipf("Supabase database not available: %v", err)
	}

	return db
}

// HealthCheck checks if a service is available
func (c *PreviewEnvConfig) HealthCheck(t *testing.T, serviceURL string) {
	t.Helper()

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(serviceURL + "/health")
	if err != nil {
		t.Skipf("Service not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Skipf("Service unhealthy: status code %d", resp.StatusCode)
	}
}

// MakeRequest makes an HTTP request with authorization
func (c *PreviewEnvConfig) MakeRequest(method, url string, body []byte) (*http.Response, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	var req *http.Request
	var err error

	if body != nil {
		req, err = http.NewRequest(method, url, nil)
	} else {
		req, err = http.NewRequest(method, url, nil)
	}

	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if c.TestUserToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.TestUserToken)
	}

	return client.Do(req)
}

// CleanupTestData cleans up test data from database
func (c *PreviewEnvConfig) CleanupTestData(t *testing.T, db *sql.DB, userID string) {
	t.Helper()

	// Clean up in reverse order of dependencies
	tables := []string{
		"TokenTransaction",
		"UserToken",
		"Subscription",
		"Offer",
		"SiterankHistory",
		"User",
	}

	for _, table := range tables {
		_, err := db.Exec(fmt.Sprintf(`DELETE FROM "%s" WHERE id LIKE $1 OR "userId" LIKE $1`, table), userID+"%")
		if err != nil {
			t.Logf("Warning: failed to clean up %s: %v", table, err)
		}
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// SkipIfShort skips the test if running in short mode
func SkipIfShort(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}
}

// RequireDB skips the test if database is not available
func RequireDB(t *testing.T, db *sql.DB) {
	if db == nil {
		t.Skip("Database connection required")
	}

	if err := db.Ping(); err != nil {
		t.Skipf("Database not available: %v", err)
	}
}

// CreateTestUser creates a test user in the database
func CreateTestUser(t *testing.T, db *sql.DB, userID, email string) {
	t.Helper()

	_, err := db.Exec(`
		INSERT INTO "User" (id, email, "createdAt", "updatedAt")
		VALUES ($1, $2, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, userID, email)

	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
}
