#!/bin/bash
# 端到端测试: AI评估v2.1新字段验证
# 测试流程: 创建Offer → AI评估 → 验证新字段

set -e

# 配置
API_GATEWAY_URL="https://gm-api-preview-yt54xvsg5q-an.a.run.app"
FIREBASE_TOKEN="${FIREBASE_TOKEN:-}"  # 从环境变量获取

# 测试域名
TEST_DOMAIN="nike.com"

echo "========================================="
echo "AI评估v2.1端到端测试"
echo "========================================="
echo "API Gateway: ${API_GATEWAY_URL}"
echo "测试域名: ${TEST_DOMAIN}"
echo ""

# 检查Firebase Token
if [ -z "${FIREBASE_TOKEN}" ]; then
  echo "❌ 缺少FIREBASE_TOKEN环境变量"
  echo ""
  echo "获取Token方法:"
  echo "1. 访问 https://www.urlchecker.dev"
  echo "2. 登录后打开浏览器开发者工具"
  echo "3. Application → Local Storage → idToken"
  echo "4. 复制token并执行:"
  echo "   export FIREBASE_TOKEN='your_token_here'"
  echo ""
  exit 1
fi

echo "步骤 1/5: 创建测试Offer..."

# 创建Offer
CREATE_OFFER_RESPONSE=$(curl -s -X POST "${API_GATEWAY_URL}/api/v1/offers" \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://${TEST_DOMAIN}\", \"country\": \"US\"}")

echo "创建Offer响应: ${CREATE_OFFER_RESPONSE}"

OFFER_ID=$(echo "${CREATE_OFFER_RESPONSE}" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "${OFFER_ID}" ]; then
  echo "❌ 创建Offer失败"
  echo "${CREATE_OFFER_RESPONSE}"
  exit 1
fi

echo "✅ Offer创建成功: ${OFFER_ID}"

echo ""
echo "步骤 2/5: 发起AI评估..."

# 发起AI评估（需要Elite订阅）
EVALUATE_RESPONSE=$(curl -s -X POST "${API_GATEWAY_URL}/api/v1/offers/${OFFER_ID}/evaluate" \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"includeAI": true, "forceRefresh": false}')

echo "评估响应: ${EVALUATE_RESPONSE}"

EVALUATION_ID=$(echo "${EVALUATE_RESPONSE}" | grep -o '"evaluationId":"[^"]*"' | cut -d'"' -f4)

if [ -z "${EVALUATION_ID}" ]; then
  echo "❌ 发起评估失败（可能需要Elite订阅或Token不足）"
  echo "${EVALUATE_RESPONSE}"
  exit 1
fi

echo "✅ 评估任务创建成功: ${EVALUATION_ID}"
echo "预估消耗: 3 tokens"

echo ""
echo "步骤 3/5: 等待评估完成..."

# 轮询评估状态（最多等待2分钟）
MAX_ATTEMPTS=24  # 24 * 5秒 = 2分钟
ATTEMPT=0
STATUS="pending"

while [ "${STATUS}" != "success" ] && [ ${ATTEMPT} -lt ${MAX_ATTEMPTS} ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "  [${ATTEMPT}/${MAX_ATTEMPTS}] 检查评估状态..."

  EVAL_STATUS_RESPONSE=$(curl -s "${API_GATEWAY_URL}/api/v1/evaluations/${EVALUATION_ID}" \
    -H "Authorization: Bearer ${FIREBASE_TOKEN}")

  STATUS=$(echo "${EVAL_STATUS_RESPONSE}" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

  if [ "${STATUS}" = "success" ]; then
    echo "  ✅ 评估完成"
    break
  elif [ "${STATUS}" = "failed" ]; then
    echo "  ❌ 评估失败"
    echo "${EVAL_STATUS_RESPONSE}"
    exit 1
  fi

  sleep 5
done

if [ "${STATUS}" != "success" ]; then
  echo "❌ 评估超时（2分钟）"
  exit 1
fi

echo ""
echo "步骤 4/5: 获取评估结果..."

EVAL_RESULT=$(curl -s "${API_GATEWAY_URL}/api/v1/evaluations/${EVALUATION_ID}" \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}")

echo "${EVAL_RESULT}" | jq . 2>/dev/null || echo "${EVAL_RESULT}"

echo ""
echo "步骤 5/5: 验证v2.1新增字段..."

# 验证新增字段是否存在
HAS_PRODUCT_TYPE=$(echo "${EVAL_RESULT}" | grep -c '"aiProductType"' || true)
HAS_ESTIMATED_AOV=$(echo "${EVAL_RESULT}" | grep -c '"aiEstimatedAOV"' || true)
HAS_SEARCH_INSIGHTS=$(echo "${EVAL_RESULT}" | grep -c '"aiSearchInsights"' || true)
HAS_GEO_INSIGHTS=$(echo "${EVAL_RESULT}" | grep -c '"aiGeoInsights"' || true)
HAS_RISK_ASSESSMENT=$(echo "${EVAL_RESULT}" | grep -c '"aiRiskAssessment"' || true)

echo ""
echo "========================================="
echo "字段验证结果"
echo "========================================="
echo "aiProductType:     $([ ${HAS_PRODUCT_TYPE} -gt 0 ] && echo '✅ 存在' || echo '❌ 缺失')"
echo "aiEstimatedAOV:    $([ ${HAS_ESTIMATED_AOV} -gt 0 ] && echo '✅ 存在' || echo '❌ 缺失')"
echo "aiSearchInsights:  $([ ${HAS_SEARCH_INSIGHTS} -gt 0 ] && echo '✅ 存在' || echo '❌ 缺失')"
echo "aiGeoInsights:     $([ ${HAS_GEO_INSIGHTS} -gt 0 ] && echo '✅ 存在' || echo '❌ 缺失')"
echo "aiRiskAssessment:  $([ ${HAS_RISK_ASSESSMENT} -gt 0 ] && echo '✅ 存在' || echo '❌ 缺失')"
echo ""

# 提取关键数据验证
if command -v jq &> /dev/null; then
  echo "关键数据提取:"
  echo "  推荐指数: $(echo "${EVAL_RESULT}" | jq -r '.aiRecommendationScore // "N/A"')"
  echo "  产品类型: $(echo "${EVAL_RESULT}" | jq -r '.aiProductType // "N/A"')"
  echo "  预估AOV: $(echo "${EVAL_RESULT}" | jq -r '.aiEstimatedAOV // "N/A"')"
  echo "  品牌词占比: $(echo "${EVAL_RESULT}" | jq -r '.aiSearchInsights.brandVsNonBrand // "N/A"')"
  echo "  主要市场: $(echo "${EVAL_RESULT}" | jq -r '.aiGeoInsights.topMarkets[0] // "N/A"')"
  echo "  政策合规: $(echo "${EVAL_RESULT}" | jq -r '.aiRiskAssessment.policyCompliance // "N/A"')"
  echo ""
fi

# 总体验证
TOTAL_FIELDS=5
PASSED_FIELDS=$((HAS_PRODUCT_TYPE + HAS_ESTIMATED_AOV + HAS_SEARCH_INSIGHTS + HAS_GEO_INSIGHTS + HAS_RISK_ASSESSMENT))

echo "========================================="
if [ ${PASSED_FIELDS} -eq ${TOTAL_FIELDS} ]; then
  echo "✅ 测试通过 (${PASSED_FIELDS}/${TOTAL_FIELDS} 字段)"
  echo "========================================="
  exit 0
else
  echo "⚠️ 部分字段缺失 (${PASSED_FIELDS}/${TOTAL_FIELDS} 字段)"
  echo "========================================="
  exit 1
fi
