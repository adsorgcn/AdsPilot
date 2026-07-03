package main

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	// Get database URL from environment or use the Cloud SQL connection
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable not set")
	}

	// Connect to database
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Println("Successfully connected to database")

	// Create tables using the exact same DDL from useractivity service
	stmts := []string{
		// User notifications
		`CREATE TABLE IF NOT EXISTS user_notifications (
            id BIGSERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
		`CREATE INDEX IF NOT EXISTS ix_user_notifications_user_time ON user_notifications(user_id, id DESC)`,
		`CREATE TABLE IF NOT EXISTS user_notification_state (
            user_id TEXT PRIMARY KEY,
            last_read_id BIGINT NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,

		// Check-in system
		`CREATE TABLE IF NOT EXISTS checkins (
            id TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL UNIQUE,
            "lastCheckinAt" TIMESTAMPTZ,
            "totalCheckins" INTEGER NOT NULL DEFAULT 0,
            "currentStreak" INTEGER NOT NULL DEFAULT 0,
            "longestStreak" INTEGER NOT NULL DEFAULT 0,
            "tokensEarned" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
		`CREATE INDEX IF NOT EXISTS ix_checkins_userId ON checkins("userId")`,
		`CREATE TABLE IF NOT EXISTS user_checkin_stats (
            id TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "checkinDate" DATE NOT NULL,
            "tokensEarned" INTEGER NOT NULL DEFAULT 0,
            "streakDay" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE("userId", "checkinDate")
        )`,
		`CREATE INDEX IF NOT EXISTS ix_user_checkin_stats_userId ON user_checkin_stats("userId", "checkinDate" DESC)`,

		// Referral system
		`CREATE TABLE IF NOT EXISTS referrals (
            id TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL UNIQUE,
            referralCode TEXT NOT NULL UNIQUE,
            totalReferrals INTEGER NOT NULL DEFAULT 0,
            successfulReferrals INTEGER NOT NULL DEFAULT 0,
            totalRewards INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
		`CREATE INDEX IF NOT EXISTS ix_referrals_userId ON referrals("userId")`,
		`CREATE INDEX IF NOT EXISTS ix_referrals_code ON referrals("referralCode")`,
		`CREATE TABLE IF NOT EXISTS referral_records (
            id TEXT PRIMARY KEY,
            "inviterId" TEXT NOT NULL,
            "inviteeId" TEXT NOT NULL,
            referralCode TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            rewardAmount INTEGER NOT NULL DEFAULT 0,
            rewardGranted BOOLEAN NOT NULL DEFAULT FALSE,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "completedAt" TIMESTAMPTZ,
            UNIQUE("inviteeId")
        )`,
		`CREATE INDEX IF NOT EXISTS ix_referral_records_inviter ON referral_records("inviterId", "createdAt" DESC)`,
		`CREATE INDEX IF NOT EXISTS ix_referral_records_invitee ON referral_records("inviteeId")`,
		`CREATE TABLE IF NOT EXISTS trial_subscriptions (
            id TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            trialType TEXT NOT NULL,
            startDate TIMESTAMPTZ NOT NULL,
            endDate TIMESTAMPTZ NOT NULL,
            daysGranted INTEGER NOT NULL,
            source TEXT NOT NULL,
            referralId TEXT,
            isActive BOOLEAN NOT NULL DEFAULT TRUE,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
		`CREATE INDEX IF NOT EXISTS ix_trial_subscriptions_userId ON trial_subscriptions("userId", "endDate" DESC)`,
		`CREATE INDEX IF NOT EXISTS ix_trial_subscriptions_active ON trial_subscriptions("isActive", "endDate")`,

		// Event store table (from subscriber.go)
		`CREATE TABLE IF NOT EXISTS event_store (
            id BIGSERIAL PRIMARY KEY,
            event_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            aggregate_id TEXT NOT NULL DEFAULT '',
            aggregate_type TEXT NOT NULL DEFAULT '',
            version INTEGER NOT NULL DEFAULT 1,
            payload JSONB NOT NULL,
            metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
		`CREATE INDEX IF NOT EXISTS ix_event_store_name_time ON event_store(event_name, occurred_at DESC)`,
		`CREATE INDEX IF NOT EXISTS ix_event_store_aggregate ON event_store(aggregate_type, aggregate_id)`,
	}

	// Execute all statements
	for i, stmt := range stmts {
		log.Printf("Executing statement %d/%d...", i+1, len(stmts))
		if _, err := db.Exec(stmt); err != nil {
			log.Printf("Error executing statement %d: %v", i+1, err)
			log.Printf("Statement was: %s", stmt)
		} else {
			log.Printf("Statement %d executed successfully", i+1)
		}
	}

	// Verify tables were created
	log.Println("\nVerifying created tables...")
	rows, err := db.Query(`
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public'
		AND table_name IN (
			'user_notifications', 'user_notification_state', 'checkins',
			'user_checkin_stats', 'referrals', 'referral_records',
			'trial_subscriptions', 'event_store'
		)
		ORDER BY table_name
	`)
	if err != nil {
		log.Fatalf("Failed to query tables: %v", err)
	}
	defer rows.Close()

	log.Println("Created tables:")
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			log.Printf("Error scanning table name: %v", err)
			continue
		}
		log.Printf("  - %s", tableName)
	}

	// Insert test data
	log.Println("\nInserting test data...")

	// Test notification
	_, err = db.Exec(`
		INSERT INTO user_notifications (user_id, type, title, message, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT DO NOTHING
	`, "test-user-123", "TEST", "Welcome to Google-Monetize", "Your account has been successfully created!")
	if err != nil {
		log.Printf("Error inserting test notification: %v", err)
	} else {
		log.Println("Test notification inserted")
	}

	// Test checkin
	_, err = db.Exec(`
		INSERT INTO checkins (id, "userId", "lastCheckinAt", "totalCheckins", "currentStreak", "longestStreak", "tokensEarned", "createdAt", "updatedAt")
		VALUES ($1, $2, NOW(), 1, 1, 1, 10, NOW(), NOW())
		ON CONFLICT ("userId") DO UPDATE SET
			"totalCheckins" = EXCLUDED."totalCheckins",
			"lastCheckinAt" = EXCLUDED."lastCheckinAt",
			"updatedAt" = NOW()
	`, "checkin-test-123", "test-user-123")
	if err != nil {
		log.Printf("Error inserting test checkin: %v", err)
	} else {
		log.Println("Test checkin inserted")
	}

	log.Println("\nDatabase setup completed successfully!")
}
