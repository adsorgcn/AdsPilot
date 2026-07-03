package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/lib/pq" // PostgreSQL driver
)

// InitWithSchema initializes a database connection with schema-specific search_path
// It reads SCHEMA_NAME environment variable to determine which schema to use
// Falls back to "public" if SCHEMA_NAME is not set
func InitWithSchema(dbURL string) (*sql.DB, error) {
	schema := strings.TrimSpace(os.Getenv("SCHEMA_NAME"))
	if schema == "" {
		schema = "public"
		log.Printf("SCHEMA_NAME not set, using default schema: public")
	}

	// Append search_path to DATABASE_URL if not already present
	if !strings.Contains(dbURL, "search_path") {
		separator := "?"
		if strings.Contains(dbURL, "?") {
			separator = "&"
		}
		dbURL += fmt.Sprintf("%ssearch_path=%s,public", separator, schema)
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
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

// InitWithSchemaAndPool initializes a database connection with schema-specific search_path
// and configures connection pool settings with optimized defaults for multi-user SaaS
func InitWithSchemaAndPool(dbURL string) (*sql.DB, error) {
	db, err := InitWithSchema(dbURL)
	if err != nil {
		return nil, err
	}

	// Configure connection pool with optimized settings
	// Defaults are optimized for multi-user SaaS workloads
	maxOpen := getEnvInt("DB_MAX_OPEN_CONNS", 25)               // Support 25 concurrent users
	maxIdle := getEnvInt("DB_MAX_IDLE_CONNS", 10)               // Keep 10 idle connections ready
	maxLifetime := getEnvInt("DB_MAX_CONN_LIFETIME_MINUTES", 5) // 5 minutes (changed from 30)
	maxIdleTime := getEnvInt("DB_MAX_IDLE_TIME_MINUTES", 2)     // 2 minutes idle timeout

	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxIdle)
	db.SetConnMaxLifetime(time.Duration(maxLifetime) * time.Minute)
	db.SetConnMaxIdleTime(time.Duration(maxIdleTime) * time.Minute) // New: idle timeout

	log.Printf("Database connection pool configured (optimized for SaaS): maxOpen=%d, maxIdle=%d, maxLifetime=%dm, maxIdleTime=%dm",
		maxOpen, maxIdle, maxLifetime, maxIdleTime)

	return db, nil
}

func getEnvInt(key string, defaultValue int) int {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return defaultValue
	}

	intVal, err := strconv.Atoi(val)
	if err != nil {
		log.Printf("Invalid value for %s (%s), using default: %d", key, val, defaultValue)
		return defaultValue
	}

	return intVal
}

// InitPgxPoolWithSchema initializes a pgxpool connection with schema-specific search_path
// Used by services that use pgx instead of database/sql
func InitPgxPoolWithSchema(ctx context.Context, dbURL string) (*pgxpool.Pool, error) {
	schema := strings.TrimSpace(os.Getenv("SCHEMA_NAME"))
	if schema == "" {
		schema = "public"
		log.Printf("SCHEMA_NAME not set, using default schema: public")
	}

	// Append search_path to DATABASE_URL if not already present
	if !strings.Contains(dbURL, "search_path") {
		separator := "?"
		if strings.Contains(dbURL, "?") {
			separator = "&"
		}
		dbURL += fmt.Sprintf("%ssearch_path=%s,public", separator, schema)
	}

	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Configure pool settings from environment (optimized for multi-user SaaS)
	maxConns := int32(getEnvInt("DB_MAX_OPEN_CONNS", 25))
	minConns := int32(getEnvInt("DB_MIN_CONNS", 5))
	maxLifetime := time.Duration(getEnvInt("DB_MAX_CONN_LIFETIME_MINUTES", 5)) * time.Minute // Changed from 30 to 5
	maxIdleTime := time.Duration(getEnvInt("DB_MAX_IDLE_TIME_MINUTES", 2)) * time.Minute     // New: 2 minutes

	poolConfig.MaxConns = maxConns
	poolConfig.MinConns = minConns
	poolConfig.MaxConnLifetime = maxLifetime
	poolConfig.MaxConnIdleTime = maxIdleTime // New: idle timeout

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Verify search_path
	var currentPath string
	err = pool.QueryRow(ctx, "SHOW search_path").Scan(&currentPath)
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to verify search_path: %w", err)
	}

	log.Printf("PgxPool connected successfully with search_path: %s (maxConns=%d, minConns=%d, maxLifetime=%s, maxIdleTime=%s)",
		currentPath, maxConns, minConns, maxLifetime, maxIdleTime)
	return pool, nil
}
