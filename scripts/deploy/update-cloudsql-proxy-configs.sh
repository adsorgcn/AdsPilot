#!/bin/bash
# 批量更新所有服务的Cloud Run配置，添加Cloud SQL Proxy支持
# 基于 docs/Database/DATABASE_MIGRATION_BEST_PRACTICES.md

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
CLOUDSQL_INSTANCE="${PROJECT_ID}:${REGION}:gm"

# 需要数据库连接的服务列表
SERVICES_WITH_DB=(
    "billing"
    "offer"
    "siterank"
    "adscenter"
    "useractivity"
    "console"
    "bff"
    "gateway-middleware"
    "projector"
    "recommendations"
    "batchopen"
)

echo "🔧 Updating Cloud Run services to use Cloud SQL Proxy..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Cloud SQL Instance: $CLOUDSQL_INSTANCE"
echo ""

# 函数：更新单个服务
update_service() {
    local service_name=$1
    local env=$2  # preview or production
    
    local full_service_name="${service_name}-${env}"
    
    echo "📦 Updating service: $full_service_name"
    
    # 检查服务是否存在
    if ! gcloud run services describe "$full_service_name" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(metadata.name)" &>/dev/null; then
        echo "⚠️  Service $full_service_name not found, skipping..."
        return 0
    fi
    
    # 更新服务配置
    gcloud run services update "$full_service_name" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --add-cloudsql-instances="$CLOUDSQL_INSTANCE" \
        --set-env-vars="DB_CONNECTION_MODE=cloudsql" \
        --update-secrets="DATABASE_URL=DATABASE_URL:latest" \
        --clear-vpc-connector \
        --quiet
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully updated $full_service_name"
    else
        echo "❌ Failed to update $full_service_name"
        return 1
    fi
    
    echo ""
}

# 主执行逻辑
main() {
    local env="${1:-preview}"  # 默认preview环境
    
    if [[ "$env" != "preview" && "$env" != "production" ]]; then
        echo "❌ Invalid environment: $env"
        echo "Usage: $0 [preview|production]"
        exit 1
    fi
    
    echo "🚀 Starting batch update for $env environment..."
    echo ""
    
    local success_count=0
    local skip_count=0
    local fail_count=0
    
    for service in "${SERVICES_WITH_DB[@]}"; do
        if update_service "$service" "$env"; then
            ((success_count++))
        else
            ((fail_count++))
        fi
    done
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Update Summary:"
    echo "  Environment: $env"
    echo "  Total services: ${#SERVICES_WITH_DB[@]}"
    echo "  ✅ Successfully updated: $success_count"
    echo "  ❌ Failed: $fail_count"
    echo "  ⚠️  Skipped: $skip_count"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ $fail_count -gt 0 ]; then
        echo ""
        echo "⚠️  Some services failed to update. Please check the logs above."
        exit 1
    fi
    
    echo ""
    echo "✅ All services updated successfully!"
    echo ""
    echo "🔍 Next steps:"
    echo "  1. Verify services are running: gcloud run services list --region=$REGION"
    echo "  2. Check service logs for database connection"
    echo "  3. Test API endpoints"
}

# 执行主函数
main "$@"
