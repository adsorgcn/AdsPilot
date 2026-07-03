package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Migration represents a single migration file
type Migration struct {
	Version  string
	Filename string
	SQL      string
}

func main() {
	ctx := context.Background()

	// Get database URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	// Connect to database
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	log.Println("✓ Connected to database")

	// Ensure migrations table exists
	if err := ensureMigrationsTable(ctx, pool); err != nil {
		log.Fatalf("Failed to create migrations table: %v", err)
	}

	// Load migrations from embedded files or directory
	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "./migrations"
	}

	migrations, err := loadMigrations(migrationsDir)
	if err != nil {
		log.Fatalf("Failed to load migrations: %v", err)
	}

	log.Printf("✓ Found %d migration files", len(migrations))

	// Run migrations
	applied := 0
	for _, migration := range migrations {
		if err := runMigration(ctx, pool, migration); err != nil {
			log.Fatalf("Failed to run migration %s: %v", migration.Filename, err)
		}
		applied++
	}

	if applied == 0 {
		log.Println("✓ No new migrations to apply")
	} else {
		log.Printf("✓ Successfully applied %d migrations", applied)
	}
}

// ensureMigrationsTable creates the migrations tracking table
func ensureMigrationsTable(ctx context.Context, pool *pgxpool.Pool) error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMP DEFAULT NOW()
		);
	`
	_, err := pool.Exec(ctx, query)
	return err
}

// loadMigrations reads all .sql files from the migrations directory
func loadMigrations(dir string) ([]Migration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var migrations []Migration
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		// Skip .down.sql files
		if strings.HasSuffix(entry.Name(), ".down.sql") {
			continue
		}

		// Read file content
		filePath := filepath.Join(dir, entry.Name())
		content, err := os.ReadFile(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to read %s: %w", entry.Name(), err)
		}

		// Extract version from filename (e.g., "003_create_token_rules_table.sql" -> "003")
		version := extractVersion(entry.Name())

		migrations = append(migrations, Migration{
			Version:  version,
			Filename: entry.Name(),
			SQL:      string(content),
		})
	}

	// Sort migrations by version
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}

// extractVersion extracts version number from migration filename
func extractVersion(filename string) string {
	parts := strings.SplitN(filename, "_", 2)
	if len(parts) > 0 {
		return parts[0]
	}
	return filename
}

// runMigration executes a single migration if not already applied
func runMigration(ctx context.Context, pool *pgxpool.Pool, migration Migration) error {
	// Check if migration already applied
	var exists bool
	err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", migration.Version).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check migration status: %w", err)
	}

	if exists {
		log.Printf("⊘ Skipping %s (already applied)", migration.Filename)
		return nil
	}

	// Begin transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Execute migration SQL
	log.Printf("→ Applying %s...", migration.Filename)
	if _, err := tx.Exec(ctx, migration.SQL); err != nil {
		return fmt.Errorf("failed to execute migration SQL: %w", err)
	}

	// Record migration as applied
	if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", migration.Version); err != nil {
		return fmt.Errorf("failed to record migration: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("✓ Applied %s", migration.Filename)
	return nil
}
