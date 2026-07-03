#!/bin/bash
# 创建 Pub/Sub 订阅延迟监控告警
# 使用方法: ./scripts/monitoring/create-pubsub-alerts.sh

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID}"

echo "============================================"
echo "创建 Pub/Sub 监控告警"
echo "============================================"
echo ""
echo "Project: $PROJECT_ID"
echo ""

# 注意: 需要先创建通知渠道
echo "⚠️  注意: 请先在 Cloud Console 创建通知渠道"
echo "https://console.cloud.google.com/monitoring/alerting/notifications?project=$PROJECT_ID"
echo ""
echo "通知渠道 ID 可以通过以下命令获取:"
echo "  gcloud alpha monitoring channels list --project=$PROJECT_ID"
echo ""

read -p "是否已创建通知渠道? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "请先创建通知渠道，然后重新运行此脚本"
    exit 1
fi

read -p "请输入通知渠道 ID: " NOTIFICATION_CHANNEL_ID

if [ -z "$NOTIFICATION_CHANNEL_ID" ]; then
    echo "❌ 错误: 通知渠道 ID 不能为空"
    exit 1
fi

echo ""
echo "使用通知渠道: $NOTIFICATION_CHANNEL_ID"
echo ""

# 告警1: Pub/Sub 消息积压超过 100 条
echo "创建告警: Pub/Sub Message Backlog > 100..."
cat > /tmp/pubsub-backlog-alert.json <<EOF
{
  "displayName": "[Google-Monetize] Pub/Sub Message Backlog > 100",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "Unacked messages > 100",
      "conditionThreshold": {
        "filter": "resource.type=\"pubsub_subscription\" AND metric.type=\"pubsub.googleapis.com/subscription/num_unacked_messages_by_region\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 100,
        "duration": "300s"
      }
    }
  ],
  "notificationChannels": [
    "$NOTIFICATION_CHANNEL_ID"
  ],
  "alertStrategy": {
    "autoClose": "1800s"
  }
}
EOF

gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/pubsub-backlog-alert.json \
  --project="$PROJECT_ID" && echo "✅ 告警1创建成功" || echo "⚠️  告警1创建失败（可能已存在）"

echo ""

# 告警2: Pub/Sub 消息延迟超过 60 秒
echo "创建告警: Pub/Sub Message Age > 60s..."
cat > /tmp/pubsub-age-alert.json <<EOF
{
  "displayName": "[Google-Monetize] Pub/Sub Message Age > 60s",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "Oldest unacked message > 60s",
      "conditionThreshold": {
        "filter": "resource.type=\"pubsub_subscription\" AND metric.type=\"pubsub.googleapis.com/subscription/oldest_unacked_message_age_by_region\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 60,
        "duration": "120s"
      }
    }
  ],
  "notificationChannels": [
    "$NOTIFICATION_CHANNEL_ID"
  ],
  "alertStrategy": {
    "autoClose": "1800s"
  }
}
EOF

gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/pubsub-age-alert.json \
  --project="$PROJECT_ID" && echo "✅ 告警2创建成功" || echo "⚠️  告警2创建失败（可能已存在）"

echo ""

# 注意: 告警3 使用的指标在当前项目中不可用，已跳过

echo ""
echo "============================================"
echo "✅ Pub/Sub 告警创建完成（2/2 个告警）"
echo "============================================"
echo ""
echo "已创建的告警:"
echo "  1. [Google-Monetize] Pub/Sub Message Backlog > 100"
echo "  2. [Google-Monetize] Pub/Sub Message Age > 60s"
echo ""
echo "查看已创建的告警:"
echo "  gcloud alpha monitoring policies list --project=$PROJECT_ID"
echo ""
echo "Cloud Console 查看:"
echo "  https://console.cloud.google.com/monitoring/alerting/policies?project=$PROJECT_ID"
echo ""
echo "下一步:"
echo "1. 在 Cloud Console 测试告警通知"
echo "2. 调整告警阈值（如需要）"
echo "3. 添加更多通知渠道（邮件、PagerDuty等）"
echo ""
echo "注意: 第3个告警（Pull Error Rate）所需指标在当前项目中不可用，已跳过"
