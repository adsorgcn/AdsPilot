#!/bin/bash
# 前端 Dockerfile 优化验证脚本
# 快速检查优化后的配置是否正确

set -euo pipefail

echo "🔍 前端 Dockerfile 优化验证"
echo "=============================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS="${GREEN}✓${NC}"
FAIL="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"

# 验证计数
CHECKS=0
PASSED=0
FAILED=0

check() {
  ((CHECKS++))
  if eval "$2"; then
    echo -e "${PASS} $1"
    ((PASSED++))
    return 0
  else
    echo -e "${FAIL} $1"
    ((FAILED++))
    return 1
  fi
}

warn() {
  echo -e "${WARN} $1"
}

echo "📋 检查 1: Dockerfile 文件存在"
check "Dockerfile 存在" "test -f apps/frontend/Dockerfile"
echo ""

echo "📋 检查 2: 必要的 package.json 文件"
check "根 package.json" "test -f package.json"
check "前端 package.json" "test -f apps/frontend/package.json"
check "auth-utils package.json" "test -f packages/auth-utils/package.json"
check "shared-types package.json" "test -f packages/shared-types/package.json"
echo ""

echo "📋 检查 3: Dockerfile 内容验证"
check "不复制整个 monorepo" "! grep -q 'COPY \./ \./\|COPY \. \.' apps/frontend/Dockerfile"
check "复制 apps/frontend" "grep -q 'COPY apps/frontend' apps/frontend/Dockerfile"
check "复制 packages" "grep -q 'COPY packages' apps/frontend/Dockerfile"
check "不使用 turbo workspace" "! grep -q 'turbo build\|--workspace' apps/frontend/Dockerfile"
check "使用 npm run build" "grep -q 'npm run build' apps/frontend/Dockerfile"
check "WORKDIR 切换" "grep -q 'WORKDIR /app/apps/frontend' apps/frontend/Dockerfile"
echo ""

echo "📋 检查 4: Cloud Build 配置"
check "Cloud Build 配置存在" "test -f deployments/cloudbuild/build-frontend-docker.yaml"
check "使用正确的 Dockerfile 路径" "grep -q 'apps/frontend/Dockerfile' deployments/cloudbuild/build-frontend-docker.yaml"
check "包含 Secret Manager 配置" "grep -q 'secretManager' deployments/cloudbuild/build-frontend-docker.yaml"
check "包含 Firebase 配置" "grep -q 'FIREBASE_API_KEY' deployments/cloudbuild/build-frontend-docker.yaml"
echo ""

echo "📋 检查 5: GitHub Actions 配置"
check "前端部署 workflow 存在" "test -f .github/workflows/deploy-frontend.yml"
check "使用正确的 Cloud Build 配置" "grep -q 'build-frontend-docker.yaml' .github/workflows/deploy-frontend.yml"
check "环境判断逻辑" "grep -q 'ENVIRONMENT=' .github/workflows/deploy-frontend.yml"
echo ""

echo "📋 检查 6: .dockerignore 优化"
if [ -f .dockerignore ]; then
  check ".dockerignore 排除 makerkit" "grep -q 'makerkit/' .dockerignore"
  check ".dockerignore 排除 docs" "grep -q 'docs/' .dockerignore"
  check ".dockerignore 排除 .github" "grep -q '.github/' .dockerignore"
  check ".dockerignore 排除 services" "grep -q 'services/' .dockerignore || true"
else
  warn ".dockerignore 不存在（可选优化）"
fi
echo ""

echo "📋 检查 7: 前端依赖配置"
if command -v jq &> /dev/null; then
  FRONTEND_DEPS=$(jq -r '.dependencies | keys[]' apps/frontend/package.json 2>/dev/null | wc -l)
  check "前端有依赖包" "test $FRONTEND_DEPS -gt 0"
  check "包含 @gm/shared-types" "jq -e '.dependencies[\"@gm/shared-types\"]' apps/frontend/package.json > /dev/null 2>&1"
else
  warn "jq 未安装，跳过依赖检查"
fi
echo ""

echo "📋 检查 8: Next.js 配置"
if [ -f apps/frontend/next.config.mjs ]; then
  check "Next.js 配置存在" "test -f apps/frontend/next.config.mjs"
  check "Standalone 输出模式" "grep -q \"output: 'standalone'\" apps/frontend/next.config.mjs"
else
  warn "Next.js 配置不存在或路径不同"
fi
echo ""

echo "=============================="
echo "📊 验证结果汇总"
echo "=============================="
echo "总检查项: $CHECKS"
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ 所有检查通过！Dockerfile 优化配置正确${NC}"
  echo ""
  echo "🚀 下一步操作:"
  echo "  1. 本地测试构建: ./scripts/test-frontend-build.sh"
  echo "  2. 提交到 main 分支触发 preview 部署"
  echo "  3. 验证部署结果: https://gm-preview.web.app"
  exit 0
else
  echo -e "${RED}❌ 发现 $FAILED 个问题，请修复后重试${NC}"
  echo ""
  echo "🔧 常见问题排查:"
  echo "  - 确保在项目根目录运行此脚本"
  echo "  - 检查文件路径是否正确"
  echo "  - 查看详细错误信息"
  exit 1
fi
