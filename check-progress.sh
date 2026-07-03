#!/bin/bash
echo "=== 400 URL 批量测试进度 ==="
echo "开始时间: 2025-10-02 14:09"
echo "当前时间: $(date '+%H:%M:%S')"
echo ""

# 获取所有处理完成的日志
LOGS=$(gcloud logging read \
  "resource.labels.service_name=browser-exec-preview-worker AND timestamp>='2025-10-02T14:09:00Z'" \
  --limit 500 \
  --format "value(textPayload)" \
  --project ${GCP_PROJECT_ID} 2>&1)

TOTAL=$(echo "$LOGS" | grep -c "processed successfully")
SUCCESS=$(echo "$LOGS" | grep -c "URL访问成功")
FAILED=$(echo "$LOGS" | grep -c "URL访问失败")

echo "📊 处理统计:"
echo "  总处理: $TOTAL / 400"
echo "  成功: $SUCCESS"
echo "  失败: $FAILED"
echo ""

PROGRESS=$(echo "scale=1; $TOTAL * 100 / 400" | bc)
echo "  进度: ${PROGRESS}%"
echo ""

if [ $TOTAL -gt 0 ]; then
  ELAPSED=$(($(date +%s) - $(date -j -f "%Y-%m-%d %H:%M" "2025-10-02 14:09" +%s)))
  RATE=$(echo "scale=2; $TOTAL * 60 / $ELAPSED" | bc)
  REMAINING=$((400 - TOTAL))
  ETA=$(echo "scale=0; $REMAINING / $RATE" | bc)
  
  echo "⏱️  速度统计:"
  echo "  已耗时: $((ELAPSED / 60)) 分钟"
  echo "  处理速率: ${RATE} 任务/分钟"
  echo "  预计剩余: ${ETA} 分钟"
fi
