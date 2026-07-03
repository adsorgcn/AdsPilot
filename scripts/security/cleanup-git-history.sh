#!/bin/bash
set -euo pipefail

# Git历史清理脚本
# ⚠️  警告: 这是一个高风险操作，会重写Git历史
# 使用前请阅读: docs/GIT_HISTORY_CLEANUP_GUIDE.md

echo "🔐 Git历史敏感信息清理脚本"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -d ".git" ]; then
    echo -e "${RED}错误: 必须在Git仓库根目录运行此脚本${NC}"
    exit 1
fi

# 显示警告
echo -e "${RED}⚠️  警告: 此操作将重写整个Git历史${NC}"
echo ""
echo "影响:"
echo "  • 所有commit hash会改变"
echo "  • 需要强制推送到远程仓库"
echo "  • 团队成员需要重新克隆仓库"
echo "  • 所有PR和issue引用会失效"
echo ""

# 确认
read -p "你确定要继续吗？输入 'YES' 继续: " confirm
if [ "$confirm" != "YES" ]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo -e "${YELLOW}第1步: 检查工具${NC}"

# 检查git-filter-repo是否已安装
if ! command -v git-filter-repo &> /dev/null; then
    echo "git-filter-repo 未安装，尝试安装..."

    if command -v pip3 &> /dev/null; then
        pip3 install git-filter-repo
    elif command -v pip &> /dev/null; then
        pip install git-filter-repo
    else
        echo -e "${RED}错误: 无法安装git-filter-repo，请手动安装:${NC}"
        echo "  pip3 install git-filter-repo"
        exit 1
    fi
fi

echo "✅ git-filter-repo 已安装"

echo ""
echo -e "${YELLOW}第2步: 创建备份${NC}"

# 创建备份目录
BACKUP_DIR="../gm-backup-$(date +%Y%m%d-%H%M%S)"
echo "备份位置: $BACKUP_DIR"

# 创建完整备份
git clone --mirror . "$BACKUP_DIR"
echo "✅ 备份完成: $BACKUP_DIR"

# 记录当前HEAD
ORIGINAL_HEAD=$(git rev-parse HEAD)
echo "$ORIGINAL_HEAD" > /tmp/gm-original-head.txt
echo "✅ 记录当前HEAD: $ORIGINAL_HEAD"

echo ""
echo -e "${YELLOW}第3步: 准备替换规则${NC}"

# 创建替换文件
REPLACE_FILE="/tmp/gm-replacements.txt"
cat > "$REPLACE_FILE" << 'EOF'
# 替换硬编码的管理员密码
***REDACTED***==>***REDACTED_ADMIN_PASSWORD***

# 替换硬编码的Supabase Anon Key
<REDACTED_JWT_ROTATED>==>***REDACTED_SUPABASE_ANON_KEY***
EOF

echo "✅ 替换规则已创建"
cat "$REPLACE_FILE"

echo ""
echo -e "${YELLOW}第4步: 执行清理${NC}"
echo "这可能需要几分钟..."

# 执行清理
git filter-repo --replace-text "$REPLACE_FILE" --force

echo "✅ 历史清理完成"

echo ""
echo -e "${YELLOW}第5步: 验证清理结果${NC}"

# 验证是否还有敏感信息
echo "检查管理员密码..."
if git log --all -S "REDACTED_PATTERN" --oneline 2>/dev/null | grep -q .; then
    echo -e "${RED}⚠️  警告: 仍然发现管理员密码残留${NC}"
    git log --all -S "REDACTED_PATTERN" --oneline | head -5
else
    echo -e "${GREEN}✅ 未发现管理员密码残留${NC}"
fi

echo ""
echo "检查Supabase Key..."
if git log --all -S "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --oneline 2>/dev/null | grep -q .; then
    echo -e "${YELLOW}⚠️  发现Supabase Key（可能在文档中，这是正常的）${NC}"
    git log --all -S "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --oneline | head -5
else
    echo -e "${GREEN}✅ 未发现Supabase Key残留${NC}"
fi

echo ""
echo -e "${YELLOW}第6步: 重新添加远程仓库${NC}"

# git filter-repo会删除所有远程，需要重新添加
REMOTE_URL=$(cd "$BACKUP_DIR" && git remote get-url origin 2>/dev/null || echo "")

if [ -n "$REMOTE_URL" ]; then
    git remote add origin "$REMOTE_URL"
    echo "✅ 已重新添加远程仓库: $REMOTE_URL"
else
    echo -e "${YELLOW}⚠️  无法自动获取远程仓库地址，请手动添加:${NC}"
    echo "  git remote add origin git@github.com:ScientificInternet/Google-Monetize.git"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Git历史清理完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "接下来的步骤:"
echo ""
echo "1. 验证清理结果:"
echo "   git log --oneline | head -20"
echo "   git fsck --full"
echo ""
echo "2. 强制推送到远程仓库（⚠️ 危险操作）:"
echo "   git push --force --all"
echo "   git push --force --tags"
echo ""
echo "3. 通知团队成员重新克隆仓库:"
echo "   rm -rf gm"
echo "   git clone git@github.com:ScientificInternet/Google-Monetize.git"
echo ""
echo "4. 立即更换所有密码（最重要）:"
echo "   • 更换管理员密码"
echo "   • 轮换Supabase密钥（如需要）"
echo ""
echo -e "${YELLOW}备份位置: $BACKUP_DIR${NC}"
echo ""
echo "如果需要恢复备份:"
echo "  cd $BACKUP_DIR"
echo "  git push --force --all"
echo "  git push --force --tags"
echo ""
