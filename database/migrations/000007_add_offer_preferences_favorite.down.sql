-- Removes favorite column from OfferPreferences
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'offer_db'
          AND table_name = 'OfferPreferences'
          AND column_name = 'favorite'
    ) THEN
        ALTER TABLE offer_db."OfferPreferences" DROP COLUMN favorite;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'OfferPreferences'
          AND column_name = 'favorite'
    ) THEN
        ALTER TABLE public."OfferPreferences" DROP COLUMN favorite;
    END IF;
END $$;
