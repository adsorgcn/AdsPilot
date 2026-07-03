-- Patch legacy notification_rules schema to add operational fields safely
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS scope       TEXT NOT NULL DEFAULT 'system';
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS service     TEXT;
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS metric      TEXT;
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS comparator  TEXT NOT NULL DEFAULT 'gt';
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS threshold   DOUBLE PRECISION;
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS window_sec  INT NOT NULL DEFAULT 300;
ALTER TABLE notification_rules ADD COLUMN IF NOT EXISTS params      JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE notification_rules SET service = COALESCE(service, 'system') WHERE service IS NULL;
UPDATE notification_rules SET metric  = COALESCE(metric,  COALESCE(event_type, 'custom')) WHERE metric IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ix_notif_rules_service_metric'
  ) THEN
    CREATE INDEX IF NOT EXISTS ix_notif_rules_service_metric ON notification_rules(service, metric) WHERE enabled;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS ix_notif_rules_scope_user ON notification_rules(scope, user_id);

