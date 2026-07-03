package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// MigrationReport contains the results of the migration
type MigrationReport struct {
	TotalRecords     int            `json:"total_records"`
	SuccessCount     int            `json:"success_count"`
	FailureCount     int            `json:"failure_count"`
	SkippedCount     int            `json:"skipped_count"`
	FailedRecords    []FailedRecord `json:"failed_records"`
	StartTime        time.Time      `json:"start_time"`
	EndTime          time.Time      `json:"end_time"`
	Duration         string         `json:"duration"`
	SourceTable      string         `json:"source_table"`
	DestinationTable string         `json:"destination_table"`
}

// FailedRecord contains information about a failed migration
type FailedRecord struct {
	ID     string `json:"id"`
	UserID string `json:"user_id"`
	Reason string `json:"reason"`
}

// TrialSubscription represents a record from the source table
type TrialSubscription struct {
	ID        string
	UserID    string
	PlanTier  string
	StartDate time.Time
	EndDate   time.Time
	IsActive  bool
	Source    string
	CreatedAt time.Time
}

func main() {
	log.Println("=== Trial Subscriptions Migration ===")
	log.Println("This script migrates trial_subscriptions data from useractivity to billing service")
	log.Println()

	// Get database URL from environment
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("Error: DATABASE_URL environment variable not set")
	}

	// Connect to database
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("✓ Database connection established")

	// Check if source table exists
	var sourceExists bool
	err = db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_name = 'trial_subscriptions'
		)
	`).Scan(&sourceExists)
	if err != nil {
		log.Fatalf("Failed to check source table: %v", err)
	}

	if !sourceExists {
		log.Println("Warning: trial_subscriptions table does not exist")
		log.Println("This may be expected if migration has already been completed")
		os.Exit(0)
	}

	// Check if destination table exists
	var destExists bool
	err = db.QueryRow(`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_name = 'subscriptions'
		)
	`).Scan(&destExists)
	if err != nil {
		log.Fatalf("Failed to check destination table: %v", err)
	}

	if !destExists {
		log.Fatal("Error: subscriptions table does not exist. Please run billing service migrations first.")
	}

	// Perform migration
	ctx := context.Background()
	report, err := migrateTrialSubscriptions(ctx, db)
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	// Print report
	printReport(report)

	// Save report to file
	reportFile := fmt.Sprintf("migration-report-%s.json", time.Now().Format("20060102-150405"))
	if err := saveReport(report, reportFile); err != nil {
		log.Printf("Warning: Failed to save report to file: %v", err)
	} else {
		log.Printf("✓ Migration report saved to: %s", reportFile)
	}

	// Exit with appropriate code
	if report.FailureCount > 0 {
		log.Println()
		log.Printf("Migration completed with %d failures", report.FailureCount)
		os.Exit(1)
	}

	log.Println()
	log.Println("✓ Migration completed successfully")
}

func migrateTrialSubscriptions(ctx context.Context, db *sql.DB) (*MigrationReport, error) {
	report := &MigrationReport{
		StartTime:        time.Now(),
		SourceTable:      "trial_subscriptions",
		DestinationTable: "subscriptions",
	}

	log.Println("Starting migration...")
	log.Println()

	// Query source data
	rows, err := db.QueryContext(ctx, `
		SELECT 
			id, 
			"userId", 
			"planTier", 
			"startDate", 
			"endDate", 
			"isActive", 
			COALESCE(source, 'self_register') as source,
			"createdAt"
		FROM trial_subscriptions
		ORDER BY "createdAt" ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query source table: %w", err)
	}
	defer rows.Close()

	// Process each record
	for rows.Next() {
		var ts TrialSubscription
		err := rows.Scan(
			&ts.ID,
			&ts.UserID,
			&ts.PlanTier,
			&ts.StartDate,
			&ts.EndDate,
			&ts.IsActive,
			&ts.Source,
			&ts.CreatedAt,
		)
		if err != nil {
			log.Printf("Warning: Failed to scan row: %v", err)
			report.FailureCount++
			continue
		}

		report.TotalRecords++

		// Check if record already exists in destination
		var exists bool
		err = db.QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM subscriptions 
				WHERE id = $1
			)
		`, ts.ID).Scan(&exists)
		if err != nil {
			log.Printf("Warning: Failed to check existing record for ID %s: %v", ts.ID, err)
			report.FailedRecords = append(report.FailedRecords, FailedRecord{
				ID:     ts.ID,
				UserID: ts.UserID,
				Reason: fmt.Sprintf("Failed to check existing record: %v", err),
			})
			report.FailureCount++
			continue
		}

		if exists {
			log.Printf("  Skipping ID %s (already exists)", ts.ID)
			report.SkippedCount++
			continue
		}

		// Convert data format
		plan := convertPlanTier(ts.PlanTier)
		status := determineStatus(ts.IsActive, ts.EndDate)
		trialSource := convertTrialSource(ts.Source)

		// Insert into destination table
		_, err = db.ExecContext(ctx, `
			INSERT INTO subscriptions (
				id,
				user_id,
				plan,
				status,
				trial_start_date,
				trial_end_date,
				trial_source,
				created_at,
				updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
		`,
			ts.ID,
			ts.UserID,
			plan,
			status,
			ts.StartDate,
			ts.EndDate,
			trialSource,
			ts.CreatedAt,
		)

		if err != nil {
			log.Printf("  ✗ Failed to migrate ID %s: %v", ts.ID, err)
			report.FailedRecords = append(report.FailedRecords, FailedRecord{
				ID:     ts.ID,
				UserID: ts.UserID,
				Reason: fmt.Sprintf("Insert failed: %v", err),
			})
			report.FailureCount++
		} else {
			log.Printf("  ✓ Migrated ID %s (user: %s, plan: %s, status: %s)", ts.ID, ts.UserID, plan, status)
			report.SuccessCount++
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	report.EndTime = time.Now()
	report.Duration = report.EndTime.Sub(report.StartTime).String()

	return report, nil
}

// convertPlanTier converts old plan tier format to new format
func convertPlanTier(oldTier string) string {
	switch oldTier {
	case "pro", "professional":
		return "professional"
	case "elite", "max":
		return "elite"
	case "starter", "free":
		return "starter"
	default:
		return "professional" // Default to professional for trial subscriptions
	}
}

// determineStatus determines the subscription status
func determineStatus(isActive bool, endDate time.Time) string {
	if !isActive {
		return "expired"
	}
	if time.Now().After(endDate) {
		return "expired"
	}
	return "trial"
}

// convertTrialSource converts trial source format
func convertTrialSource(source string) string {
	switch source {
	case "self_register", "registration":
		return "self_register"
	case "referral_inviter", "inviter":
		return "referral_inviter"
	case "referral_invitee", "invitee":
		return "referral_invitee"
	default:
		return "self_register"
	}
}

func printReport(report *MigrationReport) {
	log.Println()
	log.Println("=== Migration Report ===")
	log.Printf("Source Table: %s", report.SourceTable)
	log.Printf("Destination Table: %s", report.DestinationTable)
	log.Printf("Start Time: %s", report.StartTime.Format(time.RFC3339))
	log.Printf("End Time: %s", report.EndTime.Format(time.RFC3339))
	log.Printf("Duration: %s", report.Duration)
	log.Println()
	log.Printf("Total Records: %d", report.TotalRecords)
	log.Printf("Successfully Migrated: %d", report.SuccessCount)
	log.Printf("Skipped (Already Exists): %d", report.SkippedCount)
	log.Printf("Failed: %d", report.FailureCount)
	log.Println()

	if len(report.FailedRecords) > 0 {
		log.Println("Failed Records:")
		for _, fr := range report.FailedRecords {
			log.Printf("  - ID: %s, User: %s, Reason: %s", fr.ID, fr.UserID, fr.Reason)
		}
		log.Println()
	}

	successRate := float64(report.SuccessCount) / float64(report.TotalRecords) * 100
	log.Printf("Success Rate: %.2f%%", successRate)
}

func saveReport(report *MigrationReport, filename string) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal report: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write report file: %w", err)
	}

	return nil
}
