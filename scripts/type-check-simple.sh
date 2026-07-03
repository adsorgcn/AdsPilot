#!/bin/bash

# 简化的 TypeScript 类型检查脚本
# 用于 GitHub Actions 中的类型验证

set -e

echo "🔍 Starting simplified TypeScript validation..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查必要的依赖
echo -e "${BLUE}🔧 Checking dependencies...${NC}"
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx not found. Please install Node.js${NC}"
    exit 1
fi

if ! npx tsc --version &> /dev/null; then
    echo -e "${RED}❌ TypeScript compiler not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies check passed${NC}"

# 运行 TypeScript 检查
echo -e "${BLUE}📝 Running TypeScript compilation check...${NC}"
echo -e "${BLUE}🔍 TypeScript version: $(npx tsc --version)${NC}"

# 确保在正确的目录下运行
if [ -d "apps/frontend" ]; then
    echo -e "${BLUE}📁 Changing to apps/frontend directory${NC}"
    cd apps/frontend
elif [ ! -f "tsconfig.json" ]; then
    echo -e "${RED}❌ tsconfig.json not found in current directory${NC}"
    exit 1
fi

# 优先使用轻量配置（若存在）
TSCONFIG_ARG=""
if [ -f "tsconfig.typecheck.json" ]; then
    TSCONFIG_ARG="-p tsconfig.typecheck.json"
fi

# 使用 --skipLibCheck 来加快检查速度，并增加内存限制
if NODE_OPTIONS="--max-old-space-size=4096" npx tsc $TSCONFIG_ARG --noEmit --skipLibCheck; then
    echo -e "${GREEN}✅ TypeScript check passed${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ TypeScript check failed${NC}"
    echo -e "${YELLOW}📋 Running detailed check...${NC}"
    NODE_OPTIONS="--max-old-space-size=4096" npx tsc $TSCONFIG_ARG --noEmit --skipLibCheck --noErrorTruncation | head -50
    exit 1
fi
