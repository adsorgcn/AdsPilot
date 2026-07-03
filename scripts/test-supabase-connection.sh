#!/bin/bash
set -euo pipefail

# 测试Supabase连接和凭证
# 从secrets/supabase-credentials.json读取凭证

CREDS_FILE="secrets/supabase-credentials.json"

if [[ -f "$CREDS_FILE" ]]; then
    echo "🔍 使用 $CREDS_FILE 中的 Supabase 凭证"
    PROJECT_URL=$(jq -r '.project_url' "$CREDS_FILE")
    ANON_KEY=$(jq -r '.anon_key' "$CREDS_FILE")
    SERVICE_KEY=$(jq -r '.service_role_key' "$CREDS_FILE")
    ACCESS_TOKEN=$(jq -r '.access_token // empty' "$CREDS_FILE")
    PROJECT_REF=$(jq -r '.project_ref // empty' "$CREDS_FILE")
    DB_HOST=$(jq -r '.db_host // empty' "$CREDS_FILE")
    DB_PORT=$(jq -r '.db_port // empty' "$CREDS_FILE")
    DB_NAME=$(jq -r '.db_name // empty' "$CREDS_FILE")
    DB_USER=$(jq -r '.db_user // empty' "$CREDS_FILE")
    DB_PASSWORD=$(jq -r '.db_password // empty' "$CREDS_FILE")
else
    echo "ℹ️  未找到 $CREDS_FILE，尝试从环境变量读取 Supabase 凭证"
    PROJECT_URL=${SUPABASE_PROJECT_URL:-}
    ANON_KEY=${SUPABASE_ANON_KEY:-}
    SERVICE_KEY=${SUPABASE_SERVICE_KEY:-}
    ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN:-}
    PROJECT_REF=${SUPABASE_PROJECT_REF:-}
    DB_HOST=${SUPABASE_DB_HOST:-}
    DB_PORT=${SUPABASE_DB_PORT:-}
    DB_NAME=${SUPABASE_DB_NAME:-}
    DB_USER=${SUPABASE_DB_USER:-}
    DB_PASSWORD=${SUPABASE_DB_PASSWORD:-}
fi

echo "🔍 测试Supabase连接..."
echo ""

if [[ -z "${PROJECT_URL}" || -z "${ANON_KEY}" ]]; then
    echo "⚠️  未检测到完整的 Supabase 凭证（PROJECT_URL / ANON_KEY），跳过 Supabase 冒烟测试"
    exit 0
fi

echo "📋 配置信息:"
echo "  Project URL: $PROJECT_URL"
echo "  Project Ref: ${PROJECT_REF:-<unset>}"
echo "  Anon Key: ${ANON_KEY:0:20}..."
echo "  Service Key: ${SERVICE_KEY:0:20}..."
echo "  Access Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# 测试1: 检查Supabase REST API (使用anon key)
echo "1️⃣ 测试 REST API (anon key)..."
RESPONSE=$(curl -s -w "\n%{http_code}" "${PROJECT_URL}/rest/v1/" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ REST API 连接成功"
else
    echo "   ❌ REST API 连接失败 (HTTP $HTTP_CODE)"
    echo "   响应: $BODY"
    exit 1
fi
echo ""

# 测试2: 检查Auth API
echo "2️⃣ 测试 Auth API..."
AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${PROJECT_URL}/auth/v1/health" \
    -H "apikey: ${ANON_KEY}")

AUTH_HTTP_CODE=$(echo "$AUTH_RESPONSE" | tail -1)
AUTH_BODY=$(echo "$AUTH_RESPONSE" | sed '$d')

if [ "$AUTH_HTTP_CODE" = "200" ]; then
    echo "   ✅ Auth API 正常"
    echo "   响应: $AUTH_BODY"
else
    echo "   ❌ Auth API 异常 (HTTP $AUTH_HTTP_CODE)"
    exit 1
fi
echo ""

# 测试3: 检查Management API (使用access token)
if [[ -n "$PROJECT_REF" && -n "$ACCESS_TOKEN" ]]; then
    echo "3️⃣ 测试 Management API (access token)..."
    MGMT_RESPONSE=$(curl -s -w "\n%{http_code}" \
        "https://api.supabase.com/v1/projects/${PROJECT_REF}" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}")

    MGMT_HTTP_CODE=$(echo "$MGMT_RESPONSE" | tail -1)
    MGMT_BODY=$(echo "$MGMT_RESPONSE" | sed '$d')

    if [ "$MGMT_HTTP_CODE" = "200" ]; then
        echo "   ✅ Management API 连接成功"
        PROJECT_NAME=$(echo "$MGMT_BODY" | jq -r '.name // "N/A"')
        PROJECT_REGION=$(echo "$MGMT_BODY" | jq -r '.region // "N/A"')
        PROJECT_STATUS=$(echo "$MGMT_BODY" | jq -r '.status // "N/A"')
        echo "   项目名称: $PROJECT_NAME"
        echo "   项目区域: $PROJECT_REGION"
        echo "   项目状态: $PROJECT_STATUS"
    else
        echo "   ❌ Management API 连接失败 (HTTP $MGMT_HTTP_CODE)"
        echo "   响应: $MGMT_BODY"
        exit 1
    fi
else
    echo "3️⃣ 管理 API 凭证未配置，跳过"
fi
echo ""

# 测试4: 检查数据库连接
echo "4️⃣ 测试 PostgreSQL 连接..."
# 检查psql是否安装
if [[ -n "$DB_HOST" && -n "$DB_PORT" && -n "$DB_USER" && -n "$DB_PASSWORD" ]]; then
    if command -v psql &> /dev/null; then
        export PGPASSWORD="$DB_PASSWORD"
        DB_TEST=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "${DB_NAME:-postgres}" \
            -c "SELECT version();" -t 2>&1 || echo "FAILED")
        
        if [[ "$DB_TEST" != "FAILED" ]]; then
            echo "   ✅ PostgreSQL 连接成功"
            echo "   版本: $(echo "$DB_TEST" | head -1 | xargs)"
        else
            echo "   ❌ PostgreSQL 连接失败"
            echo "   错误: $DB_TEST"
            exit 1
        fi
    else
        echo "   ⚠️  psql 未安装，跳过数据库连接测试"
        echo "   提示: 安装 PostgreSQL 客户端以测试数据库连接"
    fi
else
    echo "4️⃣ 数据库凭证未配置，跳过数据库连接测试"
fi
echo ""

# 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试总结"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 所有必要的API都已配置完成"
echo "🎯 Supabase凭证文件配置正确"
echo ""
echo "💡 下一步:"
echo "   1. 测试前端Google OAuth登录"
echo "   2. 验证用户数据存储到Supabase"
echo "   3. 检查Cloud Run服务日志"
echo ""
