// Package migrations provides the entry point adscenter calls at startup.
//
// In this deployment, schema migrations are applied out-of-band via db-admin
// (see services/adscenter/migrations/*.sql and migrations/core/*.sql), run with
// psql / the migration tooling. Services verify that required tables exist rather
// than creating them at runtime. Run() is kept for API compatibility and does not
// perform in-process DDL.
package migrations

import "log"

// Run is a no-op placeholder. Apply the SQL files under
// services/adscenter/migrations/ via db-admin instead.
func Run(databaseURL string) error {
	log.Printf("migrations.Run: schema is applied out-of-band via db-admin (see services/adscenter/migrations/*.sql); skipping in-process run")
	return nil
}
