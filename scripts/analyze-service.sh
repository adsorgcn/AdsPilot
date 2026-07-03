#!/bin/bash

# 服务架构分析脚本
# 用途：自动收集服务的基本信息和代码统计
# 使用：./scripts/analyze-service.sh <service-name>

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查参数
if [ $# -eq 0 ]; then
    echo -e "${RED}错误: 请提供服务名称${NC}"
    echo "使用方法: $0 <service-name>"
    echo "示例: $0 proxy-pool"
    exit 1
fi

SERVICE_NAME=$1
SERVICE_PATH="services/$SERVICE_NAME"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}服务架构分析工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查服务是否存在
if [ ! -d "$SERVICE_PATH" ]; then
    echo -e "${RED}错误: 服务不存在: $SERVICE_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 找到服务: $SERVICE_NAME${NC}"
echo ""

# 检测语言和框架
echo -e "${BLUE}[1/7] 检测技术栈...${NC}"
LANGUAGE="unknown"
FRAMEWORK="unknown"

if [ -f "$SERVICE_PATH/go.mod" ]; then
    LANGUAGE="Go"
    GO_VERSION=$(grep "^go " "$SERVICE_PATH/go.mod" | awk '{print $2}')
    echo -e "  语言: ${GREEN}Go $GO_VERSION${NC}"
    
    # 检测Go框架
    if grep -q "github.com/gin-gonic/gin" "$SERVICE_PATH/go.mod"; then
        FRAMEWORK="Gin"
    elif grep -q "github.com/go-chi/chi" "$SERVICE_PATH/go.mod"; then
        FRAMEWORK="Chi"
    elif grep -q "github.com/gorilla/mux" "$SERVICE_PATH/go.mod"; then
        FRAMEWORK="Gorilla Mux"
    fi
    echo -e "  框架: ${GREEN}$FRAMEWORK${NC}"
    
elif [ -f "$SERVICE_PATH/package.json" ]; then
    LANGUAGE="Node.js"
    NODE_VERSION=$(grep '"node":' "$SERVICE_PATH/package.json" | sed 's/.*"node": "\(.*\)".*/\1/' || echo "未指定")
    echo -e "  语言: ${GREEN}Node.js $NODE_VERSION${NC}"
    
    # 检测Node.js框架
    if grep -q '"express"' "$SERVICE_PATH/package.json"; then
        FRAMEWORK="Express"
    elif grep -q '"fastify"' "$SERVICE_PATH/package.json"; then
        FRAMEWORK="Fastify"
    elif grep -q '"next"' "$SERVICE_PATH/package.json"; then
        FRAMEWORK="Next.js"
    fi
    echo -e "  框架: ${GREEN}$FRAMEWORK${NC}"
    
elif [ -f "$SERVICE_PATH/requirements.txt" ] || [ -f "$SERVICE_PATH/pyproject.toml" ]; then
    LANGUAGE="Python"
    echo -e "  语言: ${GREEN}Python${NC}"
    
    # 检测Python框架
    if [ -f "$SERVICE_PATH/requirements.txt" ]; then
        if grep -q "flask" "$SERVICE_PATH/requirements.txt"; then
            FRAMEWORK="Flask"
        elif grep -q "fastapi" "$SERVICE_PATH/requirements.txt"; then
            FRAMEWORK="FastAPI"
        elif grep -q "django" "$SERVICE_PATH/requirements.txt"; then
            FRAMEWORK="Django"
        fi
    fi
    echo -e "  框架: ${GREEN}$FRAMEWORK${NC}"
fi

echo ""

# 检查部署配置
echo -e "${BLUE}[2/7] 检查部署配置...${NC}"
if [ -f "$SERVICE_PATH/Dockerfile" ]; then
    echo -e "  ${GREEN}✓ Dockerfile 存在${NC}"
    BASE_IMAGE=$(grep "^FROM" "$SERVICE_PATH/Dockerfile" | head -1 | awk '{print $2}')
    echo -e "    基础镜像: $BASE_IMAGE"
else
    echo -e "  ${YELLOW}⚠ Dockerfile 不存在${NC}"
fi

if [ -f "$SERVICE_PATH/.dockerignore" ]; then
    echo -e "  ${GREEN}✓ .dockerignore 存在${NC}"
else
    echo -e "  ${YELLOW}⚠ .dockerignore 不存在${NC}"
fi

echo ""

