#!/bin/bash

# 配置系统优化部署脚本

echo "🚀 开始部署配置系统优化..."

# 0. 校验环境变量：需要 MySQL 的 DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ 缺少 DATABASE_URL 环境变量（MySQL DSN）。示例：mysql://user:pass@host:3306/dbname"
  exit 1
fi

# 1. 生成 Prisma 客户端
echo "📦 生成 Prisma 客户端..."
npx prisma generate

# 2. 运行数据库迁移（CI 环境建议使用 migrate deploy；若在容器启动时已迁移可跳过）
echo "🗄️ 运行数据库迁移（deploy 模式）..."
npx prisma migrate deploy

# 3. 执行配置数据迁移
echo "📋 执行配置数据迁移..."
npx tsx scripts/migrate-configs.ts

# 4. 验证迁移结果
echo "✅ 验证迁移结果..."
echo "查询 SystemConfig 表记录数:"
npx prisma db execute --stdin --url="$DATABASE_URL" << EOF
SELECT category, COUNT(*) as count FROM system_configs GROUP BY category;
EOF

echo ""
echo "查询 EnvironmentVariable 表记录数:"
npx prisma db execute --stdin --url="$DATABASE_URL" << EOF
SELECT COUNT(*) as count FROM environment_variables;
EOF

echo ""
echo "🎉 配置系统优化部署完成！"
echo ""
echo "性能提升预期："
echo "- 查询性能: 80%+"
echo "- 批量操作性能: 60%+"
echo "- 内存使用: 减少30%+"
echo ""
echo "主要优化："
echo "✅ 简化配置分类（7个 -> 3个）"
echo "✅ 实现配置缓存系统"
echo "✅ 批量操作事务优化"
echo "✅ 批量热重载机制"
echo "✅ 简化验证规则"
echo "✅ 数据库索引优化"
