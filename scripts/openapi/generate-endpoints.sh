#!/usr/bin/env bash
set -euo pipefail

# Generate apps/frontend/src/lib/api/endpoints.ts from OpenAPI specs
# This ensures frontend endpoints are always in sync with backend API definitions

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SPEC_DIR="$ROOT/specs/openapi"
OUTPUT="$ROOT/apps/frontend/src/lib/api/endpoints.ts"

echo "[generate-endpoints] Generating $OUTPUT from OpenAPI specs..."

# Header
cat > "$OUTPUT" << 'EOF'
/**
 * API端点常量
 *
 * 🤖 本文件由 scripts/openapi/generate-endpoints.sh 自动生成
 * ⚠️  请勿手动修改！修改请更新 specs/openapi/*.yaml
 *
 * 【API开发三步法】
 * 1. 在 specs/openapi/*.yaml 定义OpenAPI规范
 * 2. 运行 scripts/openapi/generate.sh 生成代码
 * 3. Gateway通过render-gateway.sh自动部署
 */

export const API_ENDPOINTS = {
EOF

# Parse Billing endpoints
echo "  /**" >> "$OUTPUT"
echo "   * Billing服务 - 计费与订阅管理" >> "$OUTPUT"
echo "   */" >> "$OUTPUT"
echo "  BILLING: {" >> "$OUTPUT"

# Extract paths from billing.yaml (paths are relative to server URL /api/v1/billing)
{ grep -E '^\s+/' "$SPEC_DIR/billing.yaml" | grep -v '^\s+/api' | sed 's/://g' || echo ""; } | while read -r rel_path; do
  [[ -z "$rel_path" ]] && continue
  rel_path=$(echo "$rel_path" | xargs)
  # Prepend server URL
  path="/api/v1/billing$rel_path"
  # Convert path to constant name
  const_name=$(echo "$rel_path" | sed 's|^/||' | sed 's|/|_|g' | sed 's|-|_|g' | tr '[:lower:]' '[:upper:]' | sed 's/{.*}//g')

  # Check if path has parameters
  if [[ "$path" =~ \{[^}]+\} ]]; then
    # Extract parameter name
    param=$(echo "$path" | grep -o '{[^}]*}' | tr -d '{}')
    # Generate function
    echo "    $const_name: ($param: string) => \`$path\`," >> "$OUTPUT"
  else
    # Simple constant
    echo "    $const_name: '$path'," >> "$OUTPUT"
  fi
done

echo "  }," >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Parse Offers endpoints (paths are relative to server URL /api/v1)
echo "  /**" >> "$OUTPUT"
echo "   * Offer服务 - Offer管理" >> "$OUTPUT"
echo "   */" >> "$OUTPUT"
echo "  OFFERS: {" >> "$OUTPUT"

{ grep -E '^\s+/offers' "$SPEC_DIR/offer.yaml" | sed 's/://g' || echo ""; } | while read -r rel_path; do
  [[ -z "$rel_path" ]] && continue
  rel_path=$(echo "$rel_path" | xargs)
  # Prepend server URL
  path="/api/v1$rel_path"

  # Generate constant name with proper handling of path parameters
  # Replace parameter patterns BEFORE removing prefix and converting case
  const_name=$(echo "$rel_path" | \
    sed 's|/offers/{id}/accounts/{accountId}|_ACCOUNT_BY_ID|g' | \
    sed 's|/offers/{id}/revenues/{revenueId}|_REVENUE_BY_ID|g' | \
    sed 's|/offers/{id}|_BY_ID|g' | \
    sed 's|/offers||' | \
    sed 's|^/||' | \
    sed 's|/|_|g' | sed 's|-|_|g' | tr '[:lower:]' '[:upper:]')
  [[ -z "$const_name" ]] && const_name="LIST"

  if [[ "$path" =~ \{[^}]+\} ]]; then
    # Extract all parameters from path
    params=$(echo "$path" | grep -o '{[^}]*}' | tr -d '{}' | paste -sd ',' -)
    # Convert to function parameters: id, accountId -> id: string, accountId: string
    param_list=$(echo "$params" | sed 's/,/, /g' | sed 's/\([a-zA-Z_][a-zA-Z0-9_]*\)/\1: string/g')
    # Convert {param} to ${param} for template strings
    template_path=$(echo "$path" | sed 's/{/\${/g')
    echo "    $const_name: ($param_list) => \`$template_path\`," >> "$OUTPUT"
  else
    echo "    $const_name: '$path'," >> "$OUTPUT"
  fi