# 代码统计
echo -e "${BLUE}[3/7] 统计代码...${NC}"
if command -v cloc &> /dev/null; then
    cloc "$SERVICE_PATH" --quiet --csv | tail -n +2 | while IFS=, read -r files language blank comment code; do
        if [ "$language" != "SUM" ] && [ "$code" -gt 0 ]; then
            echo -e "  $language: ${GREEN}$code${NC} 行代码, $comment 行注释, $files 个文件"
        fi
    done
else
    echo -e "  ${YELLOW}⚠ cloc 未安装，跳过代码统计${NC}"
    echo -e "  提示: 安装 cloc 以获取详细统计 (brew install cloc)"
fi

echo ""

# 目录结构
echo -e "${BLUE}[4/7] 分析目录结构...${NC}"
if [ "$LANGUAGE" = "Go" ]; then
    echo -e "  主要目录:"
    [ -d "$SERVICE_PATH/cmd" ] && echo -e "    ${GREEN}✓ cmd/${NC} - 应用入口"
    [ -d "$SERVICE_PATH/internal" ] && echo -e "    ${GREEN}✓ internal/${NC} - 内部包"
    [ -d "$SERVICE_PATH/pkg" ] && echo -e "    ${GREEN}✓ pkg/${NC} - 公共包"
    [ -d "$SERVICE_PATH/api" ] && echo -e "    ${GREEN}✓ api/${NC} - API定义"
    [ -d "$SERVICE_PATH/test" ] && echo -e "    ${GREEN}✓ test/${NC} - 测试"
    
elif [ "$LANGUAGE" = "Node.js" ]; then
    echo -e "  主要目录:"
    [ -d "$SERVICE_PATH/src" ] && echo -e "    ${GREEN}✓ src/${NC} - 源代码"
    [ -d "$SERVICE_PATH/dist" ] && echo -e "    ${GREEN}✓ dist/${NC} - 编译输出"
    [ -d "$SERVICE_PATH/test" ] && echo -e "    ${GREEN}✓ test/${NC} - 测试"
    [ -d "$SERVICE_PATH/tests" ] && echo -e "    ${GREEN}✓ tests/${NC} - 测试"
fi

echo ""

# 检查文档
echo -e "${BLUE}[5/7] 检查文档...${NC}"
if [ -f "$SERVICE_PATH/README.md" ]; then
    README_LINES=$(wc -l < "$SERVICE_PATH/README.md")
    echo -e "  ${GREEN}✓ README.md${NC} ($README_LINES 行)"
else
    echo -e "  ${RED}✗ README.md 缺失${NC}"
fi

if [ -f "$SERVICE_PATH/.env.example" ]; then
    echo -e "  ${GREEN}✓ .env.example${NC}"
else
    echo -e "  ${YELLOW}⚠ .env.example 不存在${NC}"
fi

if [ -d "$SERVICE_PATH/docs" ]; then
    DOC_COUNT=$(find "$SERVICE_PATH/docs" -name "*.md" | wc -l)
    echo -e "  ${GREEN}✓ docs/${NC} ($DOC_COUNT 个文档)"
else
    echo -e "  ${YELLOW}⚠ docs/ 目录不存在${NC}"
fi

echo ""

# 检查测试
echo -e "${BLUE}[6/7] 检查测试...${NC}"
if [ "$LANGUAGE" = "Go" ]; then
    TEST_FILES=$(find "$SERVICE_PATH" -name "*_test.go" | wc -l)
    if [ "$TEST_FILES" -gt 0 ]; then
        echo -e "  ${GREEN}✓ 找到 $TEST_FILES 个测试文件${NC}"
        
        # 尝试运行测试并获取覆盖率
        if [ -f "$SERVICE_PATH/go.mod" ]; then
            echo -e "  ${BLUE}运行测试...${NC}"
            cd "$SERVICE_PATH"
            if go test -cover ./... 2>&1 | grep -q "coverage:"; then
                COVERAGE=$(go test -cover ./... 2>&1 | grep "coverage:" | tail -1 | sed 's/.*coverage: \([0-9.]*\)%.*/\1/')
                echo -e "  ${GREEN}✓ 测试覆盖率: $COVERAGE%${NC}"
            else
                echo -e "  ${YELLOW}⚠ 无法获取测试覆盖率${NC}"
            fi
            cd - > /dev/null
        fi
    else
        echo -e "  ${RED}✗ 未找到测试文件${NC}"
    fi
    
