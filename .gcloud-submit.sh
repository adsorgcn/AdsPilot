#!/bin/bash
# 优化的Cloud Build提交脚本
# 解决monorepo中.gcloudignore失效问题

set -e

SERVICE="${1:-migrate}"
TARBALL="/tmp/${SERVICE}-source.tar.gz"

echo "📦 Creating optimized tarball for ${SERVICE}..."

# 为migration服务创建最小tarball (只需PostgreSQL + SQL文件)
tar -czf "$TARBALL" \
  schemas/sql/024_add_missing_ai_fields.sql \
  schemas/sql/025_evaluation_trends.sql \
  schemas/sql/026_daily_checkin.sql \
  scripts/Dockerfile.migrate \
  scripts/cloudbuild-migrate.yaml \
  scripts/run-migrations.sh

# 显示tarball大小
SIZE=$(du -h "$TARBALL" | cut -f1)
echo "✅ Tarball created: ${SIZE}"

echo "🚀 Submitting to Cloud Build..."
gcloud builds submit "$TARBALL" \
  --config scripts/cloudbuild-migrate.yaml \
  --timeout=20m

echo "🎉 Build submitted successfully!"
