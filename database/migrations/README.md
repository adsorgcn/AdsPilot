# Database Migration Guide

## 使用 golang-migrate 工具

### 1. 本地开发环境

安装 migrate CLI:
```bash
# macOS
brew install golang-migrate

# Linux
curl -L https://github.com/golang-migrate/migrate/releases/download/v4.17.0/migrate.linux-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/

# Windows
scoop install migrate
```

### 2. 运行迁移

```bash
# 设置数据库连接
export DATABASE_URL="postgresql://user:pass@localhost:5432/gm_db?sslmode=disable"

# 执行所有 up 迁移
migrate -path database/migrations -database "${DATABASE_URL}" up

# 回滚最后一次迁移
migrate -path database/migrations -database "${DATABASE_URL}" down 1

# 查看当前版本
migrate -path database/migrations -database "${DATABASE_URL}" version

# 强制设置版本（谨慎使用）
migrate -path database/migrations -database "${DATABASE_URL}" force 1
```

### 3. Cloud Run Job 部署

使用 Docker 镜像运行迁移:

```bash
# 构建迁移镜像
docker build -f deployments/db-migrator/Dockerfile.migrate -t db-migrator .

# 本地测试
docker run --rm \
  -e DATABASE_URL="${DATABASE_URL}" \
  db-migrator "${DATABASE_URL}" up

# Cloud Run Job 部署
gcloud run jobs create db-migrator \
  --image asia-northeast1-docker.pkg.dev/${GCP_PROJECT_ID}/gm-services/db-migrator:latest \
  --region asia-northeast1 \
  --set-env-vars DATABASE_URL_SECRET_NAME=projects/${GCP_PROJECT_ID}/secrets/DATABASE_URL/versions/latest \
  --set-cloudsql-instances ${GCP_PROJECT_ID}:asia-northeast1:gm \
  --vpc-connector cr-conn-default-ane1

# 执行迁移
gcloud run jobs execute db-migrator --region asia-northeast1 --args "up"
```

### 4. 创建新迁移

```bash
# 创建新迁移文件 (自动生成时间戳)
migrate create -ext sql -dir database/migrations -seq add_user_preferences

# 手动创建（使用版本号）
touch database/migrations/000002_add_user_preferences.up.sql
touch database/migrations/000002_add_user_preferences.down.sql
```

### 5. 迁移文件命名规范

```
{version}_{description}.up.sql    # 升级脚本
{version}_{description}.down.sql  # 回滚脚本

示例:
000001_complete_offer_setup.up.sql
000001_complete_offer_setup.down.sql
000002_add_user_preferences.up.sql
000002_add_user_preferences.down.sql
```

### 6. Secret Manager 集成

从 GCP Secret Manager 获取数据库连接:

```bash
# 存储数据库 URL 到 Secret Manager
echo -n "postgresql://user:pass@/gm_db?host=/cloudsql/PROJECT:REGION:INSTANCE" | \
  gcloud secrets create DATABASE_URL --data-file=-

# Cloud Run Job 自动从 secret 读取
# 通过 DATABASE_URL_SECRET_NAME 环境变量指定
```

### 7. CI/CD 集成

在 `.github/workflows/deploy-backend.yml` 中添加迁移步骤:

```yaml
- name: Run Database Migration
  run: |
    gcloud run jobs execute db-migrator \
      --region asia-northeast1 \
      --args "up" \
      --wait
```

### 8. 回滚策略

```bash
# 查看迁移历史
migrate -path database/migrations -database "${DATABASE_URL}" version

# 回滚到指定版本
migrate -path database/migrations -database "${DATABASE_URL}" goto 1

# 回滚所有迁移
migrate -path database/migrations -database "${DATABASE_URL}" down -all
```

## 注意事项

1. **生产环境迁移**: 始终先在预发环境测试
2. **备份**: 迁移前务必备份数据库
3. **事务**: 使用 `BEGIN;` 和 `COMMIT;` 包裹迁移脚本
4. **幂等性**: 使用 `IF NOT EXISTS` 确保可重复执行
5. **回滚**: 每个 up 迁移必须有对应的 down 脚本

## 旧迁移文件迁移

旧的迁移文件 (database/migrations/20250130_*.sql) 已转换为 golang-migrate 格式:
- `20250130_complete_offer_setup.sql` → `000012_complete_offer_setup.{up,down}.sql`
- `20250130_offer_enhancement.sql` → `000013_offer_enhancement_cleanup.{up,down}.sql`

console 服务的迁移文件也已转换为 golang-migrate 格式:
- `002_create_audit_log_table.sql` → `000001_create_audit_log_table.{up,down}.sql`
- `003_create_token_rules_table.sql` → `000002_create_token_rules_table.{up,down}.sql`
- `004_create_recovery_codes_table.sql` → `000003_create_recovery_codes_table.{up,down}.sql`
- `005_create_export_and_feature_flags_tables.sql` → `000004_create_export_and_feature_flags_tables.{up,down}.sql`
- `006_create_read_only_views.sql` → `000005_create_read_only_views.{up,down}.sql`

可安全删除旧文件或移至 `database/migrations/archive/` 目录。
