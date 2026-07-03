#!/bin/bash

# Monitor all services deployment status

echo "🔍 监控所有服务部署状态..."
echo ""

MAX_WAIT=1800  # 最多等待30分钟
INTERVAL=60    # 每60秒检查一次
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    echo "⏱️  已等待: ${ELAPSED}秒 / ${MAX_WAIT}秒"
    echo ""
    
    # 检查最新的两个workflow状态（Backend和Frontend）
    WORKFLOWS=$(gh run list --repo ScientificInternet/Google-Monetize --limit 2 --json status,conclusion,name --jq '.[]')
    
    if [ -z "$WORKFLOWS" ]; then
        echo "❌ 无法获取workflow状态"
        exit 1
    fi
    
    BACKEND_STATUS=$(echo "$WORKFLOWS" | jq -r 'select(.name | contains("Backend")) | .status' | head -1)
    BACKEND_CONCLUSION=$(echo "$WORKFLOWS" | jq -r 'select(.name | contains("Backend")) | .conclusion' | head -1)
    
    FRONTEND_STATUS=$(echo "$WORKFLOWS" | jq -r 'select(.name | contains("Frontend")) | .status' | head -1)
    FRONTEND_CONCLUSION=$(echo "$WORKFLOWS" | jq -r 'select(.name | contains("Frontend")) | .conclusion' | head -1)
    
    echo "📊 Backend Workflow: $BACKEND_STATUS"
    echo "📊 Frontend Workflow: $FRONTEND_STATUS"
    echo ""
    
    # 检查是否都完成
    BOTH_COMPLETED=0
    if [ "$BACKEND_STATUS" = "completed" ] && [ "$FRONTEND_STATUS" = "completed" ]; then
        BOTH_COMPLETED=1
    fi
    
    if [ $BOTH_COMPLETED -eq 1 ]; then
        echo ""
        echo "✅ 所有workflow已完成！"
        echo ""
        
        # 检查结果
        if [ "$BACKEND_CONCLUSION" = "success" ] && [ "$FRONTEND_CONCLUSION" = "success" ]; then
            echo "🎉 所有服务部署成功！"
            echo ""
            echo "Backend: ✅ $BACKEND_CONCLUSION"
            echo "Frontend: ✅ $FRONTEND_CONCLUSION"
            echo ""
            
            # 显示所有服务状态
            echo "🔍 检查所有Cloud Run服务状态..."
            gcloud run services list \
                --region=asia-northeast1 \
                --project=${GCP_PROJECT_ID} \
                --format="table(metadata.name,status.latestReadyRevisionName,status.conditions[0].status)" \
                --filter="metadata.name:preview"
            
            exit 0
        else
            echo "❌ 部分服务部署失败！"
            echo ""
            echo "Backend: $BACKEND_CONCLUSION"
            echo "Frontend: $FRONTEND_CONCLUSION"
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
