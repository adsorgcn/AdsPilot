#!/bin/bash
# Execute trial subscriptions data migration
# This script migrates data from useractivity.trial_subscriptions to billing.subscriptions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Trial Subscriptions Data Migration ===${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}DATABASE_URL not set, checking secrets...${NC}"
    
    if [ -f "secrets/supabase-credentials.json" ]; then
        # Extract connection string from Supabase credentials
        DB_HOST=$(jq -r '.host' secrets/supabase-credentials.json)
        DB_NAME=$(jq -r '.database' secrets/supabase-credentials.json)
        DB_USER=$(jq -r '.user' secrets/supabase-credentials.json)
        DB_PASS=$(jq -r '.password' secrets/supabase-credentials.json)
        DB_PORT=$(jq -r '.port // 5432' secrets/supabase-credentials.json)
        
        export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"
        echo -e "${GREEN}✓ Database URL configured from secrets${NC}"
    else
        echo -e "${RED}Error: DATABASE_URL not set and secrets/supabase-credentials.json not found${NC}"
        echo "Please set DATABASE_URL environment variable or create secrets file"
        exit 1
    fi
fi

# Confirm before proceeding
echo -e "${YELLOW}This script will migrate trial_subscriptions data to the subscriptions table.${NC}"
echo ""
echo "Source table: trial_subscriptions"
echo "Destination table: subscriptions"
echo ""
read -p "Do you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled"
    exit 0
fi

echo ""
echo -e "${YELLOW}Step 1: Creating backup of trial_subscriptions table...${NC}"

# Create backup table
BACKUP_TABLE="trial_subscriptions_backup_$(date +%Y%m%d_%H%M%S)"
psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS $BACKUP_TABLE AS SELECT * FROM trial_subscriptions;" || {
    echo -e "${RED}Failed to create backup table${NC}"
    exit 1
}

echo -e "${GREEN}✓ Backup created: $BACKUP_TABLE${NC}"

# Count records
RECORD_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM trial_subscriptions;")
echo "Total records to migrate: $RECORD_COUNT"
echo ""

echo -e "${YELLOW}Step 2: Running migration script...${NC}"

# Run Go migration script
cd scripts
go run migrate-trial-subscriptions.go

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Migration completed successfully${NC}"
    
    # Ask if user wants to rename the old table
    echo ""
    read -p "Do you want to rename trial_subscriptions to trial_subscriptions_deprecated? (yes/no): " rename_confirm
    
    if [ "$rename_confirm" = "yes" ]; then
        echo -e "${YELLOW}Step 3: Renaming trial_subscriptions table...${NC}"
        psql "$DATABASE_URL" -c "ALTER TABLE trial_subscriptions RENAME TO trial_subscriptions_deprecated;" || {
            echo -e "${RED}Failed to rename table${NC}"
            exit 1
        }
        echo -e "${GREEN}✓ Table renamed to trial_subscriptions_deprecated${NC}"
    else
        echo "Skipping table rename"
    fi
    
    echo ""
    echo -e "${GREEN}=== Migration Complete ===${NC}"
    echo ""
    echo "Summary:"
    echo "  - Backup table: $BACKUP_TABLE"
    echo "  - Migration report: migration-report-*.json"
    echo ""
    echo "Next steps:"
    echo "  1. Verify data integrity in subscriptions table"
    echo "  2. Test trial subscription functionality"
    echo "  3. Update useractivity service to remove trial subscription code"
    echo "  4. Deploy updated services"
    
else
    echo ""
    echo -e "${RED}✗ Migration failed${NC}"
    echo ""
    echo "The backup table $BACKUP_TABLE has been preserved"
    echo "Please check the error messages above and the migration report"
    exit 1
fi
