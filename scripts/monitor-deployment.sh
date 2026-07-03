#!/bin/bash

# Monitor GitHub Actions deployment status

echo "🔍 监控部署状态..."
echo ""

MAX_WAIT=600  # 最多等待10分钟
INTERVAL=30   # 每30秒检查一次
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    echo "⏱️  已等待: ${ELAPSED}秒 / ${MAX_WAIT}秒"
    
    # 检查最新的workflow状态
    STATUS=$(gh run list --repo ScientificInternet/Google-Monetize --limit 1 --json status,conclusion --jq '.[0]')
    
    if [ -z "$STATUS" ]; then
        echo "❌ 无法获取workflow状态"
        exit 1
    fi
    
    WORKFLOW_STATUS=$(echo "$STATUS" | jq -r '.status')
    WORKFLOW_CONCLUSION=$(echo "$STATUS" | jq -r '.conclusion')
    
    echo "📊 Workflow状态: $WORKFLOW_STATUS"
    
    if [ "$WORKFLOW_STATUS" = "completed" ]; then
        echo ""
        if [ "$WORKFLOW_CONCLUSION" = "success" ]; then
            echo "✅ 部署成功！"
            echo ""
            
            # 检查Cloud Run服务
            echo "🔍 检查Cloud Run服务状态..."
            gcloud run services describe siterank-preview \
                --region=asia-northeast1 \
                --project=${GCP_PROJECT_ID} \
                --format="table(status.url,status.latestReadyRevisionName,status.conditions[0].status)"
            
            echo ""
            echo "🎉 部署完成！"
            exit 0
        else
            echo "❌ 部署失败！"
            echo "Conclusion: $WORKFLOW_CONCLUSION"
            echo ""
            echo "查看详细日志:"
            echo "https://github.com/ScientificInternet/Google-Monetize/actions"
            exit 1
        fi
    fi
    
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
    echo ""
done

echo "⏰ 超时：部署时间超过${MAX_WAIT}秒"
echo "请手动检查: https://github.com/ScientificInternet/Google-Monetize/actions"
exit 1