elif [ "$LANGUAGE" = "Node.js" ]; then
    TEST_FILES=$(find "$SERVICE_PATH" -name "*.test.ts" -o -name "*.test.js" -o -name "*.spec.ts" -o -name "*.spec.js" | wc -l)
    if [ "$TEST_FILES" -gt 0 ]; then
        echo -e "  ${GREEN}✓ 找到 $TEST_FILES 个测试文件${NC}"
    else
        echo -e "  ${RED}✗ 未找到测试文件${NC}"
    fi
    
    # 检查测试脚本
    if [ -f "$SERVICE_PATH/package.json" ]; then
        if grep -q '"test"' "$SERVICE_PATH/package.json"; then
            echo -e "  ${GREEN}✓ package.json 中定义了测试脚本${NC}"
        else
            echo -e "  ${YELLOW}⚠ package.json 中未定义测试脚本${NC}"
        fi
    fi
fi

echo ""

# 检查依赖
echo -e "${BLUE}[7/7] 分析依赖...${NC}"
if [ "$LANGUAGE" = "Go" ]; then
    if [ -f "$SERVICE_PATH/go.mod" ]; then
        DIRECT_DEPS=$(grep -c "^\s*[a-z]" "$SERVICE_PATH/go.mod" || echo "0")
        echo -e "  直接依赖: ${GREEN}$DIRECT_DEPS${NC} 个"
        
        echo -e "  主要依赖:"
        grep "^\s*github.com" "$SERVICE_PATH/go.mod" | head -5 | while read -r line; do
            echo -e "    - $line"
        done
    fi
    
elif [ "$LANGUAGE" = "Node.js" ]; then
    if [ -f "$SERVICE_PATH/package.json" ]; then
        DEPS=$(grep -c '"' "$SERVICE_PATH/package.json" | grep -A 1 '"dependencies"' || echo "0")
        DEV_DEPS=$(grep -c '"' "$SERVICE_PATH/package.json" | grep -A 1 '"devDependencies"' || echo "0")
        echo -e "  生产依赖: ${GREEN}$DEPS${NC} 个"
        echo -e "  开发依赖: ${GREEN}$DEV_DEPS${NC} 个"
    fi
fi

echo ""

# 生成摘要
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}分析摘要${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "服务名称: ${GREEN}$SERVICE_NAME${NC}"
echo -e "语言: ${GREEN}$LANGUAGE${NC}"
echo -e "框架: ${GREEN}$FRAMEWORK${NC}"
echo -e "位置: ${GREEN}$SERVICE_PATH${NC}"
echo ""

# 生成建议
echo -e "${YELLOW}建议:${NC}"
[ ! -f "$SERVICE_PATH/README.md" ] && echo -e "  ${YELLOW}• 添加 README.md 文档${NC}"
[ ! -f "$SERVICE_PATH/.env.example" ] && echo -e "  ${YELLOW}• 添加 .env.example 配置示例${NC}"
[ ! -f "$SERVICE_PATH/Dockerfile" ] && echo -e "  ${YELLOW}• 添加 Dockerfile${NC}"
[ ! -d "$SERVICE_PATH/docs" ] && echo -e "  ${YELLOW}• 创建 docs/ 目录存放文档${NC}"

if [ "$LANGUAGE" = "Go" ]; then
    TEST_FILES=$(find "$SERVICE_PATH" -name "*_test.go" | wc -l)
    [ "$TEST_FILES" -eq 0 ] && echo -e "  ${YELLOW}• 添加单元测试${NC}"
elif [ "$LANGUAGE" = "Node.js" ]; then
    TEST_FILES=$(find "$SERVICE_PATH" -name "*.test.*" -o -name "*.spec.*" | wc -l)
    [ "$TEST_FILES" -eq 0 ] && echo -e "  ${YELLOW}• 添加单元测试${NC}"
fi

echo ""
echo -e "${GREEN}✓ 分析完成！${NC}"
echo ""
echo -e "下一步:"
echo -e "  1. 查看完整分析报告模板: ${BLUE}docs/ArchitectureReviewV1/templates/service-analysis-template.md${NC}"
echo -e "  2. 使用检查清单: ${BLUE}docs/ArchitectureReviewV1/templates/analysis-checklist.md${NC}"
echo -e "  3. 创建分析报告: ${BLUE}docs/ArchitectureReviewV1/${SERVICE_NAME}-analysis.md${NC}"
echo ""
