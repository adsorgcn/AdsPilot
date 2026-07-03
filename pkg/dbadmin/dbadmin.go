package dbadmin

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// Client represents a database admin client
type Client struct {
	BaseURL string
	Token   string
	Client  *http.Client
}

// NewClient creates a new dbadmin client
func NewClient(baseURL, token string) *Client {
	return &Client{
		BaseURL: baseURL,
		Token:   token,
		Client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Ping checks if the dbadmin service is reachable
func (c *Client) Ping(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.BaseURL+"/health", nil)
	if err != nil {
		return err
	}

	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}

	resp, err := c.Client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("dbadmin service returned status %d", resp.StatusCode)
	}

	return nil
}

// GetDBConnection returns a database connection using the dbadmin service
func (c *Client) GetDBConnection(ctx context.Context, dbName string) (*sql.DB, error) {
	// For now, return environment-based connection
	// In a real implementation, this would call the dbadmin service
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL not set")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, err
	}

	// Test connection
	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

// OpenDB opens a database connection using the dbadmin service
func OpenDB(dbAdminURL, dbAdminToken, serviceName string) (*sql.DB, error) {
	// For now, we'll use environment variable for DATABASE_URL
	// In a full implementation, this would use the dbadmin service to get connection details
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL not set")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return db, nil
}
