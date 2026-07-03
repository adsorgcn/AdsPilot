#!/bin/bash
# Analyze Supabase RPC functions
set -e

PROJECT_URL=$(cat secrets/supabase-credentials.json | grep project_url | cut -d'"' -f4)
SERVICE_ROLE_KEY=$(cat secrets/supabase-credentials.json | grep service_role_key | cut -d'"' -f4)

echo "==============================================="
echo "🔍 Analyzing Supabase RPC Functions"
echo "==============================================="
echo ""

# Function to query RPC
query_rpc() {
    local func_name=$1
    local params=$2
    echo "==================== $func_name ===================="

    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "apikey: $SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d "$params" \
        "$PROJECT_URL/rest/v1/rpc/$func_name")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    echo "HTTP Code: $http_code"
    echo "Response: $body" | head -c 500
    echo ""
    echo ""
}

# Query each RPC function with minimal parameters
query_rpc "user_has_permission" '{"user_id":"00000000-0000-0000-0000-000000000000","permission":"read"}'
query_rpc "get_user_complete_info_optimized" '{"p_user_id":"00000000-0000-0000-0000-000000000000"}'
query_rpc "calculate_user_stats" '{}'
query_rpc "check_data_consistency" '{}'
query_rpc "cleanup_old_logs" '{}'
query_rpc "cleanup_expired_recovery_codes" '{}'
query_rpc "collect_database_metrics" '{}'
query_rpc "get_subscription_history" '{"p_user_id":"00000000-0000-0000-0000-000000000000"}'
query_rpc "get_token_balance_history" '{"p_user_id":"00000000-0000-0000-0000-000000000000"}'
query_rpc "check_and_create_alerts" '{}'

echo "✅ Analysis complete!"
