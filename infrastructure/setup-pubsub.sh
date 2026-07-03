#!/bin/bash

# INFRA-003: 配置 Pub/Sub Topics and Subscriptions
# Google-Monetize Pub/Sub 配置脚本

set -e

echo "📨 Google-Monetize Pub/Sub 配置"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查是否已登录 GCP
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
  echo "❌ 未登录 GCP，请先运行: gcloud auth login"
  exit 1
fi

# 获取当前项目
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "❌ 未设置 GCP 项目，请先运行: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "📋 当前项目: $PROJECT_ID"
echo ""

# 启用 Pub/Sub API
echo "🔧 启用 Pub/Sub API..."
gcloud services enable pubsub.googleapis.com --project=$PROJECT_ID
echo "✅ Pub/Sub API 已启用"
echo ""

# 创建 siterank.evaluate topic
TOPIC_NAME="siterank.evaluate"
echo "📝 检查 Topic: $TOPIC_NAME..."

if gcloud pubsub topics describe $TOPIC_NAME --project=$PROJECT_ID &>/dev/null; then
  echo "✅ Topic '$TOPIC_NAME' 已存在"
else
  echo "📝 创建 Topic: $TOPIC_NAME..."
  gcloud pubsub topics create $TOPIC_NAME \
    --project=$PROJECT_ID \
    --message-retention-duration=7d
  echo "✅ Topic '$TOPIC_NAME' 已创建"
fi
echo ""

# 创建 siterank-evaluate-sub subscription
SUBSCRIPTION_NAME="siterank-evaluate-sub"
echo "📝 检查 Subscription: $SUBSCRIPTION_NAME..."

if gcloud pubsub subscriptions describe $SUBSCRIPTION_NAME --project=$PROJECT_ID &>/dev/null; then
  echo "✅ Subscription '$SUBSCRIPTION_NAME' 已存在"
else
  echo "📝 创建 Subscription: $SUBSCRIPTION_NAME..."
  gcloud pubsub subscriptions create $SUBSCRIPTION_NAME \
    --topic=$TOPIC_NAME \
    --project=$PROJECT_ID \
    --ack-deadline=600 \
    --message-retention-duration=7d \
    --expiration-period=never \
    --min-retry-delay=10s \
    --max-retry-delay=600s
  echo "✅ Subscription '$SUBSCRIPTION_NAME' 已创建"
fi
echo ""

# 配置 Service Account 权限
echo "🔐 配置 Service Account Pub/Sub 权限..."

# Offer service (publisher)
OFFER_SA="offer@${PROJECT_ID}.iam.gserviceaccount.com"
echo "🔓 授予 offer 发布权限..."
gcloud pubsub topics add-iam-policy-binding $TOPIC_NAME \
  --member="serviceAccount:${OFFER_SA}" \
  --role="roles/pubsub.publisher" \
  --project=$PROJECT_ID

echo "✅ offer Service Account 发布权限已授予"
echo ""

# Siterank service (subscriber)
SITERANK_SA="siterank@${PROJECT_ID}.iam.gserviceaccount.com"
echo "🔓 授予 siterank 订阅权限..."
gcloud pubsub subscriptions add-iam-policy-binding $SUBSCRIPTION_NAME \
  --member="serviceAccount:${SITERANK_SA}" \
  --role="roles/pubsub.subscriber" \
  --project=$PROJECT_ID

echo "✅ siterank Service Account 订阅权限已授予"
echo ""

# 测试 Pub/Sub
echo "🧪 测试 Pub/Sub 配置..."
echo "📝 发送测试消息..."

TEST_MESSAGE='{"offerId":"test-123","enableAI":false,"forceRefresh":false}'
MESSAGE_ID=$(gcloud pubsub topics publish $TOPIC_NAME \
  --message="$TEST_MESSAGE" \
  --project=$PROJECT_ID \
  --format="value(messageIds[0])")

if [ -n "$MESSAGE_ID" ]; then
  echo "✅ 测试消息发布成功 (Message ID: $MESSAGE_ID)"
else
  echo "⚠️  测试消息发布失败"
fi
echo ""

# 配置环境变量建议
echo "📋 Services 需要的环境变量:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "# Offer Service (Publisher)"
echo "PUBSUB_TOPIC_EVALUATE=${TOPIC_NAME}"
echo ""
echo "# Siterank Service (Subscriber)"
echo "PUBSUB_SUBSCRIPTION_EVALUATE=${SUBSCRIPTION_NAME}"
echo ""

# 查看订阅统计
echo "📋 Subscription 详情:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
gcloud pubsub subscriptions describe $SUBSCRIPTION_NAME \
  --project=$PROJECT_ID \
  --format="table(name,topic,ackDeadlineSeconds,messageRetentionDuration)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Pub/Sub 配置完成！"
echo ""
echo "📋 配置总结:"
echo "  - Topic: ${TOPIC_NAME}"
echo "  - Subscription: ${SUBSCRIPTION_NAME}"
echo "  - Ack Deadline: 600s (10 minutes)"
echo "  - Message Retention: 7 days"
echo "  - Publisher: offer service"
echo "  - Subscriber: siterank service"
echo ""
echo "🔍 监控 Pub/Sub 消息:"
echo "  gcloud pubsub subscriptions pull $SUBSCRIPTION_NAME \\"
echo "    --limit=10 \\"
echo "    --project=$PROJECT_ID"
echo ""
echo "🔍 查看 Topic 统计:"
echo "  gcloud pubsub topics list --project=$PROJECT_ID"
echo ""
echo "🔍 查看 Subscription 统计:"
echo "  gcloud pubsub subscriptions list --project=$PROJECT_ID"
echo ""
echo "📖 Pub/Sub 文档:"
echo "  https://cloud.google.com/pubsub/docs"
echo ""
