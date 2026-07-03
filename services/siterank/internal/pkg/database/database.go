package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/lib/pq" // The PostgreSQL driver
)

// NewConnection creates and returns a new database connection pool.
// It takes a Data Source Name (DSN) string as input.
// Supports schema isolation via SCHEMA_NAME environment variable.
func NewConnection(dsn string) (*sql.DB, error) {
	// Read schema from environment variable for schema isolation
	schema := strings.TrimSpace(os.Getenv("SCHEMA_NAME"))
	if schema == "" {
		schema = "public"
		log.Printf("SCHEMA_NAME not set, using default schema: public")
	}

	// Append search_path to DSN if not already present
	if !strings.Contains(dsn, "search_path") {
		separator := "?"
		if strings.Contains(dsn, "?") {
			separator = "&"
		}
		dsn += fmt.Sprintf("%ssearch_path=%s,public", separator, schema)
	}

	// sql.Open just validates its arguments without creating a connection.
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// db.Ping verifies a connection to the database is still alive,
	// establishing a connection if necessary.
	if err = db.Ping(); err != nil {
		// If ping fails, close the connection pool and return the error.
		defer db.Close()
		return nil, fmt.Errorf("failed to connect to the database: %w", err)
	}

	// Verify search_path
	var currentPath string
	err = db.QueryRow("SHOW search_path").Scan(&currentPath)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to verify search_path: %w", err)
	}

	log.Printf("Database connected successfully with search_path: %s", currentPath)

	return db, nil
}
