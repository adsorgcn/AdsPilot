-- Ensure core columns exist on Offer read model (idempotent)
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "siterankScore" DOUBLE PRECISION;
-- Optional legacy compatibility clean-up is out of scope here; v3 focuses on ensuring unified columns exist.

