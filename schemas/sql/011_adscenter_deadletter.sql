-- Dead letter storage for bulk actions

CREATE TABLE IF NOT EXISTS "BulkActionDeadLetter" (
  id           BIGSERIAL PRIMARY KEY,
  op_id        TEXT NOT NULL,
  action_idx   INT NOT NULL,
  action_type  TEXT NOT NULL,
  error        TEXT,
  action       JSONB NOT NULL,
  result       JSONB,
  retry_count  INT NOT NULL DEFAULT 0,
  retried_at   TIMESTAMPTZ NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending|retried|discarded
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bulk_dead_op ON "BulkActionDeadLetter"(op_id, status);

