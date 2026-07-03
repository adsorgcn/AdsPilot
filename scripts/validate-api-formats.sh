#!/bin/bash

# API格式验证脚本
# 用于检查前后端API数据格式是否匹配

set -e

echo "🔍 API Format Validation Script"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查jq是否安装
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is not installed. Please install it first.${NC}"
    echo "   brew install jq  # macOS"
    echo "   apt-get install jq  # Ubuntu"
    exit 1
fi

# 获取token（需要用户提供）
if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  AUTH_TOKEN environment variable not set${NC}"
    echo "   Please set it with: export AUTH_TOKEN='your_jwt_token'"
    echo ""
    echo "   You can get your token from:"
    echo "   1. Login to https://www.urlchecker.dev"
    echo "   2. Open browser console"
    echo "   3. Run: (await supabase.auth.getSession()).data.session.access_token"
    echo ""
    exit 1
fi

# API基础URL
BASE_URL="${API_BASE_URL:-https://www.urlchecker.dev}"

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
test_api() {
    local endpoint=$1
    local expected_fields=$2
    local method=${3:-GET}
    local body=${4:-}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing ${endpoint}... "
    
    # 构建curl命令
    local curl_cmd="curl -s -w '\n%{http_code}' -X ${method}"
    curl_cmd="${curl_cmd} -H 'Authorization: Bearer ${AUTH_TOKEN}'"
    curl_cmd="${curl_cmd} -H 'Content-Type: application/json'"
    
    if [ -n "$body" ]; then
        curl_cmd="${curl_cmd} -d '${body}'"
    fi
    
    curl_cmd="${curl_cmd} '${BASE_URL}${endpoint}'"
    
    # 执行请求
    local response=$(eval $curl_cmd)
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    # 检查HTTP状态码
    if [ "$http_code" != "200" ]; then
        echo -e "${RED}❌ Failed (HTTP ${http_code})${NC}"
        echo "   Response: $body"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    # 检查JSON格式
    if ! echo "$body" | jq . > /dev/null 2>&1; then
        echo -e "${RED}❌ Failed (Invalid JSON)${NC}"
        echo "   Response: $body"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    # 检查必需字段
    local missing_fields=""
    for field in $expected_fields; do
        if ! echo "$body" | jq -e ".$field" > /dev/null 2>&1; then
            missing_fields="${missing_fields} ${field}"
        fi
    done
    
    if [ -n "$missing_fields" ]; then
        echo -e "${RED}❌ Failed (Missing fields:${missing_fields})${NC}"
        echo "   Response: $body"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    echo -e "${GREEN}✅ Passed${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
}

echo "📋 Testing Billing Service APIs"
echo "--------------------------------"

# 1. 订阅信息
test_api "/api/v1/billing/subscriptions/me" \
    "tier isActive"

# 2. Token余额
test_api "/api/v1/billing/tokens/balance" \
    "currentBalance"

# 3. Token使用记录
test_api "/api/v1/billing/tokens/usage" \
    "totalConsumed"

echo ""
echo "📋 Testing Console Service APIs"
echo "--------------------------------"

# 4. Dashboard统计
test_api "/api/v1/console/dashboard/stats" \
    "userId totalOffers"

# 5. 任务统计
test_api "/api/v1/console/tasks/stats" \
    "total"

# 6. Admin统计（需要管理员权限）
if [ "$IS_ADMIN" = "true" ]; then
    test_api "/api/v1/console/stats" \
        "counters"
fi

echo ""
echo "📋 Testing Offer Service APIs"
echo "------------------------------"

# 7. Offer列表
test_api "/api/v1/offers" \
    "items total"

echo ""
echo "📋 Testing AdsCenter Service APIs"
echo "----------------------------------"

# 8. 广告账号列表
test_api "/api/v1/adscenter/accounts" \
    "items"

echo ""
echo "📋 Testing UserActivity Service APIs"
echo "-------------------------------------"

# 9. 签到状态
test_api "/api/v1/check-in/status" \
    "hasCheckedInToday"

echo ""
echo "================================"
echo "📊 Test Summary"
echo "================================"
echo "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check the output above.${NC}"
    exit 1
fi
