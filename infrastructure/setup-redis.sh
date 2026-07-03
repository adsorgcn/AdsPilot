#!/bin/bash

# INFRA-004: 配置 Cloud Memorystore for Redis
# Google-Monetize Redis 缓存配置脚本

set -e

echo "🔴 Google-Monetize Redis 配置"
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

# 启用 Redis API
echo "🔧 启用 Redis API..."
gcloud services enable redis.googleapis.com --project=$PROJECT_ID
gcloud services enable vpcaccess.googleapis.com --project=$PROJECT_ID
echo "✅ Redis API 已启用"
echo ""

# 配置参数
REDIS_INSTANCE="gm-redis"
REGION="asia-northeast1"
TIER="basic"
MEMORY_SIZE_GB=1
REDIS_VERSION="redis_7_0"
VPC_CONNECTOR="cr-conn-default-ane1"

# 检查 Redis 实例是否已存在
echo "🔍 检查 Redis 实例: $REDIS_INSTANCE..."
if gcloud redis instances describe $REDIS_INSTANCE --region=$REGION --project=$PROJECT_ID &>/dev/null; then
  echo "✅ Redis 实例 '$REDIS_INSTANCE' 已存在"

  # 获取实例信息
  REDIS_HOST=$(gcloud redis instances describe $REDIS_INSTANCE \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(host)")

  REDIS_PORT=$(gcloud redis instances describe $REDIS_INSTANCE \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(port)")

  echo "📍 Redis Host: $REDIS_HOST"
  echo "📍 Redis Port: $REDIS_PORT"
else
  echo "📝 创建 Redis 实例..."
  echo "⚠️  注意：实例创建需要 5-10 分钟"

  gcloud redis instances create $REDIS_INSTANCE \
    --region=$REGION \
    --tier=$TIER \
    --size=$MEMORY_SIZE_GB \
    --redis-version=$REDIS_VERSION \
    --project=$PROJECT_ID

  echo "✅ Redis 实例创建完成"

  # 获取实例信息
  REDIS_HOST=$(gcloud redis instances describe $REDIS_INSTANCE \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(host)")

  REDIS_PORT=$(gcloud redis instances describe $REDIS_INSTANCE \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(port)")

  echo "📍 Redis Host: $REDIS_HOST"
  echo "📍 Redis Port: $REDIS_PORT"
fi
echo ""

# 将 Redis URL 添加到 Secret Manager
echo "🔐 更新 Secret Manager..."
REDIS_URL="${REDIS_HOST}:${REDIS_PORT}"

if gcloud secrets describe redis-url --project=$PROJECT_ID &>/dev/null; then
  echo "⚠️  Secret 'redis-url' 已存在，正在添加新版本..."
  echo -n "$REDIS_URL" | gcloud secrets versions add redis-url \
    --data-file=- \
    --project=$PROJECT_ID
else
  echo "📝 创建新 Secret 'redis-url'..."
  echo -n "$REDIS_URL" | gcloud secrets create redis-url \
    --data-file=- \
    --replication-policy="automatic" \
    --project=$PROJECT_ID
fi

echo "✅ Redis URL 已保存到 Secret Manager"
echo ""

# 配置服务账号访问权限
echo "🔐 配置 Service Account 访问权限..."

BACKEND_SERVICES=("offer" "billing" "useractivity" "console" "adscenter" "bff" "siterank" "browser-exec")

for service in "${BACKEND_SERVICES[@]}"; do
  SERVICE_SA="${service}@${PROJECT_ID}.iam.gserviceaccount.com"

  # 授予 redis-url secret 访问权限
  gcloud secrets add-iam-policy-binding redis-url \
    --member="serviceAccount:${SERVICE_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID 2>/dev/null || true

  echo "✅ ${service} Service Account 已授权"
done

echo ""

# 配置环境变量建议
echo "📋 Services 需要的环境变量:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "REDIS_URL=${REDIS_URL}"
echo ""
echo "# 或从 Secret Manager 读取:"
echo "REDIS_URL=\$(gcloud secrets versions access latest --secret=redis-url --project=$PROJECT_ID)"
echo ""

# Cloud Run 部署命令示例
echo "📋 Cloud Run 部署命令示例 (使用 VPC Connector):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat <<EOF
gcloud run deploy {service-name} \\
  --image asia-northeast1-docker.pkg.dev/${PROJECT_ID}/gm-services/{service}:latest \\
  --platform managed \\
  --region ${REGION} \\
  --vpc-connector ${VPC_CONNECTOR} \\
  --vpc-egress all-traffic \\
  --update-secrets REDIS_URL=redis-url:latest \\
  --service-account codex-dev@${PROJECT_ID}.iam.gserviceaccount.com \\
  --no-allow-unauthenticated
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Redis 配置完成！"
echo ""
echo "📋 配置总结:"
echo "  - Redis 实例: ${REDIS_INSTANCE}"
echo "  - 区域: ${REGION}"
echo "  - 层级: ${TIER}"
echo "  - 内存: ${MEMORY_SIZE_GB}GB"
echo "  - 版本: ${REDIS_VERSION}"
echo "  - Host: ${REDIS_HOST}"
echo "  - Port: ${REDIS_PORT}"
echo "  - VPC Connector: ${VPC_CONNECTOR}"
echo ""
echo "🔍 查看 Redis 实例列表:"
echo "  gcloud redis instances list --region=$REGION --project=$PROJECT_ID"
echo ""
echo "🔍 查看 Redis 实例详情:"
echo "  gcloud redis instances describe $REDIS_INSTANCE --region=$REGION --project=$PROJECT_ID"
echo ""
echo "🧪 测试 Redis 连接（从 Cloud Shell）:"
echo "  redis-cli -h $REDIS_HOST -p $REDIS_PORT PING"
echo ""
echo "📖 Cloud Memorystore 文档:"
echo "  https://cloud.google.com/memorystore/docs/redis"
echo ""
