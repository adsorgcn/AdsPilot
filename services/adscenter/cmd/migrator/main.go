//go:build migration
// +build migration

package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	migrationsDir := strings.TrimSpace(os.Getenv("MIGRATIONS_DIR"))
	if migrationsDir == "" {
		migrationsDir = "internal/migrations"
	}

	log.Printf("Adscenter DB Migrator starting...")
	log.Printf("Migrations directory: %s", migrationsDir)

	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Wait for database readiness (max 60s)
	retries := 12
	for i := 0; i < retries; i++ {
		if err := db.PingContext(ctx); err == nil {
			log.Printf("Database connection established")
			break
		}
		if i == retries-1 {
			log.Fatalf("Database not ready after %d attempts", retries)
		}
		log.Printf("Waiting for database... (attempt %d/%d)", i+1, retries)
		time.Sleep(5 * time.Second)
	}

	// Run migrations in transaction
	if err := runMigrations(ctx, db, migrationsDir); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Printf("✅ All migrations completed successfully")
}

func runMigrations(ctx context.Context, db *sql.DB, dir string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if err := tx.Rollback(); err != nil && err != sql.ErrTxDone {
			log.Printf("WARN: failed to rollback: %v", err)
		}
	}()

	// Create migration tracking table
	if _, err := tx.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`); err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	// Get applied migrations
	applied := make(map[string]bool)
	rows, err := tx.QueryContext(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return fmt.Errorf("query applied migrations: %w", err)
	}
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			rows.Close()
			return fmt.Errorf("scan version: %w", err)
		}
		applied[version] = true
	}
	rows.Close()

	// Read migration files
	files, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("No migrations directory found at %s, skipping", dir)
			return tx.Commit()
		}
		return fmt.Errorf("read migrations directory: %w", err)
	}

	// Filter and sort .sql files (exclude hidden files)
	var migrations []string
	for _, file := range files {
		name := file.Name()
		if file.IsDir() || !strings.HasSuffix(name, ".sql") || strings.HasPrefix(name, ".") {
			continue
		}
		migrations = append(migrations, name)
	}
	sort.Strings(migrations)

	// Apply migrations
	for _, filename := range migrations {
		if applied[filename] {
			log.Printf("⏭️  Skipping already applied: %s", filename)
			continue
		}

		log.Printf("📝 Applying migration: %s", filename)
		content, err := os.ReadFile(filepath.Join(dir, filename))
		if err != nil {
			return fmt.Errorf("read migration file %s: %w", filename, err)
		}

		// Split by semicolon and execute each statement
		statements := strings.Split(string(content), ";")
		for _, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			if _, err := tx.ExecContext(ctx, stmt); err != nil {
				return fmt.Errorf("execute migration %s: %w", filename, err)
			}
		}

		// Record migration
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO schema_migrations (version) VALUES ($1)
		`, filename); err != nil {
			return fmt.Errorf("record migration %s: %w", filename, err)
		}

		log.Printf("✅ Applied: %s", filename)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}
