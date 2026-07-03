#!/bin/bash
# Verify trial subscriptions migration
# This script compares data between source and destination tables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Trial Subscriptions Migration Verification ===${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}DATABASE_URL not set, checking secrets...${NC}"
    
    if [ -f "secrets/supabase-credentials.json" ]; then
        DB_HOST=$(jq -r '.host' secrets/supabase-credentials.json)
        DB_NAME=$(jq -r '.database' secrets/supabase-credentials.json)
        DB_USER=$(jq -r '.user' secrets/supabase-credentials.json)
        DB_PASS=$(jq -r '.password' secrets/supabase-credentials.json)
        DB_PORT=$(jq -r '.port // 5432' secrets/supabase-credentials.json)
        
        export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require"
        echo -e "${GREEN}✓ Database URL configured${NC}"
    else
        echo -e "${RED}Error: DATABASE_URL not set${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}Checking table existence...${NC}"

# Check if source table exists (or deprecated version)
SOURCE_TABLE=""
if psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='trial_subscriptions';" | grep -q 1; then
    SOURCE_TABLE="trial_subscriptions"
    echo "  ✓ Found source table: trial_subscriptions"
elif psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='trial_subscriptions_deprecated';" | grep -q 1; then
    SOURCE_TABLE="trial_subscriptions_deprecated"
    echo "  ✓ Found source table: trial_subscriptions_deprecated"
else
    echo -e "${RED}  ✗ Source table not found${NC}"
    exit 1
fi

# Check if destination table exists
if psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='subscriptions';" | grep -q 1; then
    echo "  ✓ Found destination table: subscriptions"
else
    echo -e "${RED}  ✗ Destination table not found${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Comparing record counts...${NC}"

# Count records in source table
SOURCE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM $SOURCE_TABLE;")
echo "  Source table records: $SOURCE_COUNT"

# Count migrated records in destination table (with trial fields)
DEST_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM subscriptions WHERE trial_start_date IS NOT NULL;")
echo "  Destination table records (with trial data): $DEST_COUNT"

if [ "$SOURCE_COUNT" -eq "$DEST_COUNT" ]; then
    echo -e "${GREEN}  ✓ Record counts match${NC}"
else
    echo -e "${YELLOW}  ⚠ Record counts differ (Source: $SOURCE_COUNT, Dest: $DEST_COUNT)${NC}"
    MISSING=$((SOURCE_COUNT - DEST_COUNT))
    echo "  Missing records: $MISSING"
fi

echo ""
echo -e "${YELLOW}Checking data integrity...${NC}"

# Check for duplicate user_ids in destination
DUPLICATES=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM (
        SELECT user_id, COUNT(*) as cnt 
        FROM subscriptions 
        WHERE trial_start_date IS NOT NULL 
        GROUP BY user_id 
        HAVING COUNT(*) > 1
    ) as dups;
")

if [ "$DUPLICATES" -eq 0 ]; then
    echo -e "${GREEN}  ✓ No duplicate user_ids found${NC}"
else
    echo -e "${RED}  ✗ Found $DUPLICATES users with multiple trial subscriptions${NC}"
fi

# Check for NULL required fields
NULL_USER_IDS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM subscriptions WHERE user_id IS NULL AND trial_start_date IS NOT NULL;")
NULL_PLANS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM subscriptions WHERE plan IS NULL AND trial_start_date IS NOT NULL;")
NULL_STATUS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM subscriptions WHERE status IS NULL AND trial_start_date IS NOT NULL;")

if [ "$NULL_USER_IDS" -eq 0 ] && [ "$NULL_PLANS" -eq 0 ] && [ "$NULL_STATUS" -eq 0 ]; then
    echo -e "${GREEN}  ✓ No NULL values in required fields${NC}"
else
    echo -e "${RED}  ✗ Found NULL values:${NC}"
    [ "$NULL_USER_IDS" -gt 0 ] && echo "    - user_id: $NULL_USER_IDS records"
    [ "$NULL_PLANS" -gt 0 ] && echo "    - plan: $NULL_PLANS records"
    [ "$NULL_STATUS" -gt 0 ] && echo "    - status: $NULL_STATUS records"
fi

echo ""
echo -e "${YELLOW}Checking status distribution...${NC}"

# Show status distribution
psql "$DATABASE_URL" -c "
    SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
    FROM subscriptions 
    WHERE trial_start_date IS NOT NULL
    GROUP BY status
    ORDER BY count DESC;
"

echo ""
echo -e "${YELLOW}Checking plan distribution...${NC}"

# Show plan distribution
psql "$DATABASE_URL" -c "
    SELECT 
        plan,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
    FROM subscriptions 
    WHERE trial_start_date IS NOT NULL
    GROUP BY plan
    ORDER BY count DESC;
"

echo ""
echo -e "${YELLOW}Checking trial source distribution...${NC}"

# Show trial source distribution
psql "$DATABASE_URL" -c "
    SELECT 
        trial_source,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
    FROM subscriptions 
    WHERE trial_start_date IS NOT NULL
    GROUP BY trial_source
    ORDER BY count DESC;
"

echo ""
echo -e "${YELLOW}Sample migrated records...${NC}"

# Show sample records
psql "$DATABASE_URL" -c "
    SELECT 
        id,
        user_id,
        plan,
        status,
        trial_start_date,
        trial_end_date,
        trial_source,
        created_at
    FROM subscriptions 
    WHERE trial_start_date IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5;
"

echo ""
echo -e "${GREEN}=== Verification Complete ===${NC}"
echo ""

# Summary
if [ "$SOURCE_COUNT" -eq "$DEST_COUNT" ] && [ "$DUPLICATES" -eq 0 ] && [ "$NULL_USER_IDS" -eq 0 ] && [ "$NULL_PLANS" -eq 0 ] && [ "$NULL_STATUS" -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed - migration appears successful${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some checks failed - please review the results above${NC}"
    exit 1
fi
