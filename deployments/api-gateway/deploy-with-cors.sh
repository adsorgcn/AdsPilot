#!/bin/bash

# Google-Monetize API Gateway 部署脚本（带CORS配置）
# 用途: 部署更新后的API Gateway配置到GCP
# 更新时间: 2025-10-03

set -e  # 遇到错误立即退出

# ============================================================
# 配置变量
# ============================================================
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
GATEWAY_ID="gm-gw-preview"
API_ID="gm-api-preview"
CONFIG_FILE="gateway.yaml"

# 时间戳（用于生成唯一的配置ID）
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CONFIG_ID="cfg-cors-${TIMESTAMP}"

echo "=================================================="
echo "Google-Monetize API Gateway CORS 配置部署"
echo "=================================================="
echo "项目: ${PROJECT_ID}"
echo "网关: ${GATEWAY_ID}"
echo "API: ${API_ID}"
echo "配置ID: ${CONFIG_ID}"
echo "=================================================="

# ============================================================
# 步骤1: 验证配置文件存在
# ============================================================
echo ""
echo "步骤1: 验证配置文件..."
if [ ! -f "${CONFIG_FILE}" ]; then
    echo "错误: 配置文件 ${CONFIG_FILE} 不存在"
    exit 1
fi
echo "✅ 配置文件验证通过"

# ============================================================
# 步骤2: 检查CORS配置是否存在
# ============================================================
echo ""
echo "步骤2: 检查CORS配置..."
if grep -q "x-google-management:" "${CONFIG_FILE}"; then
    echo "✅ CORS配置已存在"
else
    echo "⚠️  警告: 未找到 x-google-management 配置"
    echo "请确认配置文件已包含CORS设置"
    exit 1
fi

# ============================================================
# 步骤3: 创建新的API配置
# ============================================================
echo ""
echo "步骤3: 创建新的API配置..."
gcloud api-gateway api-configs create "${CONFIG_ID}" \
  --api="${API_ID}" \
  --openapi-spec="${CONFIG_FILE}" \
  --project="${PROJECT_ID}" \
  --display-name="CORS enabled config - ${TIMESTAMP}"

echo "✅ API配置创建成功: ${CONFIG_ID}"

# ============================================================
# 步骤4: 更新API Gateway使用新配置
# ============================================================
echo ""
echo "步骤4: 更新API Gateway..."
gcloud api-gateway gateways update "${GATEWAY_ID}" \
  --api="${API_ID}" \
  --api-config="${CONFIG_ID}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}"

echo "✅ API Gateway更新成功"

# ============================================================
# 步骤5: 等待部署完成
# ============================================================
echo ""
echo "步骤5: 等待部署完成..."
echo "正在检查Gateway状态..."

MAX_WAIT=300  # 最多等待5分钟
WAIT_TIME=0
INTERVAL=10

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    STATE=$(gcloud api-gateway gateways describe "${GATEWAY_ID}" \
      --location="${REGION}" \
      --project="${PROJECT_ID}" \
      --format="value(state)")

    if [ "$STATE" = "ACTIVE" ]; then
        echo "✅ Gateway部署完成，状态: ACTIVE"
        break
    fi

    echo "当前状态: ${STATE}，等待中..."
    sleep $INTERVAL
    WAIT_TIME=$((WAIT_TIME + INTERVAL))
done

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    echo "⚠️  警告: 部署超时，请手动检查Gateway状态"
fi

# ============================================================
# 步骤6: 验证CORS配置
# ============================================================
echo ""
echo "步骤6: 验证CORS配置..."
GATEWAY_URL=$(gcloud api-gateway gateways describe "${GATEWAY_ID}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(defaultHostname)")

echo "Gateway URL: https://${GATEWAY_URL}"
echo ""
echo "测试CORS Preflight请求..."

# 测试OPTIONS请求
curl -i -X OPTIONS \
  -H "Origin: https://www.urlchecker.dev" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  "https://${GATEWAY_URL}/api/v1/offers" \
  2>&1 | head -20

echo ""
echo "=================================================="
echo "✅ 部署完成！"
echo "=================================================="
echo ""
echo "Gateway URL: https://${GATEWAY_URL}"
echo "配置ID: ${CONFIG_ID}"
echo ""
echo "下一步:"
echo "1. 检查上面的CORS测试输出"
echo "2. 确认响应头包含: Access-Control-Allow-Origin"
echo "3. 在前端应用中测试API调用"
echo ""
echo "如需回滚，运行:"
echo "  gcloud api-gateway gateways update ${GATEWAY_ID} \\"
echo "    --api=${API_ID} \\"
echo "    --api-config=<旧配置ID> \\"
echo "    --location=${REGION} \\"
echo "    --project=${PROJECT_ID}"
echo ""
