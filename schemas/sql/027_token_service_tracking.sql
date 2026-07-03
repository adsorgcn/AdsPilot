-- Migration 027: Add service tracking fields to TokenTransaction
-- Purpose: Enable service-level token usage reporting
-- Date: 2025-10-07
-- Related: Token System Implementation (docs/MarkerkitGo/Token_System_Implementation_Summary_CN.md)

-- Add service and actionType columns (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'TokenTransaction'
      AND column_name = 'service'
  ) THEN
    ALTER TABLE "TokenTransaction" ADD COLUMN service TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'TokenTransaction'
      AND column_name = 'actionType'
  ) THEN
    ALTER TABLE "TokenTransaction" ADD COLUMN "actionType" TEXT;
  END IF;
END $$;

-- Create indexes for service-level queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_token_transaction_service
  ON "TokenTransaction"(service);

CREATE INDEX IF NOT EXISTS idx_token_transaction_service_user
  ON "TokenTransaction"("userId", service);

CREATE INDEX IF NOT EXISTS idx_token_transaction_service_created
  ON "TokenTransaction"(service, "createdAt" DESC);

-- Backfill service and actionType from metadata JSONB
-- Only for records that have these fields in metadata but not in columns
UPDATE "TokenTransaction"
SET
  service = (metadata->>'service')::TEXT,
  "actionType" = (metadata->>'action')::TEXT
WHERE
  service IS NULL
  AND metadata IS NOT NULL
  AND metadata->>'service' IS NOT NULL;

-- Add check constraint for new records (after 2025-10-07)
-- Allow NULL for old records but require for new ones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_token_transaction_service_required'
      AND conrelid = 'public."TokenTransaction"'::regclass
  ) THEN
    ALTER TABLE "TokenTransaction"
    ADD CONSTRAINT chk_token_transaction_service_required
    CHECK (
      "createdAt" < '2025-10-07'::timestamptz
      OR (service IS NOT NULL AND service != '')
    );
  END IF;
END $$;

-- Add comments for documentation (idempotent)
COMMENT ON COLUMN "TokenTransaction".service IS 'Service that consumed the tokens (e.g., offer, siterank, adscenter)';
COMMENT ON COLUMN "TokenTransaction"."actionType" IS 'Specific action type within the service (e.g., create_offer, cached_query, ai_evaluation)';
