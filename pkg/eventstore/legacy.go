package eventstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
)

// EnsureDDL creates the base event_store table if not exists.
// Deprecated: use Store.EnsureSchema instead.
func EnsureDDL(db *sql.DB) error {
	if db == nil {
		return nil
	}
	ddl := `
CREATE TABLE IF NOT EXISTS event_store (
  id             BIGSERIAL PRIMARY KEY,
  event_id       TEXT        NOT NULL,
  event_name     TEXT        NOT NULL,
  aggregate_id   TEXT        NOT NULL,
  aggregate_type TEXT        NOT NULL,
  version        INT         NOT NULL,
  payload        JSONB       NOT NULL,
  metadata       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_event_store_agg ON event_store(aggregate_type, aggregate_id, version);
CREATE INDEX IF NOT EXISTS ix_event_store_time ON event_store(occurred_at DESC);
`
	_, err := db.Exec(ddl)
	return err
}

// WriteWithDB writes an event row using an existing *sql.DB connection.
// Deprecated: use Store.Append instead.
func WriteWithDB(ctx context.Context, db *sql.DB, eventID, name, aggregateType, aggregateID string, version int, payload any, meta map[string]any) error {
	if db == nil {
		return nil
	}
	if meta == nil {
		meta = map[string]any{}
	}
	pb, _ := json.Marshal(payload)
	mb, _ := json.Marshal(meta)
	_, err := db.ExecContext(ctx, `
        INSERT INTO event_store (event_id, event_name, aggregate_id, aggregate_type, version, payload, metadata, occurred_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)
    `, eventID, name, aggregateID, aggregateType, version, string(pb), string(mb), time.Now().UTC())
	return err
}
