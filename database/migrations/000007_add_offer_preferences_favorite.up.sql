-- Adds favorite column to OfferPreferences for offer tagging support
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'offer_db' AND table_name = 'OfferPreferences'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'offer_db'
              AND table_name = 'OfferPreferences'
              AND column_name = 'favorite'
        ) THEN
            ALTER TABLE offer_db."OfferPreferences" ADD COLUMN favorite BOOLEAN DEFAULT FALSE;
        END IF;
    END IF;

    -- public view (for legacy/non-isolated deployments)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'OfferPreferences'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'OfferPreferences'
              AND column_name = 'favorite'
        ) THEN
            ALTER TABLE public."OfferPreferences" ADD COLUMN favorite BOOLEAN DEFAULT FALSE;
        END IF;
    END IF;
END $$;
