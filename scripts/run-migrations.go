package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/lib/pq"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Error connecting to database:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("Error pinging database:", err)
	}

	fmt.Println("🔄 Connected to database successfully")

	// Get project root directory
	projectRoot := os.Getenv("PROJECT_ROOT")
	if projectRoot == "" {
		projectRoot = "/workspace"
	}

	migrations := []string{
		"024_add_missing_ai_fields.sql",
		"025_evaluation_trends.sql",
		"026_daily_checkin.sql",
	}

	ctx := context.Background()

	for _, migration := range migrations {
		migrationPath := filepath.Join(projectRoot, "schemas/sql", migration)
		fmt.Printf("\n📝 Running migration: %s\n", migration)

		content, err := os.ReadFile(migrationPath)
		if err != nil {
			log.Fatalf("Error reading migration file %s: %v", migration, err)
		}

		// Execute migration
		_, err = db.ExecContext(ctx, string(content))
		if err != nil {
			log.Fatalf("Error executing migration %s: %v", migration, err)
		}

		fmt.Printf("✅ Migration %s completed successfully\n", migration)
	}

	fmt.Println("\n🎉 All migrations completed successfully!")
}
