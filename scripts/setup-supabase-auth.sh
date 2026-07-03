#!/bin/bash
set -euo pipefail

# 设置Supabase认证依赖
# 为所有Go微服务安装必要的依赖

echo "🔧 设置Supabase认证依赖..."
echo ""

# 1. 更新pkg/auth
echo "1️⃣ 更新 pkg/auth..."
cd pkg/auth
go get github.com/golang-jwt/jwt/v5@v5.2.1
go mod tidy
cd ../..
echo "   ✅ pkg/auth 已更新"
echo ""

# 2. 更新pkg/middleware
echo "2️⃣ 更新 pkg/middleware..."
cd pkg/middleware
go mod tidy
cd ../..
echo "   ✅ pkg/middleware 已更新"
echo ""

# 3. 列出所有Go服务
SERVICES=(
    "billing"
    "offer"
    "adscenter"
    "console"
    "notifications"
    "browser-exec"
    "siterank"
)

echo "3️⃣ 更新微服务依赖..."
for service in "${SERVICES[@]}"; do
    SERVICE_PATH="services/$service"
    if [ -d "$SERVICE_PATH" ]; then
        echo "   📦 更新 $service..."
        cd "$SERVICE_PATH"
        
        # 确保引用最新的pkg/auth
        if [ -f "go.mod" ]; then
            go get github.com/ScientificInternet/Google-Monetize/pkg/auth@latest || true
            go get github.com/ScientificInternet/Google-Monetize/pkg/middleware@latest || true
            go mod tidy
            echo "      ✅ $service 已更新"
        else
            echo "      ⚠️  $service 没有go.mod文件"
        fi
        
        cd ../..
    else
        echo "   ⚠️  服务目录不存在: $SERVICE_PATH"
    fi
done
echo ""

# 4. 验证安装
echo "4️⃣ 验证安装..."
cd pkg/auth
if go list -m github.com/golang-jwt/jwt/v5 &>/dev/null; then
    VERSION=$(go list -m github.com/golang-jwt/jwt/v5 | awk '{print $2}')
    echo "   ✅ golang-jwt/jwt 已安装: $VERSION"
else
    echo "   ❌ golang-jwt/jwt 未安装"
    exit 1
fi
cd ../..
echo ""

# 5. 编译测试
echo "5️⃣ 编译测试..."
cd pkg/auth
if go build ./... &>/dev/null; then
    echo "   ✅ pkg/auth 编译成功"
else
    echo "   ❌ pkg/auth 编译失败"
    exit 1
fi
cd ../..

cd pkg/middleware
if go build ./... &>/dev/null; then
    echo "   ✅ pkg/middleware 编译成功"
else
    echo "   ❌ pkg/middleware 编译失败"
    exit 1
fi
cd ../..
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Supabase认证依赖设置完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 下一步："
echo "   1. 查看使用指南: pkg/auth/SUPABASE_USAGE.md"
echo "   2. 查看集成指南: docs/MarkerkitGo/SupabaseBackendIntegration.md"
echo "   3. 更新服务代码以使用Supabase认证"
echo ""
echo "💡 示例代码:"
echo "   import \"github.com/ScientificInternet/Google-Monetize/pkg/auth\""
echo "   userID, err := auth.ExtractSupabaseUserID(ctx, r)"
echo ""
