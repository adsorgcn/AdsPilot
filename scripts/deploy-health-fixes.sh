#!/bin/bash
# 部署健康检查端点修复到预发环境

set -e

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"

echo "🚀 开始部署健康检查端点修复..."
echo ""

# 函数：部署单个服务
deploy_service() {
    local service=$1
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 部署 $service-preview..."

    gcloud run deploy "$service-preview" \
        --source="./services/$service" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --platform=managed \
        --allow-unauthenticated \
        --quiet

    if [ $? -eq 0 ]; then
        echo "✅ $service-preview 部署成功"
    else
        echo "❌ $service-preview 部署失败"
        return 1
    fi
    echo ""
}

# 部署3个修复的服务
deploy_service "siterank"
deploy_service "recommendations"
deploy_service "billing"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 所有服务部署完成！"
echo ""
echo "验证健康检查端点："
echo "  curl https://siterank-preview-yt54xvsg5q-an.a.run.app/health"
echo "  curl https://recommendations-preview-yt54xvsg5q-an.a.run.app/health"
echo "  curl https://billing-preview-yt54xvsg5q-an.a.run.app/health"
echo ""
