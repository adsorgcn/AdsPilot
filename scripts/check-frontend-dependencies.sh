#!/bin/bash
set -euo pipefail

echo "🔍 检查Frontend所有依赖..."
echo ""

cd apps/frontend

# 查找所有import语句中的外部包
echo "📦 扫描所有import语句..."
imports=$(grep -rh "import.*from ['\"]" src --include="*.tsx" --include="*.ts" | \
  sed -n "s/.*from ['\"]\\([^'\"]*\\)['\"].*/\\1/p" | \
  grep -v "^@/" | \
  grep -v "^~/" | \
  grep -v "^\\./" | \
  grep -v "^\\.\\./" | \
  grep -v "^react$" | \
  grep -v "^next" | \
  sort -u)

echo "找到 $(echo "$imports" | wc -l) 个外部包导入"
echo ""

missing=0

echo "🔍 检查每个包是否在package.json中..."
for pkg in $imports; do
  # 检查是否在package.json中
  if ! grep -q "\"$pkg\":" package.json; then
    echo "❌ 缺失: $pkg"
    missing=$((missing + 1))
    
    # 显示使用该包的文件
    echo "   使用位置:"
    grep -rn "from ['\"]$pkg['\"]" src --include="*.tsx" --include="*.ts" | \
      head -3 | \
      sed 's/^/     /'
    echo ""
  fi
done

cd ../..

if [ $missing -eq 0 ]; then
  echo "✅ 所有依赖都已正确声明！"
  exit 0
else
  echo ""
  echo "❌ 发现 $missing 个缺失的依赖"
  echo ""
  echo "建议修复:"
  echo "  cd apps/frontend"
  echo "  npm install <package-name> --save"
  echo "  npm install --package-lock-only"
  exit 1
fi