done

echo "  }," >> "$OUTPUT"
echo "" >> "$OUTPUT"

# AdsCenter endpoints
echo "  /**" >> "$OUTPUT"
echo "   * AdsCenter服务 - 广告管理中心" >> "$OUTPUT"
echo "   */" >> "$OUTPUT"
echo "  ADSCENTER: {" >> "$OUTPUT"

{ grep -E '^\s+/api/v1/adscenter' "$SPEC_DIR/adscenter.yaml" | sed 's/://g' || echo ""; } | while read -r path; do
  [[ -z "$path" ]] && continue
  path=$(echo "$path" | xargs)
  const_name=$(echo "$path" | sed 's|/api/v1/adscenter/||' | sed 's|/|_|g' | sed 's|-|_|g' | tr '[:lower:]' '[:upper:]' | sed 's/{.*}//g')

  if [[ "$path" =~ \{[^}]+\} ]]; then
    # Extract all parameters from path
    params=$(echo "$path" | grep -o '{[^}]*}' | tr -d '{}' | paste -sd ',' -)
    # Convert to function parameters: id, accountId -> id: string, accountId: string
    param_list=$(echo "$params" | sed 's/,/, /g' | sed 's/\([a-zA-Z_][a-zA-Z0-9_]*\)/\1: string/g')
    # Convert {param} to ${param} for template strings
    template_path=$(echo "$path" | sed 's/{/\${/g')
    echo "    $const_name: ($param_list) => \`$template_path\`," >> "$OUTPUT"
  else
    echo "    $const_name: '$path'," >> "$OUTPUT"
  fi
done

echo "  }," >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Console endpoints
echo "  /**" >> "$OUTPUT"
echo "   * Console服务 - 管理后台专用" >> "$OUTPUT"
echo "   * ⚠️ 用户Dashboard请直接调用微服务API（Offers、Billing等）" >> "$OUTPUT"
echo "   */" >> "$OUTPUT"
echo "  CONSOLE: {" >> "$OUTPUT"

{ grep -E '^\s+/api/v1/console' "$SPEC_DIR/console.yaml" | sed 's/://g' || echo ""; } | while read -r path; do
  [[ -z "$path" ]] && continue
  path=$(echo "$path" | xargs)
  const_name=$(echo "$path" | sed 's|/api/v1/console/||' | sed 's|/|_|g' | sed 's|-|_|g' | tr '[:lower:]' '[:upper:]' | sed 's/{.*}//g')

  if [[ "$path" =~ \{[^}]+\} ]]; then
    # Extract all parameters from path
    params=$(echo "$path" | grep -o '{[^}]*}' | tr -d '{}' | paste -sd ',' -)
    # Convert to function parameters: id, accountId -> id: string, accountId: string
    param_list=$(echo "$params" | sed 's/,/, /g' | sed 's/\([a-zA-Z_][a-zA-Z0-9_]*\)/\1: string/g')
    # Convert {param} to ${param} for template strings
    template_path=$(echo "$path" | sed 's/{/\${/g')
    echo "    $const_name: ($param_list) => \`$template_path\`," >> "$OUTPUT"
  else
    echo "    $const_name: '$path'," >> "$OUTPUT"
  fi
done

echo "  }," >> "$OUTPUT"
echo "" >> "$OUTPUT"


# Recommendations endpoints
echo "  /**" >> "$OUTPUT"
echo "   * Recommendations服务 - 推荐与风险检测" >> "$OUTPUT"
echo "   */" >> "$OUTPUT"
echo "  RECOMMENDATIONS: {" >> "$OUTPUT"

