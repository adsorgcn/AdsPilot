-- Notification rules evolution: extend initial 003 schema with operational alerting fields.

-- Ensure table exists (created by 003_notifications.sql). If not, create with full schema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notification_rules'
  ) THEN
    CREATE TABLE notification_rules (
      id           BIGSERIAL PRIMARY KEY,
      scope        TEXT NOT NULL DEFAULT 'system', -- system | user
      user_id      TEXT,
      service      TEXT NOT NULL,
      metric       TEXT NOT NULL,
      comparator   TEXT NOT NULL DEFAULT 'gt',
      threshold    DOUBLE PRECISION NOT NULL,
      window_sec   INT NOT NULL DEFAULT 300,
      channel      TEXT NOT NULL DEFAULT 'inapp',
      event_type   TEXT,
      enabled      BOOLEAN NOT NULL DEFAULT TRUE,
      params       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END$$;

-- Progressive columns (safe if created by 003):
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS scope       TEXT NOT NULL DEFAULT 'system';
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS service     TEXT;
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS metric      TEXT;
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS comparator  TEXT NOT NULL DEFAULT 'gt';
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS threshold   DOUBLE PRECISION;
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS window_sec  INT NOT NULL DEFAULT 300;
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS params      JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Keep legacy columns (user_id, event_type, channel, enabled, created_at, updated_at)

-- Backfill: if service/metric are NULL, set defaults based on legacy event_type (best-effort)
UPDATE notification_rules SET service = COALESCE(service, 'system') WHERE service IS NULL;
UPDATE notification_rules SET metric  = COALESCE(metric,  COALESCE(event_type, 'custom')) WHERE metric IS NULL;

-- Indexes
DO $$
BEGIN
  -- conditional index creation when columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notification_rules' AND column_name='service'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notification_rules' AND column_name='metric'
  ) THEN
    CREATE INDEX IF NOT EXISTS ix_notif_rules_service_metric ON notification_rules(service, metric) WHERE enabled;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS ix_notif_rules_scope_user ON notification_rules(scope, user_id);
