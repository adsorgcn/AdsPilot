#!/bin/bash
set -euo pipefail

# 快速密码更换脚本（方案3：不清理Git历史）
# 适用于私有仓库或小团队

echo "🔐 快速密码更换脚本"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${YELLOW}此脚本将帮助你更换泄露的密码，无需清理Git历史${NC}"
echo ""

# 检查环境变量
if [ -z "${SUPABASE_DB_URL:-}" ]; then
    echo -e "${RED}错误: SUPABASE_DB_URL 环境变量未设置${NC}"
    echo ""
    echo "请先设置Supabase数据库连接URL:"
    echo "  export SUPABASE_DB_URL='postgresql://...'"
    echo ""
    echo "或者从Secret Manager获取:"
    echo "  export SUPABASE_DB_URL=\$(gcloud secrets versions access latest --secret=supabase-db-url)"
    exit 1
fi

echo "✅ Supabase数据库连接已配置"
echo ""

# 生成强密码
echo -e "${YELLOW}生成新的管理员密码...${NC}"
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-24)
echo ""
echo -e "${GREEN}新密码: $NEW_PASSWORD${NC}"
echo ""
echo -e "${YELLOW}请妥善保存此密码！${NC}"
echo ""

read -p "是否使用此密码？(y/n) " use_generated
if [ "$use_generated" != "y" ]; then
    read -s -p "请输入自定义密码: " NEW_PASSWORD
    echo ""
fi

echo ""
echo -e "${YELLOW}第1步: 更新Supabase数据库中的管理员密码${NC}"

# 更新密码
psql "$SUPABASE_DB_URL" << EOF
UPDATE auth.users
SET encrypted_password = crypt('$NEW_PASSWORD', gen_salt('bf'))
WHERE email = 'admin@scientificinternet.com';

-- 验证更新
SELECT id, email, created_at, updated_at
FROM auth.users
WHERE email = 'admin@scientificinternet.com';
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 管理员密码已成功更新${NC}"
else
    echo -e "${RED}❌ 密码更新失败${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}第2步: 更新环境变量${NC}"

# 更新.env.local
ENV_FILE=".env.local"
if [ -f "$ENV_FILE" ]; then
    # 备份原文件
    cp "$ENV_FILE" "${ENV_FILE}.backup-$(date +%Y%m%d-%H%M%S)"

    # 更新或添加ADMIN_PASSWORD
    if grep -q "^ADMIN_PASSWORD=" "$ENV_FILE"; then
        sed -i.bak "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$NEW_PASSWORD|" "$ENV_FILE"
        rm "${ENV_FILE}.bak"
        echo "✅ 已更新 $ENV_FILE 中的 ADMIN_PASSWORD"
    else
        echo "" >> "$ENV_FILE"
        echo "# Admin Password (Updated $(date +%Y-%m-%d))" >> "$ENV_FILE"
        echo "ADMIN_PASSWORD=$NEW_PASSWORD" >> "$ENV_FILE"
        echo "✅ 已添加 ADMIN_PASSWORD 到 $ENV_FILE"
    fi
else
    echo "创建新的 $ENV_FILE"
    cat > "$ENV_FILE" << ENVEOF
# Admin Password (Created $(date +%Y-%m-%d))
ADMIN_PASSWORD=$NEW_PASSWORD
ENVEOF
    echo "✅ 已创建 $ENV_FILE"
fi

# 导出环境变量
export ADMIN_PASSWORD="$NEW_PASSWORD"
echo "✅ 已导出 ADMIN_PASSWORD 环境变量（当前会话）"

echo ""
echo -e "${YELLOW}第3步: 更新Secret Manager（可选）${NC}"
echo ""
echo "如果你在GCP Secret Manager中存储密码，运行:"
echo "  echo -n '$NEW_PASSWORD' | gcloud secrets versions add ADMIN_PASSWORD --data-file=-"
echo ""

read -p "是否现在更新Secret Manager？(y/n) " update_secret
if [ "$update_secret" = "y" ]; then
    echo -n "$NEW_PASSWORD" | gcloud secrets versions add ADMIN_PASSWORD --data-file=-
    echo "✅ Secret Manager已更新"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ 密码更换完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "新的管理员登录信息:"
echo "  邮箱: admin@scientificinternet.com"
echo "  密码: $NEW_PASSWORD"
echo ""
echo -e "${YELLOW}请立即测试新密码:${NC}"
echo "  1. 访问: /auth/admin-signin"
echo "  2. 使用新密码登录"
echo ""
echo -e "${YELLOW}后续步骤:${NC}"
echo "  • 更新所有环境（preview, production）的 ADMIN_PASSWORD"
echo "  • 通知团队成员密码已更换"
echo "  • 更新运维文档"
echo ""
echo "备份文件位置: ${ENV_FILE}.backup-*"
echo ""
