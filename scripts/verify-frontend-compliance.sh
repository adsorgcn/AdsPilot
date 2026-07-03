#!/bin/bash
#
# 前端架构合规性验证脚本
#
# 检查前端代码是否符合Google-Monetize架构要求：
# 1. 无直接Supabase数据库访问
# 2. 认证回调使用API而非直接查询
# 3. 用户数据通过API Gateway访问
#

echo "🔍 开始前端架构合规性验证..."
echo "="

FRONTEND_DIR="./apps/frontend/src"
VIOLATIONS_FOUND=0

# 检查违规模式
echo "📊 检查违规代码模式..."

# 1. 检查直接Supabase查询（排除Array.from等误报）
echo "🔍 检查直接Supabase查询..."
BAD_SUPABASE_QUERIES=$(find "$FRONTEND_DIR" -name "*.ts" -o -name "*.tsx" | xargs grep -l "\.from.*'" | grep -v "Array.from" | wc -l)
if [ "$BAD_SUPABASE_QUERIES" -gt 0 ]; then
    echo "❌ 发现 $BAD_SUPABASE_QUERIES 个文件包含直接的数据库查询"
    find "$FRONTEND_DIR" -name "*.ts" -o -name "*.tsx" | xargs grep -Hn "\.from.*'" | grep -v "Array.from" | head -10
    VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + BAD_SUPABASE_QUERIES))
else
    echo "✅ 未发现直接的数据库查询"
fi

# 2. 检查client.from查询
echo "🔍 检查client.from查询..."
CLIENT_FROM_QUERIES=$(find "$FRONTEND_DIR" -name "*.ts" -o -name "*.tsx" | xargs grep -l "client\.from" | wc -l)
if [ "$CLIENT_FROM_QUERIES" -gt 0 ]; then
    echo "❌ 发现 $CLIENT_FROM_QUERIES 个文件包含client.from()调用"
    find "$FRONTEND_DIR" -name "*.ts" -o -name "*.tsx" | xargs grep -Hn "client\.from" | head -10
    VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + CLIENT_FROM_QUERIES))
else
    echo "✅ 未发现client.from()调用"
fi

# 3. 检查mutations.ts文件的引用
echo "🔍 检查mutations文件引用..."
MUTATIONS_IMPORTS=$(find "$FRONTEND_DIR" -name "*.ts" -o -name "*.tsx" | xargs grep -l "mutations" | wc -l)
if [ "$MUTATIONS_IMPORTS" -gt 0 ]; then
    echo "❌ 发现 $MUTATIONS_IMPORTS 个文件引用mutations"
    find "$FRONTEND_DIR" -name "*.ts" -o -name "*.tsx" | xargs grep -Hn "mutations" | head -10
    VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + MUTATIONS_IMPORTS))
else
    echo "✅ 未发现mutations文件引用"
fi

# 4. 检查是否已删除违规文件
echo "🔍 检查违规文件是否已删除..."
if [ -f "$FRONTEND_DIR/lib/user/database/mutations.ts" ]; then
    echo "❌ 违规文件仍存在: lib/user/database/mutations.ts"
    VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + 1))
else
    echo "✅ 违规文件已删除: lib/user/database/mutations.ts"
fi

if [ -f "$FRONTEND_DIR/lib/subscriptions/mutations.ts" ]; then
    echo "❌ 违规文件仍存在: lib/subscriptions/mutations.ts"
    VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + 1))
else
    echo "✅ 违规文件已删除: lib/subscriptions/mutations.ts"
fi

# 5. 检查认证回调文件是否已修复
echo "🔍 检查认证回调文件修复状态..."
AUTH_CALLBACK_FILE="$FRONTEND_DIR/app/auth/callback/route.ts"
if [ -f "$AUTH_CALLBACK_FILE" ]; then
    if grep -q "checkUserSubscription" "$AUTH_CALLBACK_FILE" && ! grep -q "\.from.*Subscription" "$AUTH_CALLBACK_FILE"; then
        echo "✅ 认证回调文件已修复，使用API查询"
    else
        echo "❌ 认证回调文件未正确修复"
        VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + 1))
    fi
else
    echo "⚠️ 认证回调文件���存在"
fi

# 6. 检查API客户端文件是否存在
echo "🔍 检查API客户端文件..."
if [ -f "$FRONTEND_DIR/lib/api/user.ts" ] && [ -f "$FRONTEND_DIR/lib/api/auth.ts" ]; then
    echo "✅ API客户端文件已创建"
else
    echo "❌ API客户端文件缺失"
    VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + 2))
fi

# 7. 检查用户profile hook是否已更新
echo "🔍 检查用户profile hook更新状态..."
USER_HOOK_FILE="$FRONTEND_DIR/lib/user/hooks/use-update-profile.ts"
if [ -f "$USER_HOOK_FILE" ]; then
    if grep -q "updateUserProfile.*from.*lib/api/user" "$USER_HOOK_FILE"; then
        echo "✅ 用户profile hook已更新为使用API"
    else
        echo "❌ 用户profile hook未正确更新"
        VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + 1))
    fi
else
    echo "⚠️ 用户profile hook文件不存在"
fi

# 计算合规性
TOTAL_FILES=$(find "$FRONTEND_DIR" -name "*.ts" -o -name "*.tsx" | wc -l)
echo
echo "📊 验证结果摘要:"
echo "="
echo "📁 扫描文件总数: $TOTAL_FILES"
echo "⚠️ 发现违规数量: $VIOLATIONS_FOUND"

if [ "$VIOLATIONS_FOUND" -eq 0 ]; then
    COMPLIANCE=100
    echo "✅ 架构合规性评分: $COMPLIANCE%"
    echo
    echo "🎉 恭喜！前端架构完全合规"
    echo "   - 无直接Supabase数据库访问"
    echo "   - 认证回调使用API Gateway"
    echo "   - 用户数据通过API访问"
    echo "   - 所有违规文件已删除"
    echo
    echo "📋 Phase 1 Critical Fixes 全部完成"
    exit 0
else
    COMPLIANCE=$((100 - (VIOLATIONS_FOUND * 10)))
    echo "❌ 架构合规性评分: $COMPLIANCE%"
    echo
    echo "🔧 需要修复的问题:"
    echo "   - 移除所有直接的数据库访问"
    echo "   - 使用API Gateway替代直接查询"
    echo "   - 删除违规的mutations文件"
    echo
    echo "📖 参考 docs/Implementation/AUTOADS_ARCHITECTURE_OPTIMIZATION_IMPLEMENTATION.md"
    exit 1
fi