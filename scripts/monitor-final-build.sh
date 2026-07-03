#!/bin/bash
set -euo pipefail

echo "🔍 监控最终构建状态 (Build #6)"
echo "Commit: c3172b5f"
echo "时间: $(date)"
echo ""

REPO="ScientificInternet/Google-Monetize"
CHECK_INTERVAL=30
MAX_CHECKS=60  # 30分钟

check_count=0

while [ $check_count -lt $MAX_CHECKS ]; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "检查 #$((check_count + 1)) - $(date +%H:%M:%S)"
  echo ""
  
  # 获取最新的workflows
  workflows=$(gh run list --repo "$REPO" --limit 5 --json status,conclusion,name,createdAt,headSha \
    --jq '.[] | select(.headSha | startswith("c3172b5f")) | {name, status, conclusion}')
  
  if [ -z "$workflows" ]; then
    echo "⏳ 等待workflows启动..."
  else
    echo "$workflows" | jq -r '. | "[\(.status)] \(.name) - \(.conclusion // "进行中")"'
    
    # 检查是否所有workflows都完成
    in_progress=$(echo "$workflows" | jq -r 'select(.status == "in_progress") | .name' | wc -l)
    
    if [ "$in_progress" -eq 0 ]; then
      echo ""
      echo "✅ 所有workflows已完成！"
      echo ""
      
      # 显示最终结果
      echo "📊 最终结果:"
      echo "$workflows" | jq -r '. | "  \(.name): \(.conclusion)"'
      
      # 检查是否有失败
      failures=$(echo "$workflows" | jq -r 'select(.conclusion == "failure") | .name' | wc -l)
      
      if [ "$failures" -eq 0 ]; then
        echo ""
        echo "🎉 所有构建成功！"
        exit 0
      else
        echo ""
        echo "❌ 有 $failures 个workflow失败"
        echo ""
        echo "失败的workflows:"
        echo "$workflows" | jq -r 'select(.conclusion == "failure") | "  - \(.name)"'
        exit 1
      fi
    fi
  fi
  
  echo ""
  echo "⏳ 等待 ${CHECK_INTERVAL}秒后再次检查..."
  sleep $CHECK_INTERVAL
  check_count=$((check_count + 1))
done

echo ""
echo "⏰ 超时：已等待30分钟"
echo "请手动检查构建状态: https://github.com/$REPO/actions"
exit 1
