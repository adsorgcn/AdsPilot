#!/bin/bash

echo "🚀 开始设置超级管理员账号..."

# 1. 生成 Prisma 客户端
echo "📦 生成 Prisma 客户端..."
npx prisma generate

# 2. 运行数据库迁移
echo "🔄 运行数据库迁移..."
npx prisma db push

# 3. 运行种子数据
echo "🌱 运行种子数据..."
npx prisma db seed

echo ""
echo "✅ 超级管理员账号设置完成！"
echo ""
echo "🔑 管理员登录信息："
echo "   邮箱：admin@scientificinternet.com"
echo "   密码：请使用环境变量 ADMIN_PASSWORD 中设置的密码"
echo "   登录页面：/auth/admin-signin"
echo ""
echo "⚠️  请确保已设置 ADMIN_PASSWORD 环境变量，并在首次登录后立即修改密码！"
echo ""