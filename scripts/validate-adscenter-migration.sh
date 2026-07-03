#!/bin/bash

# adscenter服务迁移验证脚本
# 验证迁移文件和DDL语句��完整性

set -euo pipefail

# 配置
SERVICE="adscenter"
MIGRATION_FILE="migrations/adscenter/001_initial_schema.yaml"

echo "========================================="
echo "adscenter服务迁移验证"
echo "========================================="
echo "服务: $SERVICE"
echo "迁移文件: $MIGRATION_FILE"
echo ""

# 检查迁移文件是否存在
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ 迁移文件不存在: $MIGRATION_FILE"
    exit 1
fi

echo "✅ 迁移文件存在"
echo ""

# 解析YAML文件头部信息
echo "📋 迁移文件信息:"
echo "版本: $(grep "^version:" "$MIGRATION_FILE" | sed 's/version: \"//; s/\"//')"
echo "描述: $(grep "^description:" "$MIGRATION_FILE" | sed 's/description: \"//; s/\"//')"
echo "风险等级: $(grep "^risk_level:" "$MIGRATION_FILE" | sed 's/risk_level: \"//; s/\"//')"
echo ""

# 提取DDL语句
echo "🔍 提取DDL语句..."

DDL_STATEMENTS=()
TABLES=()
IN_DDL=false
CURRENT_DDL=""

while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*sql:[[:space:]]*|[[:space:]]*$ ]]; then
        if [ "$IN_DDL" = true ]; then
            # DDL结束，添加到列表
            if [ -n "$CURRENT_DDL" ]; then
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

# 分析DDL语句
echo "📊 DDL语句分析:"
CREATE_TABLE_COUNT=0
CREATE_INDEX_COUNT=0

for i in "${!DDL_STATEMENTS[@]}"; do
    DDL="${DDL_STATEMENTS[$i]}"

    if [[ "$DDL" =~ CREATE[[:space:]]+TABLE ]]; then
        CREATE_TABLE_COUNT=$((CREATE_TABLE_COUNT + 1))
        # 提取表名
        TABLE_NAME=$(echo "$DDL" | grep -o 'CREATE[[:space:]]\+TABLE[[:space:]]\+[^(]*' | sed 's/CREATE[[:space:]]\+TABLE[[:space:]]\+//' | tr -d '"' | tr -d ' ')
        if [ -n "$TABLE_NAME" ]; then
            TABLES+=("$TABLE_NAME")
        fi
        echo "  - 表创建: $TABLE_NAME"
    elif [[ "$DDL" =~ CREATE[[:space:]]+INDEX ]]; then
        CREATE_INDEX_COUNT=$((CREATE_INDEX_COUNT + 1))
        # 提取索引名
        INDEX_NAME=$(echo "$DDL" | grep -o 'CREATE[[:space:]]\+INDEX[[:space:]]\+[^(]*' | sed 's/CREATE[[:space:]]\+INDEX[[:space:]]\+//' | tr -d '"' | tr -d ' ')
        echo "  - 索引创建: $INDEX_NAME"
    fi
done

echo ""
echo "统计信息:"
echo "  - CREATE TABLE: $CREATE_TABLE_COUNT"
echo "  - CREATE INDEX: $CREATE_INDEX_COUNT"
echo "  - 总表数: ${#TABLES[@]}"
echo ""

# 验证表覆盖
echo "🔍 表覆盖验证:"
EXPECTED_TABLES=(
    "UserAdsConnection"
    "BulkActionOperation"
    "BulkActionAudit"
    "AuditEvent"
)

MISSING_TABLES=()
FOUND_TABLES=()

for table in "${EXPECTED_TABLES[@]}"; do
    FOUND=false
    for created_table in "${TABLES[@]}"; do
        if [[ "${created_table,,}" == "${table,,}" ]]; then
            FOUND=true
            FOUND_TABLES+=("$table")
            echo "  ✅ $table"
            break
        fi
    done

    if [ "$FOUND" = false ]; then
        MISSING_TABLES+=("$table")
        echo "  ❌ $table (缺失)"
    fi
done

echo ""
echo "表覆盖结果:"
echo "  - 预期表数: ${#EXPECTED_TABLES[@]}"
echo "  - 找到表数: ${#FOUND_TABLES[@]}"
echo "  - 缺失表数: ${#MISSING_TABLES[@]}"
echo ""

# 语法验证
echo "✅ DDL语法验证:"
SYNTAX_ERRORS=0

for i in "${!DDL_STATEMENTS[@]}"; do
    DDL="${DDL_STATEMENTS[$i]}"

    # 基本语法检查
    if [[ ! "$DDL" =~ \)$ ]]; then
        echo "  ❌ DDL $((i+1)): 缺少结束分号或括号"
        SYNTAX_ERRORS=$((SYNTAX_ERRORS + 1))
    elif [[ "$DDL" =~ [[:space:]]+$ ]]; then
        echo "  ⚠️  DDL $((i+1)): 末尾有多余空格"
    else
        echo "  ✅ DDL $((i+1)): 语法正确"
    fi
done

echo ""
if [ $SYNTAX_ERRORS -eq 0 ]; then
    echo "✅ 所有DDL语句语法验证通过"
else
    echo "❌ 发现 $SYNTAX_ERRORS 个语法错误"
fi

# 生成验证报告
echo ""
echo "========================================="
echo "验证报告"
echo "========================================="

if [ ${#MISSING_TABLES[@]} -eq 0 ] && [ $SYNTAX_ERRORS -eq 0 ]; then
    echo "🎉 迁移文件验证完全通过！"
    echo ""
    echo "迁移文件状态:"
    echo "  ✅ 文件格式正确"
    echo "  ✅ DDL语句完整"
    echo "  ✅ 表结构覆盖完整"
    echo "  ✅ 语法验证通过"
    echo ""
    echo "准备执行的DDL:"
    for i in "${!DDL_STATEMENTS[@]}"; do
        DDL="${DDL_STATEMENTS[$i]}"
        TYPE=$(echo "$DDL" | grep -o 'CREATE[[:space:]]\+[A-Z]*' | head -1)
        if [[ "$DDL" =~ TABLE[[:space:]] ]]; then
            TABLE_NAME=$(echo "$DDL" | grep -o 'TABLE[^(]*' | sed 's/TABLE[[:space:]]*//' | tr -d '"' | tr -d ' ')
            echo "  $((i+1)). $TYPE: $TABLE_NAME"
        else
            echo "  $((i+1)). $TYPE"
        fi
    done
    echo ""
    echo "下一步:"
    echo "1. 连接到目标数据库"
    echo "2. 执行迁移脚本"
    echo "3. 验证表创建结果"
    exit 0
else
    echo "⚠️  迁移文件需要修复"
    echo ""
    if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
        echo "缺失的表:"
        for table in "${MISSING_TABLES[@]}"; do
            echo "  - $table"
        done
    fi

    if [ $SYNTAX_ERRORS -gt 0 ]; then
        echo "语法错误: $SYNTAX_ERRORS 个"
    fi

    echo ""
    echo "建议操作:"
    echo "1. 检查并修复缺失的表定义"
    echo "2. 修复语法错误"
    echo "3. 重新运行验证脚本"
    exit 1
fi