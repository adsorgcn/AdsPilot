// Package migrations provides the entry point adscenter calls at startup.
//
// Cloud deployments apply schema out-of-band via db-admin (see
// services/adscenter/migrations/*.sql and migrations/core/*.sql); Run() stays a
// no-op there. The single-user local model has no db-admin, so RunLocal()
// applies the embedded schema bundle under local/ directly, tracked in a
// local_migrations version table so re-runs are cheap and idempotent.
package migrations

import (
	"database/sql"
	"embed"
	"fmt"
	"log"
	"sort"
	"time"

	_ "github.com/lib/pq"
)

//go:embed local/*.sql
var localFS embed.FS

// Run is a no-op placeholder for cloud deployments. Apply the SQL files under
// services/adscenter/migrations/ via db-admin instead.
func Run(databaseURL string) error {
	log.Printf("migrations.Run: schema is applied out-of-band via db-admin (see services/adscenter/migrations/*.sql); skipping in-process run")
	return nil
}

// RunLocal applies the embedded local-mode schema bundle to the database.
func RunLocal(databaseURL string) error {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	db.SetConnMaxLifetime(time.Minute)

	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS local_migrations (
		version    TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
	)`); err != nil {
		return fmt.Errorf("create local_migrations table: %w", err)
	}

	entries, err := localFS.ReadDir("local")
	if err != nil {
		return fmt.Errorf("read embedded migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var exists bool
		if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM local_migrations WHERE version = $1)`, name).Scan(&exists); err != nil {
			return fmt.Errorf("check migration %s: %w", name, err)
		}
		if exists {
			continue
		}

		body, err := localFS.ReadFile("local/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		log.Printf("migrations.RunLocal: applying %s", name)
		// No query arguments: lib/pq uses the simple query protocol, which
		// accepts multi-statement scripts (including DO $$ blocks and the
		// BEGIN/COMMIT pairs inside the files).
		if _, err := db.Exec(string(body)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := db.Exec(`INSERT INTO local_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING`, name); err != nil {
			return fmt.Errorf("record migration %s: %w", name, err)
		}
	}
	return nil
}
