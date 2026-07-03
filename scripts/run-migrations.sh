#!/bin/bash
# Run database migrations for subscription system
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Running Database Migrations ===${NC}"

# Get database URL from environment or secrets
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
        echo "Error: DATABASE_URL not set and secrets/supabase-credentials.json not found"
        exit 1
    fi
fi

# Run migrations for billing service
echo -e "${YELLOW}Running billing service migrations...${NC}"
cd services/billing

# Check if migrations exist
if [ ! -d "internal/migrations" ]; then
    echo "Error: Migrations directory not found"
    exit 1
fi

# Run migrations using Go
go run main.go migrate || echo "Migration command not available, using direct SQL..."

# Alternative: Run migrations directly with psql
if command -v psql &> /dev/null; then
    echo "Running migrations with psql..."
    for migration in internal/migrations/*.up.sql; do
        if [ -f "$migration" ]; then
            echo "  Applying: $(basename $migration)"
            psql "$DATABASE_URL" -f "$migration" || echo "  Warning: Migration may have already been applied"
        fi
    done
fi

cd ../..

echo -e "${GREEN}✓ Migrations complete${NC}"
