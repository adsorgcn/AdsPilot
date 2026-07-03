-- Align with in-service DDL (pkg/eventstore & notifications subscriber): event_id as TEXT
CREATE TABLE IF NOT EXISTS event_store (
  id             BIGSERIAL PRIMARY KEY,
  event_id       TEXT        NOT NULL,
  event_name     TEXT        NOT NULL,
  aggregate_id   TEXT        NOT NULL,
  aggregate_type TEXT        NOT NULL,
  version        INT         NOT NULL,
  payload        JSONB       NOT NULL,
  metadata       JSONB       DEFAULT '{}'::jsonb NOT NULL,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_event_store_event_id ON event_store(event_id);
CREATE INDEX IF NOT EXISTS ix_event_store_aggregate ON event_store(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS ix_event_store_name_time ON event_store(event_name, occurred_at DESC);
