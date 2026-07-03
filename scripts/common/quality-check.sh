#!/bin/bash

# 代码质量检查脚本

set -e

echo "🔍 开始代码质量检查..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_step() {
    local step_name="$1"
    local command="$2"
    
    echo -e "\n📋 检查: ${YELLOW}${step_name}${NC}"
    
    if eval "$command"; then
        echo -e "✅ ${GREEN}${step_name} 通过${NC}"
        return 0
    else
        echo -e "❌ ${RED}${step_name} 失败${NC}"
        return 1
    fi
}

# 初始化错误计数
errors=0

# 1. TypeScript类型检查
if ! check_step "TypeScript类型检查" "npm run type-check"; then
    ((errors++))
fi

# 2. ESLint代码检查
if ! check_step "ESLint代码检查" "npm run lint"; then
    ((errors++))
fi

# 3. Prettier格式检查
if ! check_step "Prettier格式检查" "npm run format:check"; then
    ((errors++))
fi

# 4. 单元测试
if ! check_step "单元测试" "npm run test:unit -- --silent"; then
    ((errors++))
fi

# 5. 测试覆盖率检查
if ! check_step "测试覆盖率检查" "npm run test:coverage -- --silent"; then
    ((errors++))
fi

# 6. 构建检查
if ! check_step "构建检查" "npm run build"; then
    ((errors++))
fi

# 7. 依赖安全检查
if ! check_step "依赖安全检查" "npm audit --audit-level=high"; then
    echo -e "${YELLOW}⚠️  发现安全漏洞，请运行 'npm audit fix' 修复${NC}"
    ((errors++))
fi

# 8. 包大小检查
if command -v bundlesize >/dev/null 2>&1; then
    if ! check_step "包大小检查" "bundlesize"; then
        ((errors++))
    fi
else
    echo -e "${YELLOW}⚠️  bundlesize 未安装，跳过包大小检查${NC}"
fi

# 总结
echo -e "\n📊 质量检查总结:"
echo "================================"

if [ $errors -eq 0 ]; then
    echo -e "🎉 ${GREEN}所有检查都通过了！代码质量良好。${NC}"
    exit 0
else
    echo -e "💥 ${RED}发现 $errors 个问题需要修复。${NC}"
    echo -e "\n🔧 修复建议:"
    echo "- 运行 'npm run lint -- --fix' 自动修复ESLint问题"
    echo "- 运行 'npm run format' 自动格式化代码"
    echo "- 检查TypeScript错误并修复类型问题"
    echo "- 添加或修复测试以提高覆盖率"
    echo "- 运行 'npm audit fix' 修复安全漏洞"
    exit 1
fi