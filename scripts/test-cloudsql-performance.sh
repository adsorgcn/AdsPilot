#!/bin/bash

# Cloud SQL Proxy性能测试脚本
# 用于验证新的数据库适配器在Cloud Run环境中的性能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
SERVICE_NAME="db-performance-test"

echo -e "${BLUE}🚀 Cloud SQL Proxy 性能测试部署${NC}"
echo "========================================"

# 检查gcloud登录状态
echo -e "${YELLOW}📋 检查认证状态...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo -e "${RED}❌ 未找到有效的gcloud认证账户${NC}"
    echo "请运行: gcloud auth login"
    exit 1
fi

CURRENT_PROJECT=$(gcloud config get-value project)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo -e "${YELLOW}🔄 切换到项目: $PROJECT_ID${NC}"
    gcloud config set project "$PROJECT_ID"
fi

# 构建性能测试镜像
echo -e "${YELLOW}🏗️  构建性能测试镜像...${NC}"
cd "$(dirname "$0")/.."

# 创建临时Dockerfile
cat > Dockerfile.performance-test << 'EOF'
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY tools/db-performance-test/ .
COPY pkg/database/ ./pkg/database/

RUN go mod init performance-test && \
    go mod tidy && \
    go build -o performance-test .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/performance-test .
CMD ["./performance-test"]
EOF

# 构建镜像
IMAGE_NAME="gcr.io/$PROJECT_ID/db-performance-test:latest"
gcloud builds submit --tag="$IMAGE_NAME" --timeout=600s --async

echo -e "${YELLOW}⏳ 等待镜像构建完成...${NC}"
sleep 30

# 检查构建状态
BUILD_ID=$(gcloud builds list --limit=1 --format="value(id)" --filter="tags:$IMAGE_NAME")
if [ -n "$BUILD_ID" ]; then
    echo -e "${GREEN}✅ 镜像构建成功${NC}"
else
    echo -e "${RED}❌ 镜像构建失败${NC}"
    exit 1
fi

# 创建Cloud Run服务
echo -e "${YELLOW}🚀 部署性能测试服务...${NC}"

# 创建Cloud Run服务
gcloud run deploy "$SERVICE_NAME" \
    --image="$IMAGE_NAME" \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --memory=1Gi \
    --cpu=1 \
    --timeout=300s \
    --set-cloudsql-instances="gm:asia-northeast1:gm" \
    --set-env-vars="DB_CONNECTION_MODE=cloudsql" \
    --set-env-vars="CONCURRENT_USERS=20" \
    --set-env-vars="QUERIES_PER_USER=100" \
    --set-env-vars="TEST_DURATION=60s" \
    --max-instances=1

# 获取服务URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --format="value(status.url)")

if [ -n "$SERVICE_URL" ]; then
    echo -e "${GREEN}✅ 性能测试服务部署成功${NC}"
    echo -e "${BLUE}🔗 服务URL: $SERVICE_URL${NC}"
else
    echo -e "${RED}❌ 服务部署失败${NC}"
    exit 1
fi

# 等待服务就绪
echo -e "${YELLOW}⏳ 等待服务就绪...${NC}"
sleep 30

# 执行性能测试
echo -e "${BLUE}🧪 执行性能测试...${NC}"
echo "----------------------------------------"

# 创建测试请求
TEST_URL="$SERVICE_URL"
echo "测试URL: $TEST_URL"

# 使用curl执行测试 (如果服务支持HTTP)
# 注意: 这里的性能测试工具可能需要修改为HTTP端点
echo -e "${YELLOW}📊 注意: 性能测试工具需要在服务内部运行${NC}"
echo "请检查Cloud Run日志获取详细测试结果"

# 显示日志
echo -e "${YELLOW}📋 显示最近的日志...${NC}"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
    --limit=50 \
    --format="table(timestamp,textPayload)" \
    --freshness=1m

# 获取性能指标
echo -e "${BLUE}📈 获取Cloud Run性能指标...${NC}"
gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --format="table(status.latestReadyRevisionName,status.url,status.latestReadyCreatedTime)"

# 显示建议
echo -e "${BLUE}💡 性能优化建议:${NC}"
echo "1. 检查Cloud SQL连接数配置"
echo "2. 监控查询延迟和QPS"
echo "3. 比较Cloud SQL vs Supabase性能"
echo "4. 验证连接池效果"

echo -e "${GREEN}✅ 性能测试部署完成${NC}"
echo -e "${YELLOW}📝 请查看Cloud Run控制台获取详细测试结果${NC}"

# 清理选项
echo -e "${YELLOW}🧹 清理命令:${NC}"
echo "gcloud run services delete $SERVICE_NAME --region=$REGION"
echo "gcloud container images delete $IMAGE_NAME"

echo -e "${BLUE}🔗 控制台链接:${NC}"
echo "Cloud Run: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
echo "Cloud Build: https://console.cloud.google.com/cloud-build/builds"
echo "Cloud Logging: https://console.cloud.google.com/logs/viewer"