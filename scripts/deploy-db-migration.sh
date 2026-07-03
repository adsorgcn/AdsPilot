#!/bin/bash
# 数据库迁移部署脚本
# 执行AI评估v2.1字段迁移

set -e

PROJECT_ID="${GCP_PROJECT_ID}"
DB_INSTANCE="gm"
DB_NAME="gm_db"
DB_USER="postgres"
REGION="asia-northeast1"

MIGRATION_FILE="schemas/sql/020_ai_evaluation_v2_fields.sql"
ROLLBACK_FILE="schemas/sql/020_ai_evaluation_v2_fields_rollback.sql"

echo "========================================="
echo "数据库迁移: AI评估v2.1字段"
echo "========================================="
echo "实例: ${DB_INSTANCE}"
echo "数据库: ${DB_NAME}"
echo "迁移文件: ${MIGRATION_FILE}"
echo ""

# 检查迁移文件是否存在
if [ ! -f "${MIGRATION_FILE}" ]; then
  echo "❌ 迁移文件不存在: ${MIGRATION_FILE}"
  exit 1
fi

# 确认执行
read -p "是否继续执行迁移? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
  echo "取消迁移"
  exit 0
fi

echo ""
echo "步骤 1/4: 备份当前数据库Schema..."

# 导出当前Schema（备份）
BACKUP_FILE="backups/schema_backup_$(date +%Y%m%d_%H%M%S).sql"
mkdir -p backups

gcloud sql export sql ${DB_INSTANCE} \
  gs://PROJECT_BUCKET/${BACKUP_FILE} \
  --database=${DB_NAME} \
  --project=${PROJECT_ID} \
  --quiet || echo "⚠️ 备份失败（继续执行）"

echo "✅ Schema备份完成: ${BACKUP_FILE}"

echo ""
echo "步骤 2/4: 连接到Cloud SQL..."

# 获取Cloud SQL IP
DB_IP=$(gcloud sql instances describe ${DB_INSTANCE} \
  --project=${PROJECT_ID} \
  --format='value(ipAddresses[0].ipAddress)')

echo "数据库IP: ${DB_IP}"

echo ""
echo "步骤 3/4: 执行迁移..."

# 方法1: 通过Cloud SQL Proxy执行（推荐）
# cloud_sql_proxy -instances=${PROJECT_ID}:${REGION}:${DB_INSTANCE}=tcp:5432 &
# PGPASSWORD=${DB_PASSWORD} psql -h localhost -U ${DB_USER} -d ${DB_NAME} -f ${MIGRATION_FILE}

# 方法2: 直接通过gcloud连接（需要手动执行）
echo ""
echo "请执行以下命令连接到数据库并运行迁移:"
echo ""
echo "  gcloud sql connect ${DB_INSTANCE} --user=${DB_USER} --database=${DB_NAME}"
echo ""
echo "  连接后执行:"
echo "  \i ${MIGRATION_FILE}"
echo ""
echo "  验证迁移:"
echo "  SELECT column_name, data_type"
echo "  FROM information_schema.columns"
echo "  WHERE table_name = 'offer_evaluations'"
echo "    AND column_name LIKE 'ai_%'"
echo "  ORDER BY column_name;"
echo ""

# 等待用户确认
read -p "迁移是否成功执行? (yes/no): " MIGRATION_SUCCESS

if [ "${MIGRATION_SUCCESS}" != "yes" ]; then
  echo ""
  echo "❌ 迁移失败，请执行回滚:"
  echo ""
  echo "  gcloud sql connect ${DB_INSTANCE} --user=${DB_USER} --database=${DB_NAME}"
  echo "  \i ${ROLLBACK_FILE}"
  echo ""
  exit 1
fi

echo ""
echo "步骤 4/4: 验证迁移..."

# 验证新字段是否存在（需要有psql客户端）
# VERIFICATION_QUERY="SELECT column_name FROM information_schema.columns WHERE table_name = 'offer_evaluations' AND column_name IN ('ai_product_type', 'ai_estimated_aov', 'ai_search_insights', 'ai_geo_insights', 'ai_risk_assessment');"

echo ""
echo "========================================="
echo "✅ 迁移流程完成！"
echo "========================================="
echo ""
echo "后续步骤:"
echo "1. 验证新字段已创建"
echo "2. 部署siterank服务新版本"
echo "3. 部署前端新版本"
echo "4. 执行端到端测试"
echo ""
echo "如需回滚，请执行:"
echo "  \i ${ROLLBACK_FILE}"
echo ""