if [[ -f "$ROOT/services/recommendations/openapi.yaml" ]]; then
  { grep -E '^\s+/recommend' "$ROOT/services/recommendations/openapi.yaml" | sed 's/://g' || echo ""; } | while read -r path; do
    [[ -z "$path" ]] && continue
    path=$(echo "$path" | xargs)
    # Prepend /api/v1 if not present
    [[ ! "$path" =~ ^/api ]] && path="/api/v1$path"
    const_name=$(echo "$path" | sed 's|/api/v1/recommend/||' | sed 's|/|_|g' | sed 's|-|_|g' | tr '[:lower:]' '[:upper:]' | sed 's/{.*}//g')

    # If const_name is empty (path was just /api/v1/recommend/{id}), use BY_ID
    [[ -z "$const_name" ]] && const_name="BY_ID"

    if [[ "$path" =~ \{[^}]+\} ]]; then
      param=$(echo "$path" | grep -o '{[^}]*}' | tr -d '{}' | head -1)
      echo "    $const_name: ($param: string) => \`$path\`," >> "$OUTPUT"
    else
      echo "    $const_name: '$path'," >> "$OUTPUT"
    fi
  done
fi

echo "  }," >> "$OUTPUT"
echo "" >> "$OUTPUT"

# UserActivity endpoints (hardcoded - no OpenAPI spec yet)
echo "  /**" >> "$OUTPUT"
echo "   * UserActivity服务 - 用户活动管理" >> "$OUTPUT"
echo "   */" >> "$OUTPUT"
echo "  USERACTIVITY: {" >> "$OUTPUT"
echo "    CHECKIN: '/api/v1/check-in'," >> "$OUTPUT"
echo "    CHECKIN_STATUS: '/api/v1/check-in/status'," >> "$OUTPUT"
echo "    CHECKIN_HISTORY: '/api/v1/check-in/history'," >> "$OUTPUT"
echo "    REFERRAL: '/api/v1/referral'," >> "$OUTPUT"
echo "  }," >> "$OUTPUT"
echo "" >> "$OUTPUT"

# Health endpoints
echo "  /**" >> "$OUTPUT"
echo "   * 健康检查端点" >> "$OUTPUT"
echo "   */" >> "$OUTPUT"
echo "  HEALTH: {" >> "$OUTPUT"
echo "    /** Gateway就绪检查 */" >> "$OUTPUT"
echo "    READYZ: '/readyz'," >> "$OUTPUT"
echo "    /** 整体健康检查 */" >> "$OUTPUT"
echo "    AGGREGATE: '/api/health'," >> "$OUTPUT"
echo "    /** AdsCenter健康检查 */" >> "$OUTPUT"
echo "    ADSCENTER: '/api/health/adscenter'," >> "$OUTPUT"
echo "    /** Console健康检查 */" >> "$OUTPUT"
echo "    CONSOLE: '/api/health/console'," >> "$OUTPUT"
echo "    /** Billing健康检查 */" >> "$OUTPUT"
echo "    BILLING: '/api/health/billing'," >> "$OUTPUT"
echo "  }," >> "$OUTPUT"

# Footer
cat >> "$OUTPUT" << 'EOF'
} as const;

/**
 * 类型提取工具
 */
export type ApiEndpoints = typeof API_ENDPOINTS;
export type BillingEndpoints = ApiEndpoints['BILLING'];
export type UserActivityEndpoints = ApiEndpoints['USERACTIVITY'];
export type OffersEndpoints = ApiEndpoints['OFFERS'];
export type AdsCenterEndpoints = ApiEndpoints['ADSCENTER'];
export type ConsoleEndpoints = ApiEndpoints['CONSOLE'];
export type NotificationsEndpoints = ApiEndpoints['NOTIFICATIONS'];
export type RecommendationsEndpoints = ApiEndpoints['RECOMMENDATIONS'];
export type HealthEndpoints = ApiEndpoints['HEALTH'];
EOF

echo "[generate-endpoints] ✅ Generated $OUTPUT"
echo "[generate-endpoints] 📊 Stats:"
wc -l "$OUTPUT"
