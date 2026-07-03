#!/bin/bash
# ========================================
# Schema Naming Fix Script
# 将代码中的PascalCase表名替换为snake_case
# ========================================

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Google-Monetize Schema Naming Fix${NC}"
echo "======================================"

# 定义表名映射
declare -A TABLE_MAPPINGS=(
    ["UserToken"]="user_tokens"
    ["UserTokenPool"]="user_token_pools"
    ["TokenTransaction"]="token_transactions"
    ["TokenCreditLot"]="token_credit_lots"
    ["TokenDebit"]="token_debits"
    ["TokenDebitAllocation"]="token_debit_allocations"
    ["TokenRepairAudit"]="token_repair_audits"
    ["IdempotencyKey"]="idempotency_keys"
    ["Subscription"]="subscriptions"
    ["SubscriptionConfig"]="subscription_configs"
    ["SubscriptionHistory"]="subscription_histories"
    ["UserProfile"]="user_profiles"
    ["AdminImpersonationEvent"]="admin_impersonation_events"
    ["FeatureFlag"]="feature_flags"
    ["FeatureFlagHistory"]="feature_flag_histories"
    ["SystemMetadata"]="system_metadata"
    ["AdminAuditLog"]="admin_audit_logs"
    ["AdminRecoveryCode"]="admin_recovery_codes"
)

# 定义列名映射
declare -A COLUMN_MAPPINGS=(
    ["userId"]="user_id"
    ["planName"]="plan_name"
    ["createdAt"]="created_at"
    ["updatedAt"]="updated_at"
    ["balanceBefore"]="balance_before"
    ["balanceAfter"]="balance_after"
    ["displayName"]="display_name"
    ["avatarUrl"]="avatar_url"
    ["lastSignInAt"]="last_sign_in_at"
    ["emailVerified"]="email_verified"
    ["phoneVerified"]="phone_verified"
    ["billingAddress"]="billing_address"
    ["paymentMethods"]="payment_methods"
    ["creditLimitCents"]="credit_limit_cents"
    ["balanceCents"]="balance_cents"
    ["currentPeriodStart"]="current_period_start"
    ["currentPeriodEnd"]="current_period_end"
    ["trialEnd"]="trial_end"
    ["cancelledAt"]="cancelled_at"
    ["billingInterval"]="billing_interval"
    ["autoRenew"]="auto_renew"
    ["invoiceNumber"]="invoice_number"
    ["dueDate"]="due_date"
    ["paidAt"]="paid_at"
    ["lineItems"]="line_items"
    ["pricingPlans"]="pricing_plans"
    ["monthlyPriceCents"]="monthly_price_cents"
    ["yearlyPriceCents"]="yearly_price_cents"
    ["isActive"]="is_active"
    ["usageRecords"]="usage_records"
    ["resourceId"]="resource_id"
    ["resourceType"]="resource_type"
    ["tokensConsumed"]="tokens_consumed"
    ["costCents"]="cost_cents"
    ["refundAmountCents"]="refund_amount_cents"
    ["refundReason"]="refund_reason"
    ["processedBy"]="processed_by"
    ["approvedAt"]="approved_at"
    ["transactionType"]="transaction_type"
    ["referenceId"]="reference_id"
    ["adminUserId"]="admin_user_id"
    ["targetResourceType"]="target_resource_type"
    ["targetResourceId"]="target_resource_id"
    ["oldValues"]="old_values"
    ["newValues"]="new_values"
    ["actionType"]="action_type"
    ["createdBy"]="created_by"
    ["updatedBy"]="updated_by"
    ["usedBy"]="used_by"
    ["changedBy"]="changed_by"
)

# 函数：替换表名
replace_table_names() {
    local file="$1"
    echo -e "${YELLOW}📝 Fixing table names in: $file${NC}"

    local temp_file=$(mktemp)
    cp "$file" "$temp_file"

    # 替换表名（带引号的情况）
    for old_name in "${!TABLE_MAPPINGS[@]}"; do
        new_name="${TABLE_MAPPINGS[$old_name]}"

        # 替换 "TableName" 格式
        sed -i "s|\"$old_name\"|\"$new_name\"|g" "$temp_file"

        # 替换不带引号的TableName
        sed -i "s|\b$old_name\b|$new_name|g" "$temp_file"
    done

    mv "$temp_file" "$file"
    echo -e "${GREEN}✅ Table names fixed${NC}"
}

# 函数：替换列名
replace_column_names() {
    local file="$1"
    echo -e "${YELLOW}📝 Fixing column names in: $file${NC}"

    local temp_file=$(mktemp)
    cp "$file" "$temp_file"

    # 替换列名（带引号的情况）
    for old_name in "${!COLUMN_MAPPINGS[@]}"; do
        new_name="${COLUMN_MAPPINGS[$old_name]}"

        # 替换 "columnName" 格式
        sed -i "s|\"$old_name\"|\"$new_name\"|g" "$temp_file"
    done

    mv "$temp_file" "$file"
    echo -e "${GREEN}✅ Column names fixed${NC}"
}

# 处理billing服务
echo -e "${GREEN}🔧 Processing billing service...${NC}"

# 查找所有Go文件
find services/billing -name "*.go" -type f | while read file; do
    replace_table_names "$file"
    replace_column_names "$file"
done

# 处理其他服务的迁移文件
echo -e "${GREEN}🔧 Processing migration files...${NC}"

# 查找所有SQL迁移文件
find . -name "*.up.sql" -type f | while read file; do
    replace_table_names "$file"
    replace_column_names "$file"
done

# 处理测试文件
echo -e "${GREEN}🔧 Processing test files...${NC}"

# 查找所有测试文件
find . -name "*_test.go" -type f | while read file; do
    replace_table_names "$file"
    replace_column_names "$file"
done

echo -e "${GREEN}🎉 Schema naming fix completed!${NC}"
echo ""
echo "Summary of changes:"
echo "- Replaced PascalCase table names with snake_case"
echo "- Replaced camelCase column names with snake_case"
echo "- Updated billing service Go files"
echo "- Updated migration SQL files"
echo "- Updated test files"
echo ""
echo -e "${YELLOW}⚠️  Please review the changes and run tests to ensure correctness${NC}"