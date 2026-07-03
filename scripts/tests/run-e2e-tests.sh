#!/bin/bash

# Google-Monetize 前端E2E测试批量执行脚本
# 用途: 一键运行所有Playwright E2E测试

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 测试环境: www.urlchecker.dev (预发) | www.${APP_DOMAIN} (生产)
BASE_URL="${PREVIEW_BASE:-https://www.urlchecker.dev}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Google-Monetize 前端E2E测试执行器"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 测试环境: $BASE_URL"
echo ""

# 测试结果统计
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_TESTS=0

# 运行单个测试并收集结果
run_test() {
  local test_file=$1
  local test_name=$2

  echo ""
  echo "▶️  运行测试: $test_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if node "$SCRIPT_DIR/$test_file" 2>&1; then
    echo "✅ $test_name: 通过"
    TOTAL_PASSED=$((TOTAL_PASSED + 1))
  else
    echo "❌ $test_name: 失败"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi

  TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Phase 1: 无需登录测试
run_phase_1() {
  echo ""
  echo "🚀 Phase 1: 无需登录测试"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  run_test "test-frontend-complete.mjs" "基础E2E测试"
  run_test "test-web-vitals.mjs" "Web Vitals性能测试"
}

# Phase 2: 需要登录测试 (需要程序化登录API)
run_phase_2() {
  echo ""
  echo "🔐 Phase 2: 需要登录测试"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "⚠️  这些测试需要程序化登录API支持"
  echo "   API: POST /api/test/create-session"
  echo ""

  # 检查程序化登录API是否可用
  if ! curl -s -f -X POST "$BASE_URL/api/test/create-session" \
       -H "Content-Type: application/json" \
       -d '{"email":"test-user@${APP_DOMAIN}","role":"user"}' > /dev/null 2>&1; then
    echo "❌ 程序化登录API不可用,跳过Phase 2测试"
    echo "   请先实现后端API: POST /api/test/create-session"
    return 1
  fi

  echo "✅ 程序化登录API可用,开始执行测试..."
  echo ""

  run_test "test-login-flow.mjs" "登录流程测试"
  run_test "test-dashboard-overview.mjs" "Dashboard概览测试"
  run_test "test-offer-filtering.mjs" "Offer筛选测试"
  run_test "test-bulk-operations.mjs" "批量操作测试"
  run_test "test-create-offer.mjs" "创建Offer测试"
  run_test "test-ai-evaluation.mjs" "AI评估测试"
  run_test "test-task-management.mjs" "任务管理测试"
  run_test "test-ads-center-operations.mjs" "广告中心测试"
  run_test "test-bind-ads-account.mjs" "绑定账户测试"
  run_test "test-subscription-management.mjs" "订阅管理测试"
  run_test "test-token-management.mjs" "Token管理测试"
}

# 打印汇总报告
print_summary() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 测试执行汇总"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ 通过: $TOTAL_PASSED"
  echo "❌ 失败: $TOTAL_FAILED"
  echo "📈 总计: $TOTAL_TESTS"

  if [ $TOTAL_FAILED -eq 0 ]; then
    echo "🎉 所有测试通过!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
  else
    PASS_RATE=$((TOTAL_PASSED * 100 / TOTAL_TESTS))
    echo "⚠️  通过率: ${PASS_RATE}%"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
  fi
}

# 主函数
main() {
  case "${1:-all}" in
    phase1|p1)
      run_phase_1
      ;;
    phase2|p2)
      run_phase_2
      ;;
    all)
      run_phase_1
      run_phase_2 || echo "⏸️  Phase 2测试已跳过"
      ;;
    help|--help|-h)
      echo "用法: $0 [phase1|phase2|all]"
      echo ""
      echo "选项:"
      echo "  phase1, p1    只运行Phase 1测试 (无需登录)"
      echo "  phase2, p2    只运行Phase 2测试 (需要登录)"
      echo "  all           运行所有测试 (默认)"
      echo "  help          显示此帮助信息"
      echo ""
      echo "示例:"
      echo "  $0              # 运行所有测试"
      echo "  $0 phase1       # 只运行无需登录测试"
      echo "  $0 phase2       # 只运行需要登录测试"
      exit 0
      ;;
    *)
      echo "❌ 未知选项: $1"
      echo "使用 '$0 help' 查看帮助"
      exit 1
      ;;
  esac

  print_summary
}

# 执行主函数
main "$@"
