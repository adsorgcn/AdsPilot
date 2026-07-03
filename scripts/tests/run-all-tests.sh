#!/bin/bash

# 测试环境: www.urlchecker.dev (预发) | www.${APP_DOMAIN} (生产)
BASE_URL="${PREVIEW_BASE:-https://www.urlchecker.dev}"
PASSED=0
FAILED=0

echo "🧪 开始前端综合测试"
echo "📍 测试环境: $BASE_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1: 重定向测试
echo -e "\n📋 Test 1: HTTP 重定向链路"
REDIRECTS=$(curl -ILs $BASE_URL/ 2>&1 | grep -c "HTTP")
if [ "$REDIRECTS" -le 2 ]; then
  echo "✅ 通过: 重定向次数 = $REDIRECTS"
  ((PASSED++))
else
  echo "❌ 失败: 重定向次数过多 = $REDIRECTS"
  ((FAILED++))
fi

# Test 2: 品牌名测试
echo -e "\n📋 Test 2: 品牌名一致性"
MAKERKIT_COUNT=$(curl -s $BASE_URL/ 2>&1 | grep -ic "makerkit" || echo "0")
if [ "$MAKERKIT_COUNT" -eq 0 ]; then
  echo "✅ 通过: 无 Makerkit 残留"
  ((PASSED++))
else
  echo "❌ 失败: 发现 $MAKERKIT_COUNT 处 Makerkit"
  ((FAILED++))
fi

# Test 3: 中文导航栏
echo -e "\n📋 Test 3: 中文导航栏翻译"
ZH_FEATURES=$(curl -s $BASE_URL/zh-CN/ 2>&1 | grep -o "功能" | wc -l | tr -d ' ')
if [ "$ZH_FEATURES" -gt 0 ]; then
  echo "✅ 通过: 中文导航栏正确显示（找到 $ZH_FEATURES 处'功能'）"
  ((PASSED++))
else
  echo "❌ 失败: 中文导航栏未翻译"
  ((FAILED++))
fi

# Test 4: 受保护路由
echo -e "\n📋 Test 4: 认证守卫"
DASHBOARD_REDIRECT=$(curl -Ls -o /dev/null -w "%{url_effective}" $BASE_URL/dashboard 2>&1)
if [[ "$DASHBOARD_REDIRECT" == *"/auth"* ]]; then
  echo "✅ 通过: Dashboard 正确重定向到登录页"
  echo "   → $DASHBOARD_REDIRECT"
  ((PASSED++))
else
  echo "❌ 失败: Dashboard 未正确保护"
  echo "   → $DASHBOARD_REDIRECT"
  ((FAILED++))
fi

# Test 5: SEO 元数据
echo -e "\n📋 Test 5: SEO 元数据"
META_COUNT=$(curl -s $BASE_URL/ 2>&1 | grep -c '<meta name="description"' || echo "0")
if [ "$META_COUNT" -gt 0 ]; then
  echo "✅ 通过: SEO 元数据存在"
  ((PASSED++))
else
  echo "❌ 失败: 缺少 SEO 元数据"
  ((FAILED++))
fi

# Test 6: 登录页面可访问
echo -e "\n📋 Test 6: 登录页面可访问性"
LOGIN_STATUS=$(curl -o /dev/null -s -w "%{http_code}" $BASE_URL/auth 2>&1)
if [ "$LOGIN_STATUS" = "200" ]; then
  echo "✅ 通过: 登录页面返回 200"
  ((PASSED++))
else
  echo "❌ 失败: 登录页面返回 $LOGIN_STATUS"
  ((FAILED++))
fi

# Test 7: 静态资源
echo -e "\n📋 Test 7: Logo 静态资源"
LOGO_STATUS=$(curl -o /dev/null -s -w "%{http_code}" $BASE_URL/assets/images/favicon/logo.png 2>&1)
if [ "$LOGO_STATUS" = "200" ]; then
  echo "✅ 通过: Logo 可访问"
  ((PASSED++))
else
  echo "❌ 失败: Logo 返回 $LOGO_STATUS"
  ((FAILED++))
fi

# Test 8: 公开页面测试
echo -e "\n📋 Test 8: 公开页面可访问性"
PUBLIC_PAGES=("features" "pricing" "case-studies" "support")
PUBLIC_PASSED=0
PUBLIC_TOTAL=${#PUBLIC_PAGES[@]}

for page in "${PUBLIC_PAGES[@]}"; do
  status=$(curl -o /dev/null -s -w "%{http_code}" $BASE_URL/$page 2>&1)
  if [ "$status" = "200" ]; then
    ((PUBLIC_PASSED++))
  else
    echo "   ⚠️  /$page 返回 $status"
  fi
done

if [ "$PUBLIC_PASSED" -eq "$PUBLIC_TOTAL" ]; then
  echo "✅ 通过: 所有公开页面可访问 ($PUBLIC_PASSED/$PUBLIC_TOTAL)"
  ((PASSED++))
else
  echo "❌ 失败: 部分公开页面不可访问 ($PUBLIC_PASSED/$PUBLIC_TOTAL)"
  ((FAILED++))
fi

# 汇总
echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 测试汇总"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 通过: $PASSED"
echo "❌ 失败: $FAILED"
TOTAL=$((PASSED + FAILED))
echo "📈 通过率: $((PASSED * 100 / TOTAL))%"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
