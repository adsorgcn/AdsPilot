#!/bin/bash

# ========================================
# 安全的 AUTH_SECRET 配置脚本
# 生成并安全存储 NextAuth 密钥
# ========================================

set -e

echo "🔐 设置安全的 AUTH_SECRET 配置"
echo "=============================="

# 检查是否安装了必要工具
if ! command -v openssl &> /dev/null; then
    echo "❌ 需要安装 openssl"
    exit 1
fi

# 生成新的安全密钥
echo "生成新的 64 字符安全密钥..."
NEW_SECRET=$(openssl rand -hex 32)

echo "✅ 新密钥已生成 (长度: ${#NEW_SECRET})"

# 备份现有配置
echo ""
echo "备份现有配置..."
if [ -f .env.local ]; then
    cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ .env.local 已备份"
fi

if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ .env 已备份"
fi

# 创建安全的环境变量文件
echo ""
echo "创建安全配置..."

# 更新 .env.local (开发环境)
if [ -f .env.local ]; then
    # 替换现有的 AUTH_SECRET
    if grep -q "AUTH_SECRET=" .env.local; then
        sed -i.tmp "s/AUTH_SECRET=.*/AUTH_SECRET=\"$NEW_SECRET\"/" .env.local
        rm -f .env.local.tmp
        echo "✅ 已更新 .env.local 中的 AUTH_SECRET"
    else
        echo "AUTH_SECRET=\"$NEW_SECRET\"" >> .env.local
        echo "✅ 已添加 AUTH_SECRET 到 .env.local"
    fi
fi

# 更新 .env (通用配置)
if [ -f .env ]; then
    if grep -q "AUTH_SECRET=" .env; then
        sed -i.tmp "s/AUTH_SECRET=.*/AUTH_SECRET=\"$NEW_SECRET\"/" .env
        rm -f .env.tmp
        echo "✅ 已更新 .env 中的 AUTH_SECRET"
    else
        echo "AUTH_SECRET=\"$NEW_SECRET\"" >> .env
        echo "✅ 已添加 AUTH_SECRET 到 .env"
    fi
fi

# 创建生产环境模板
cat > .env.production.template << EOF
# 生产环境配置模板
# 复制此文件为 .env.production 并填入真实值

# NextAuth v5 配置
AUTH_SECRET="CHANGE_THIS_IN_PRODUCTION"
AUTH_URL="https://yourdomain.com"
AUTH_TRUST_HOST="false"

# Google OAuth (生产环境)
AUTH_GOOGLE_ID="your-production-google-client-id"
AUTH_GOOGLE_SECRET="your-production-google-client-secret"

# 数据库 (生产环境)
DATABASE_URL="postgresql://user:password@host:port/database"
REDIS_URL="redis://user:password@host:port"
EOF

echo "✅ 已创建 .env.production.template"

# 验证 .gitignore 配置
echo ""
echo "验证 Git 安全配置..."

GITIGNORE_ENTRIES=(
    ".env"
    ".env.local" 
    ".env.production"
    ".env.*.local"
    "*.key"
    "*.pem"
)

for entry in "${GITIGNORE_ENTRIES[@]}"; do
    if grep -q "^$entry$" .gitignore 2>/dev/null; then
        echo "✅ $entry 已在 .gitignore 中"
    else
        echo "$entry" >> .gitignore
        echo "✅ 已添加 $entry 到 .gitignore"
    fi
done

# 创建密钥管理脚本
cat > scripts/rotate-auth-secret.sh << 'EOF'
#!/bin/bash
# AUTH_SECRET 轮换脚本

echo "🔄 轮换 AUTH_SECRET..."

# 生成新密钥
NEW_SECRET=$(openssl rand -hex 32)

# 备份
cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)

# 更新
sed -i.tmp "s/AUTH_SECRET=.*/AUTH_SECRET=\"$NEW_SECRET\"/" .env.local
rm -f .env.local.tmp

echo "✅ AUTH_SECRET 已轮换"
echo "⚠️  所有用户需要重新登录"
EOF

chmod +x scripts/rotate-auth-secret.sh
echo "✅ 已创建密钥轮换脚本"

# 安全检查
echo ""
echo "🔍 安全检查..."

# 检查是否有密钥泄漏到 git 历史
if git log --all --full-history -- .env* 2>/dev/null | grep -q "AUTH_SECRET"; then
    echo "⚠️  警告：Git 历史中可能包含旧的 AUTH_SECRET"
    echo "   建议清理 Git 历史或轮换密钥"
fi

# 检查文件权限
if [ -f .env.local ]; then
    chmod 600 .env.local
    echo "✅ 已设置 .env.local 文件权限为 600"
fi

if [ -f .env ]; then
    chmod 600 .env  
    echo "✅ 已设置 .env 文件权限为 600"
fi

echo ""
echo "📋 安全建议："
echo "============"
echo "1. 定期轮换 AUTH_SECRET (使用 ./scripts/rotate-auth-secret.sh)"
echo "2. 生产环境使用不同的密钥"
echo "3. 监控访问日志异常活动"
echo "4. 使用密钥管理服务 (AWS Secrets Manager, Azure Key Vault)"
echo "5. 启用双因素认证"

echo ""
echo "🚨 紧急情况："
echo "============"
echo "如果怀疑密钥泄漏："
echo "1. 立即运行: ./scripts/rotate-auth-secret.sh"
echo "2. 重启应用程序"
echo "3. 强制所有用户重新登录"
echo "4. 检查访问日志"

echo ""
echo "✅ 安全配置完成！"
echo "新的 AUTH_SECRET 已设置，长度: ${#NEW_SECRET} 字符"