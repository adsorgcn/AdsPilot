-- Add missing name column to Offer read model
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';

