package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

// NewOptimizedConnection creates a database connection with optimized settings for multi-user SaaS
// This configuration is optimized for:
// - Multiple concurrent users (25 concurrent requests)
// - User-level data isolation
// - Efficient connection reuse
func NewOptimizedConnection(dsn string) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// 多用户 SaaS 优化配置
	// Supports 25 concurrent users
	db.SetMaxOpenConns(25)

	// Keep 10 idle connections ready for instant response
	db.SetMaxIdleConns(10)

	// Maximum connection lifetime: 5 minutes
	// Prevents stale connections and ensures fresh connections to Cloud SQL
	db.SetConnMaxLifetime(5 * time.Minute)

	// Idle connection timeout: 2 minutes
	// Releases unused connections to reduce resource usage
	db.SetConnMaxIdleTime(2 * time.Minute)

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping failed: %w", err)
	}

	return db, nil
}

// NewOptimizedConnectionWithSchema combines optimized connection pool with schema isolation
func NewOptimizedConnectionWithSchema(dsn string) (*sql.DB, error) {
	// First apply schema configuration
	db, err := InitWithSchema(dsn)
	if err != nil {
		return nil, err
	}

	// Then apply optimized pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)

	return db, nil
}
