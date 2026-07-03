-- Migration: Token Reservation System (Billing Service)
-- Date: 2025-10-15
-- Task: BE-031

-- Token reservations table for pre-deduction mechanism
CREATE TABLE IF NOT EXISTS token_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    reason VARCHAR(50) NOT NULL,
    reference_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'reserved', -- reserved, confirmed, refunded

    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    refunded_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_token_reservations_user_id ON token_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_reservations_reference_id ON token_reservations(reference_id);
CREATE INDEX IF NOT EXISTS idx_token_reservations_status ON token_reservations(status);
CREATE INDEX IF NOT EXISTS idx_token_reservations_created_at ON token_reservations(created_at DESC);

-- RLS policy
ALTER TABLE token_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_own_token_reservations ON token_reservations;
CREATE POLICY user_own_token_reservations ON token_reservations
    FOR ALL USING (user_id = current_setting('app.user_id')::uuid);
