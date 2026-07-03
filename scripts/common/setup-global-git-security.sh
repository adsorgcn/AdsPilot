#!/bin/bash

# 配置 Git 全局敏感信息检测
echo "配置 Git 全局敏感信息检测..."

# 创建全局 gitignore 模板
mkdir -p ~/.git-templates/hooks

# 创建全局 pre-commit 模板
cat > ~/.git-templates/hooks/pre-commit << 'EOF'
#!/bin/bash

# 全局敏感信息检查
echo "🔍 全局敏感信息检查..."

# 检查常见敏感信息模式
if git diff --cached | grep -q -E "(DATABASE_URL|REDIS_URL|AUTH_SECRET|AUTH_GOOGLE_ID|AUTH_GOOGLE_SECRET|password|secret|key|token|credential)"; then
    echo "⚠️  警告：提交可能包含敏感信息！"
    echo "请检查并移除敏感信息后重试。"
    echo "或使用 --no-verify 跳过检查（不推荐）"
    exit 1
fi

echo "✅ 全局敏感信息检查通过"
EOF

chmod +x ~/.git-templates/hooks/pre-commit

# 配置 Git 使用模板
git config --global init.templateDir ~/.git-templates

echo "✅ Git 全局敏感信息检测已配置"
echo "新克隆的仓库将自动应用这些规则"