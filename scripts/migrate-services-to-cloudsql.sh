#!/bin/bash

# Cloud SQL Proxy Migration Script
# 批量更新Cloud Run服务配置，从VPC Connector迁移到Cloud SQL Proxy

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置常量
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
CLOUDSQL_INSTANCE="${GCP_PROJECT_ID}:asia-northeast1:gm"

# 需要迁移的服务列表（基于DATABASE_URL使用情况）
SERVICES=(
    "billing-preview"
    "siterank-preview"
    "adscenter-preview"
    "offer-preview"
    "console-preview"
    "useractivity-preview"
    "projector-preview"
    "recommendations-preview"
)

echo -e "${BLUE}🚀 开始Cloud SQL Proxy迁移...${NC}"
echo -e "${BLUE}项目: ${PROJECT_ID} | 区域: ${REGION} | 实例: ${CLOUDSQL_INSTANCE}${NC}"

# 检查gcloud认证
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ 未找到有效的gcloud认证，请先运行: gcloud auth login${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 将要更新的服务:${NC}"
for service in "${SERVICES[@]}"; do
    echo "  - $service"
done

# 函数：更新单个服务
update_service() {
    local service_name=$1
    echo -e "\n${YELLOW}🔧 更新服务: $service_name${NC}"

    # 检查服务是否存在
    if ! gcloud run services describe "$service_name" --region="$REGION" --format="value(status)" >/dev/null 2>&1; then
        echo -e "${RED}❌ 服务 $service_name 不存在，跳过${NC}"
        return 1
    fi

    echo -e "${BLUE}📥 获取当前服务配置...${NC}"

    # 获取当前配置
    gcloud run services describe "$service_name" \
        --region="$REGION" \
        --format="yaml" > "/tmp/${service_name}-current.yaml"

    # 备份原始配置
    cp "/tmp/${service_name}-current.yaml" "/tmp/${service_name}-backup.yaml"

    echo -e "${BLUE}🔄 更新配置...${NC}"

    # 使用yq更新配置（如果yq不可用，将跳过）
    if command -v yq >/dev/null 2>&1; then
        # 添加Cloud SQL Proxy annotations
        yq eval ".spec.template.metadata.annotations.\"run.googleapis.com/cloudsql-instances\" = \"$CLOUDSQL_INSTANCE\"" \
            -i "/tmp/${service_name}-current.yaml"

        yq eval ".spec.template.metadata.annotations.\"run.googleapis.com/startup-cpu-boost\" = \"true\"" \
            -i "/tmp/${service_name}-current.yaml"

        # 删除VPC Connector相关annotations
        yq eval "del(.spec.template.metadata.annotations.\"run.googleapis.com/vpc-access-connector\")" \
            -i "/tmp/${service_name}-current.yaml"

        yq eval "del(.spec.template.metadata.annotations.\"run.googleapis.com/vpc-access-egress\")" \
            -i "/tmp/${service_name}-current.yaml"

        # 添加DB_CONNECTION_MODE环境变量
        yq eval ".spec.template.spec.containers[0].env += {name: \"DB_CONNECTION_MODE\", value: \"cloudsql\"}" \
            -i "/tmp/${service_name}-current.yaml"

        echo -e "${GREEN}✅ 配置更新完成${NC}"

        # 应用更新
        echo -e "${BLUE}🚀 部署更新后的配置...${NC}"
        gcloud run services replace "/tmp/${service_name}-current.yaml" \
            --region="$REGION" \
            --quiet

        echo -e "${GREEN}✅ 服务 $service_name 更新成功${NC}"

    else
        echo -e "${RED}❌ yq工具未安装，无法自动更新配置${NC}"
        echo -e "${YELLOW}请手动更新服务配置，参考 deployments/templates/cloudsql-proxy-config.yaml${NC}"
        return 1
    fi
}

# 主执行流程
echo -e "\n${YELLOW}⚠️  即将开始批量更新服务，是否继续？ (y/N)${NC}"
read -r confirmation

if [[ "$confirmation" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✅ 开始批量更新...${NC}"

    success_count=0
    total_count=${#SERVICES[@]}

    for service in "${SERVICES[@]}"; do
        if update_service "$service"; then
            ((success_count++))
        fi
    done

    echo -e "\n${GREEN}🎉 批量更新完成！${NC}"
    echo -e "${GREEN}成功: $success_count/$total_count 个服务${NC}"

    if [ $success_count -eq $total_count ]; then
        echo -e "${GREEN}✅ 所有服务均已成功迁移到Cloud SQL Proxy${NC}"
    else
        echo -e "${YELLOW}⚠️  部分服务更新失败，请检查日志${NC}"
    fi

else
    echo -e "${YELLOW}❌ 操作已取消${NC}"
    exit 0
fi

# 清理临时文件
echo -e "\n${BLUE}🧹 清理临时文件...${NC}"
rm -f /tmp/*-current.yaml /tmp/*-backup.yaml

echo -e "${GREEN}🎯 Cloud SQL Proxy迁移完成！${NC}"
echo -e "${YELLOW}📝 请在更新完成后验证服务的数据库连接是否正常${NC}"