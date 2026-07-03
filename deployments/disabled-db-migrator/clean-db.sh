#!/bin/bash
# 清理数据库状态

set -euo pipefail

echo "清理数据库迁移状态..."

# 删除损坏的迁移记录
psql "$DATABASE_URL" -c "DELETE FROM public.schema_migrations WHERE version=1 AND dirty=true;" || true

# 删除可能存在的损坏 schema
psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS \"user\" CASCADE;" || true

echo "数据库清理完成"