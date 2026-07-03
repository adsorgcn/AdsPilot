#!/bin/bash
# Query Supabase database structure using REST API
set -e

# Load credentials
PROJECT_URL=$(cat secrets/supabase-credentials.json | grep project_url | cut -d'"' -f4)
SERVICE_ROLE_KEY=$(cat secrets/supabase-credentials.json | grep service_role_key | cut -d'"' -f4)

echo "==============================================="
echo "🔍 Querying Supabase Database Structure via REST API"
echo "==============================================="
echo "Project URL: $PROJECT_URL"
echo ""

# Function to query table
query_table() {
    local table=$1
    echo -n "Checking table: $table ... "

    response=$(curl -s -w "\n%{http_code}" \
        -H "apikey: $SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
        "$PROJECT_URL/rest/v1/$table?select=*&limit=1")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        echo "✅ EXISTS"

        # Get column names
        if [ "$body" != "[]" ]; then
            echo "   Sample data: $body" | head -c 200
            echo ""
        else
            echo "   (empty table)"
        fi
    elif [ "$http_code" = "404" ]; then
        echo "❌ NOT FOUND"
    else
        echo "⚠️  HTTP $http_code"
    fi
}

echo "==================== Auth Schema Tables ===================="
echo "Checking auth.users (via Auth API):"
curl -s -H "apikey: $SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
     "$PROJECT_URL/auth/v1/admin/users?per_page=1" | head -c 200
echo ""
echo ""

echo "==================== Public Schema Tables ===================="
# Check common Supabase tables
common_tables=(
    "users"
    "user_profiles"
    "offers"
    "subscriptions"
    "token_balances"
    "tasks"
    "activities"
    "notifications"
    "feature_flags"
    "admin_recovery_codes"
    "supabase_config"
    "billing_config"
    "system_metadata"
)

for table in "${common_tables[@]}"; do
    query_table "$table"
done

echo ""
echo "==================== OpenAPI Schema Discovery ===================="
echo "Fetching OpenAPI schema to discover all available tables..."
curl -s -H "Accept: application/openapi+json" \
     "$PROJECT_URL/rest/v1/?apikey=$SERVICE_ROLE_KEY" | \
     python3 -c "
import sys, json
try:
    schema = json.load(sys.stdin)
    if 'paths' in schema:
        tables = set()
        for path in schema['paths'].keys():
            if path.startswith('/'):
                table = path.strip('/')
                if table and '?' not in table:
                    tables.add(table)
        print('\n📋 Discovered tables from OpenAPI:')
        for table in sorted(tables):
            print(f'  - {table}')
        print(f'\nTotal: {len(tables)} tables')
    else:
        print('⚠️  No paths found in OpenAPI schema')
except Exception as e:
    print(f'❌ Error parsing OpenAPI schema: {e}')
" || echo "⚠️  OpenAPI schema parsing failed"

echo ""
echo "✅ Query complete!"
