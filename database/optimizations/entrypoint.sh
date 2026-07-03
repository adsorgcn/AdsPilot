#!/bin/sh
set -e

echo "========================================="
echo "  数据库性能索引迁移工具"
echo "  日期: 2025-10-09"
echo "========================================="

# 检查DATABASE_URL环境变量
if [ -z "$DATABASE_URL" ]; then
  echo "错误: DATABASE_URL环境变量未设置"
  exit 1
fi

echo "✅ DATABASE_URL已设置"
echo ""

# 执行SQL文件
echo "执行索引迁移..."
psql "$DATABASE_URL" -f /tmp/apply-indexes.sql

echo ""
echo "========================================="
echo "  ✅ 迁移完成！"
echo "========================================="
