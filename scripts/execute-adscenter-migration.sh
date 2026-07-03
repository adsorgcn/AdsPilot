#!/bin/bash

# adscenter服务迁移执行脚本
# 使用现有数据库连接直接执行迁移

set -euo pipefail

# 配置
SERVICE="adscenter"
MIGRATION_FILE="migrations/adscenter/001_initial_schema.yaml"
DB_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/gm_db}"

echo "========================================="
echo "adscenter服务迁移执行"
echo "========================================="
echo "服务: $SERVICE"
echo "迁移文件: $MIGRATION_FILE"
echo "数据库: ${DB_URL%%:*}" # 只显示协议和主机，隐藏密码
echo ""

# 检查迁移文件是否存在
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ 迁移文件不存在: $MIGRATION_FILE"
    exit 1
fi

echo "✅ 迁移文件存在"
echo ""

# 提取并执行DDL语句
echo "📋 执行DDL语句..."

# 从YAML文件中提取SQL语句
DDL_STATEMENTS=()
IN_DDL=false
CURRENT_DDL=""

while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*sql:[[:space:]]*|[[:space:]]*$ ]]; then
        if [ "$IN_DDL" = true ]; then
            # DDL结束，添加到列表
            if [ -n "$CURRENT_DDL" ]; then
                # 清理和验证DDL
                CURRENT_DDL=$(echo "$CURRENT_DDL" | sed 's/^[[:space:]]*//' | sed '/^[[:space:]]*$/d')
                if [ -n "$CURRENT_DDL" ]; then
                    DDL_STATEMENTS+=("$CURRENT_DDL")
                fi
            fi
            CURRENT_DDL=""
            IN_DDL=false
        fi

        if [[ "$line" =~ sql:[[:space:]]* ]]; then
            IN_DDL=true
        fi
    elif [ "$IN_DDL" = true ]; then
        # 继续收集DDL语句
        CURRENT_DDL="$CURRENT_DDL$line"$'\n'
    fi
done < "$MIGRATION_FILE"

# 处理最后一个DDL
if [ "$IN_DDL" = true ] && [ -n "$CURRENT_DDL" ]; then
    CURRENT_DDL=$(echo "$CURRENT_DDL" | sed 's/^[[:space:]]*//' | sed '/^[[:space:]]*$/d')
    if [ -n "$CURRENT_DDL" ]; then
        DDL_STATEMENTS+=("$CURRENT_DDL")
    fi
fi

echo "找到 ${#DDL_STATEMENTS[@]} 个DDL语句"
echo ""

# 执行DDL语句
SUCCESS_COUNT=0
FAILED_COUNT=0

for i in "${!DDL_STATEMENTS[@]}"; do
    DDL="${DDL_STATEMENTS[$i]}"
    echo "执行DDL $((i+1))/${#DDL_STATEMENTS[@]}:"
    echo "$(echo "$DDL" | head -c 100)..."

    # 使用psql执行DDL
    if echo "$DDL" | PGPASSWORD=password psql -h localhost -U postgres -d gm_db -v ON_ERROR_STOP=1 > /dev/null 2>&1; then
        echo "✅ 成功"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "❌ 失败"
        echo "错误详情:"
        echo "$DDL" | PGPASSWORD=password psql -h localhost -U postgres -d gm_db 2>&1 || true
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
    echo ""
done

# 生成执行报告
echo "========================================="
echo "迁移执行报告"
echo "========================================="
echo "总DDL语句: ${#DDL_STATEMENTS[@]}"
echo "成功执行: $SUCCESS_COUNT"
echo "执行失败: $FAILED_COUNT"
echo ""

if [ $FAILED_COUNT -eq 0 ]; then
    echo "🎉 所有DDL语句执行成功！"
    echo ""
    echo "验证迁移结果..."

    # 验证表是否创建成功
    echo ""
    echo "📊 数据库表状态:"
    PGPASSWORD=password psql -h localhost -U postgres -d gm_db -c "
        SELECT
            schemaname,
            tablename,
            tableowner
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('useradsconnection', 'bulkactionoperation', 'bulkactionaudit', 'auditevent')
        ORDER BY tablename;
    " 2>/dev/null || echo "无法查询表状态"

    echo ""
    echo "✅ adscenter服务迁移完成！"
    exit 0
else
    echo "⚠️  $FAILED_COUNT 个DDL语句执行失败"
    echo "请检查错误信息并修复后重新执行"
    exit 1
fi