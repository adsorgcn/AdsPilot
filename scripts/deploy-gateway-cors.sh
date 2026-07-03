#!/bin/bash
# P0-2: 部署API Gateway CORS配置
#
# 目的: 更新gm-gw的API配置,添加www.urlchecker.dev的CORS支持
#
# 执行步骤:
# 1. chmod +x scripts/deploy-gateway-cors.sh
# 2. ./scripts/deploy-gateway-cors.sh
#
# 预期结果:
# - 创建新的API配置版本(包含CORS)
# - 更新gm-gw gateway使用新配置
# - 修复CORS错误,允许Console API调用

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID}"
API_ID="gm-api"
GATEWAY_ID="gm-gw"
LOCATION="asia-northeast1"
CONFIG_FILE="deployments/api-gateway/gateway.yaml"

echo "=========================================="
echo "部署 API Gateway CORS 配置"
echo "=========================================="
echo ""

# 检查配置文件是否存在
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "❌ 错误: 配置文件 $CONFIG_FILE 不存在"
  exit 1
fi

echo "✅ 配置文件: $CONFIG_FILE"
echo ""

# 验证CORS配置
echo "验证CORS配置..."
if grep -q "www.urlchecker.dev" "$CONFIG_FILE"; then
  echo "✅ CORS配置包含 www.urlchecker.dev"
else
  echo "❌ 警告: CORS配置中未找到 www.urlchecker.dev"
fi

if grep -q "x-google-management:" "$CONFIG_FILE"; then
  echo "✅ 包含 x-google-management CORS配置"
else
  echo "❌ 错误: 未找到 x-google-management CORS配置"
  exit 1
fi
echo ""

# 生成配置ID (使用时间戳)
CONFIG_ID="gm-cors-$(date +%Y%m%d-%H%M%S)"
echo "新配置ID: $CONFIG_ID"
echo ""

# 创建API配置
echo "创建API配置..."
gcloud api-gateway api-configs create "$CONFIG_ID" \
  --api="$API_ID" \
  --openapi-spec="$CONFIG_FILE" \
  --project="$PROJECT_ID" \
  --display-name="$CONFIG_ID"

echo "✅ API配置创建成功: $CONFIG_ID"
echo ""

# 等待配置变为ACTIVE
echo "等待配置变为ACTIVE状态..."
for i in {1..60}; do
  STATE=$(gcloud api-gateway api-configs describe "$CONFIG_ID" \
    --api="$API_ID" \
    --project="$PROJECT_ID" \
    --format="value(state)" 2>/dev/null || echo "UNKNOWN")

  if [[ "$STATE" == "ACTIVE" ]]; then
    echo "✅ 配置已激活"
    break
  fi

  echo "  状态: $STATE (等待中... $i/60)"
  sleep 5
done

if [[ "$STATE" != "ACTIVE" ]]; then
  echo "❌ 错误: 配置未能激活,当前状态: $STATE"
  exit 1
fi
echo ""

# 更新Gateway使用新配置
echo "更新Gateway: $GATEWAY_ID"
gcloud api-gateway gateways update "$GATEWAY_ID" \
  --api="$API_ID" \
  --api-config="$CONFIG_ID" \
  --location="$LOCATION" \
  --project="$PROJECT_ID"

echo "✅ Gateway更新成功"
echo ""

# 等待Gateway更新完成
echo "等待Gateway更新完成..."
for i in {1..60}; do
  STATE=$(gcloud api-gateway gateways describe "$GATEWAY_ID" \
    --location="$LOCATION" \
    --project="$PROJECT_ID" \
    --format="value(state)" 2>/dev/null || echo "UNKNOWN")

  if [[ "$STATE" == "ACTIVE" ]]; then
    echo "✅ Gateway已激活"
    break
  fi

  echo "  状态: $STATE (等待中... $i/60)"
  sleep 5
done

if [[ "$STATE" != "ACTIVE" ]]; then
  echo "❌ 错误: Gateway未能激活,当前状态: $STATE"
  exit 1
fi
echo ""

# 获取Gateway URL
GATEWAY_URL=$(gcloud api-gateway gateways describe "$GATEWAY_ID" \
  --location="$LOCATION" \
  --project="$PROJECT_ID" \
  --format="value(defaultHostname)")

echo "=========================================="
echo "✅ 部署完成"
echo "=========================================="
echo ""
echo "Gateway URL: https://$GATEWAY_URL"
echo "配置ID: $CONFIG_ID"
echo ""
echo "验证步骤:"
echo "1. 访问 https://www.urlchecker.dev/dashboard"
echo "2. 使用 test-user@${APP_DOMAIN} 登录"
echo "3. 检查浏览器控制台是否还有CORS错误"
echo "4. 确认Console API调用正常工作"
echo ""
echo "测试CORS:"
echo "curl -I -X OPTIONS \\"
echo "  -H 'Origin: https://www.urlchecker.dev' \\"
echo "  -H 'Access-Control-Request-Method: GET' \\"
echo "  https://$GATEWAY_URL/api/v1/console/navigation"
echo ""
