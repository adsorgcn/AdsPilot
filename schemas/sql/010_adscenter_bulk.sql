-- Adscenter bulk operations & diagnostics support tables

CREATE TABLE IF NOT EXISTS "BulkActionOperation" (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  plan       JSONB NOT NULL,
  status     TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bulk_op_user ON "BulkActionOperation"(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS "BulkActionShard" (
  id         BIGSERIAL PRIMARY KEY,
  op_id      TEXT NOT NULL,
  seq        INT NOT NULL,
  actions    JSONB NOT NULL,
  status     TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bulk_shard_op ON "BulkActionShard"(op_id, seq);

CREATE TABLE IF NOT EXISTS "BulkActionAudit" (
  id         BIGSERIAL PRIMARY KEY,
  op_id      TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  snapshot   JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bulk_audit_op ON "BulkActionAudit"(op_id, created_at);

CREATE TABLE IF NOT EXISTS "AuditEvent" (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_event_user ON "AuditEvent"(user_id, created_at DESC);

-- MCC link tracking
CREATE TABLE IF NOT EXISTS "MccLink" (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  status     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_mcc_link_user_customer ON "MccLink"(user_id, customer_id);

