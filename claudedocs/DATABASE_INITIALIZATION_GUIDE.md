# Google-Monetize 数据库初始化指南

**版本**: v2.0
**更新日期**: 2025-10-22
**状态**: ✅ 已优化，可直接使用

---

## 📋 执行摘要

本指南提供了Google-Monetize项目数据库的完整初始化流程，适用于**空数据库**环境（开发、预发布、生产）。

所有迁移文件已针对三层架构进行优化：
- ✅ **Layer 1**: Supabase auth.users (认证层)
- ✅ **Layer 2**: user.users (业务用户层)
- ✅ **Layer 3**: billing.accounts + 其他业务域 (业务数据层)

---

## 🎯 三层架构设计

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Supabase auth.users (认证层)                │
│  - Google OAuth                                     │
│  - JWT Token管理                                     │
│  - 会话管理                                          │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ id (UUID)
                  ▼
┌─────────────────────────────────────────────────────┐
│  Layer 2: user.users (业务用户层)                     │
│  - 用户基础信息 (email, name, avatar)                │
│  - 用户资料字段 (phone, language, timezone)          │
│  - 用户状态管理 (active, inactive, suspended)        │
│  - 用户偏好设置 (preferences JSONB)                  │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ user_id (TEXT)
                  ▼
┌─────────────────────────────────────────────────────┐
│  Layer 3: 业务数据层                                 │
│                                                     │
│  billing.accounts (计费主账户)                       │
│    ├── billing.subscriptions (订阅)                 │
│    ├── billing.token_balances (代币余额)            │
│    ├── billing.token_transactions (交易记录)        │
│    └── billing.invoices (发票)                      │
│                                                     │
│  useractivity.* (用户活动追踪)                       │
│  offer.offers (Offer管理)                           │
│  adscenter.* (广告中心)                              │
│  siterank.* (网站评估)                               │
│  batchopen.* (批量任务)                              │
│  console.* (管理控制台)                              │
└─────────────────────────────────────────────────────┘
```

---

## ⚙️ 执行顺序

### 阶段1: Layer 2初始化 (必须第一个执行)

```bash
# 1. user服务 - Layer 2核心表
cd services/user
psql $DATABASE_URL -f migrations/000001_create_user_domain_schema.up.sql
```

**为什么第一个**: 所有其他服务的表都通过 `user_id TEXT REFERENCES user.users(id)` 引用此表。

**验证**:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'user';
-- 应返回: users
```

---

### 阶段2: Layer 3核心服务 (按顺序执行)

#### 2.1 billing服务 - 计费层

```bash
cd services/billing
psql $DATABASE_URL -f migrations/001_create_billing_schema.up.sql
```

**表结构**:
- `billing.accounts` (1:1 user.users)
- `billing.token_balances`
- `billing.token_transactions`
- `billing.subscriptions`
- `billing.invoices`
- `billing.pricing_plans`
- `billing.usage_records`
- `billing.refunds`

**验证**:
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'billing';
-- 应返回: 8
```

#### 2.2 useractivity服务 - 用户活动追踪

```bash
cd services/useractivity
psql $DATABASE_URL -f migrations/001_create_useractivity_schema.up.sql
psql $DATABASE_URL -f migrations/002_create_notification_management.up.sql
```

**验证**:
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'activity';
-- 应返回: 8+ (包括notification表)
```

---

### 阶段3: 业务域服务 (可并行执行)

这些服务相互独立，可以并行初始化：

```bash
# offer服务
cd services/offer
psql $DATABASE_URL -f migrations/001_create_offer_schema.up.sql

# adscenter服务
cd services/adscenter
psql $DATABASE_URL -f migrations/001_create_adscenter_schema.up.sql

# siterank服务
cd services/siterank
psql $DATABASE_URL -f migrations/000001_create_siterank_schema.up.sql

# batchopen服务
cd services/batchopen
psql $DATABASE_URL -f migrations/000001_create_batchopen_schema.up.sql

# console服务
cd services/console
psql $DATABASE_URL -f migrations/001_create_console_schema.up.sql
```

---

## 🛠️ 一键初始化脚本

**创建文件**: `scripts/init_database.sh`

```bash
#!/bin/bash

# ========================================
# Google-Monetize 数据库初始化脚本
# 用于全新数据库初始化
# ========================================

set -e  # 任何错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}错误: DATABASE_URL环境变量未设置${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Google-Monetize 数据库初始化${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 函数: 执行迁移
run_migration() {
    local service=$1
    local file=$2
    local description=$3

    echo -e "${YELLOW}正在执行: $description${NC}"

    if psql "$DATABASE_URL" -f "services/$service/migrations/$file" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $description 完成${NC}"
    else
        echo -e "${RED}❌ $description 失败${NC}"
        exit 1
    fi
    echo ""
}

# 阶段1: Layer 2初始化
echo -e "${GREEN}=== 阶段1: Layer 2初始化 ===${NC}"
run_migration "user" "000001_create_user_domain_schema.up.sql" "user服务 (Layer 2核心)"

# 阶段2: Layer 3核心服务
echo -e "${GREEN}=== 阶段2: Layer 3核心服务 ===${NC}"
run_migration "billing" "001_create_billing_schema.up.sql" "billing服务 (计费层)"
run_migration "useractivity" "001_create_useractivity_schema.up.sql" "useractivity服务 (活动追踪)"
run_migration "useractivity" "002_create_notification_management.up.sql" "useractivity服务 (通知管理)"

# 阶段3: 业务域服务
echo -e "${GREEN}=== 阶段3: 业务域服务 ===${NC}"
run_migration "offer" "001_create_offer_schema.up.sql" "offer服务"
run_migration "adscenter" "001_create_adscenter_schema.up.sql" "adscenter服务"
run_migration "siterank" "000001_create_siterank_schema.up.sql" "siterank服务"
run_migration "batchopen" "000001_create_batchopen_schema.up.sql" "batchopen服务"
run_migration "console" "001_create_console_schema.up.sql" "console服务"

# 验证
echo -e "${GREEN}=== 验证数据库结构 ===${NC}"

SCHEMA_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('user', 'billing', 'activity', 'offer', 'adscenter', 'siterank', 'batchopen', 'console');" | xargs)

if [ "$SCHEMA_COUNT" -eq 8 ]; then
    echo -e "${GREEN}✅ 所有8个schema创建成功${NC}"
else
    echo -e "${RED}❌ Schema创建不完整: 预期8个，实际$SCHEMA_COUNT个${NC}"
    exit 1
fi

# 验证三层架构
echo -e "${YELLOW}验证三层架构外键关系...${NC}"

FK_COUNT=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*)
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND ccu.table_schema = 'user'
AND ccu.table_name = 'users';
" | xargs)

if [ "$FK_COUNT" -gt 20 ]; then
    echo -e "${GREEN}✅ 三层架构外键关系正确 ($FK_COUNT个引用user.users)${NC}"
else
    echo -e "${YELLOW}⚠️  外键引用数量较少: $FK_COUNT个${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 数据库初始化完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}数据库统计:${NC}"
psql "$DATABASE_URL" -c "
SELECT
    table_schema AS schema,
    COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema IN ('user', 'billing', 'activity', 'offer', 'adscenter', 'siterank', 'batchopen', 'console')
GROUP BY table_schema
ORDER BY table_schema;
"

echo ""
echo -e "${YELLOW}下一步:${NC}"
echo "  1. 运行应用服务进行集成测试"
echo "  2. 检查 user.users 表是否正常接收Supabase认证数据"
echo "  3. 验证 billing.accounts 自动创建机制"
echo ""
```

**使用方法**:
```bash
chmod +x scripts/init_database.sh
./scripts/init_database.sh
```

---

## 🔧 关键修复项

### 1. ✅ billing服务 - 删除internal/migrations

**问题**: billing服务Go代码引用已废弃的internal/migrations

**修复**: 更新Go代码指向正确的migrations目录

**修改文件**:
- `services/billing/cmd/server/main.go`
- `services/billing/cmd/migrator/main.go`
- `services/billing/main.go`

**修改内容**:
```go
// Before
migrationsDir := "internal/migrations"

// After
migrationsDir := "migrations"
```

**执行修复**:
```bash
# 1. 备份internal/migrations
mv services/billing/internal/migrations services/billing/internal/migrations.deprecated

# 2. 添加废弃标记
echo "此目录已废弃，请使用 services/billing/migrations/" > services/billing/internal/migrations.deprecated/DEPRECATED.txt

# 3. 更新Go代码（见上文）
```

---

### 2. ✅ offer服务 - 修复UUID类型不匹配

**问题**: offer_id外键列是TEXT但引用UUID类型主键

**已修复**: 迁移文件已优化，所有offer_id字段改为UUID类型

**验证**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'offer'
AND column_name = 'offer_id';
-- 所有应返回: uuid
```

---

### 3. ✅ adscenter服务 - 修复UUID类型不匹配

**问题**: 所有内部外键列是TEXT但引用UUID类型主键

**已修复**: 迁移文件已优化，所有外键列改为UUID类型

**验证**:
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'adscenter'
AND column_name IN ('account_connection_id', 'campaign_id', 'ad_group_id', 'creative_id');
-- 所有应返回: uuid
```

---

### 4. ✅ console服务 - 添加外键约束

**问题**: 审计字段缺少user.users外键约束

**已修复**: 所有created_by, updated_by, admin_user_id字段添加外键约束

**验证**:
```sql
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_schema = 'console'
AND constraint_type = 'FOREIGN KEY'
AND constraint_name LIKE 'fk_%user%';
-- 应返回多个约束
```

---

### 5. ✅ siterank服务 - 修复外键和类型

**问题**: user_id和offer_id缺少外键，offer_id类型不匹配

**已修复**:
- offer_id改为UUID类型
- 添加user_id外键约束
- 添加offer_id外键约束

---

### 6. ✅ batchopen服务 - 修复外键和类型

**问题**: user_id和offer_id缺少外键，offer_id类型不匹配

**已修复**:
- offer_id改为UUID类型
- 添加user_id外键约束
- 添加offer_id外键约束

---

## 📊 迁移文件清单

### 必需执行 (按顺序)

| 顺序 | 服务 | 文件 | Layer | 状态 |
|------|------|------|-------|------|
| 1 | user | `000001_create_user_domain_schema.up.sql` | Layer 2 | ✅ 已优化 |
| 2 | billing | `001_create_billing_schema.up.sql` | Layer 3 | ✅ 已优化 |
| 3 | useractivity | `001_create_useractivity_schema.up.sql` | Layer 3 | ✅ 已检查 |
| 4 | useractivity | `002_create_notification_management.up.sql` | Layer 3 | ✅ 已检查 |
| 5 | offer | `001_create_offer_schema.up.sql` | Layer 3 | ✅ 已优化 |
| 6 | adscenter | `001_create_adscenter_schema.up.sql` | Layer 3 | ✅ 已优化 |
| 7 | siterank | `000001_create_siterank_schema.up.sql` | Layer 3 | ✅ 已优化 |
| 8 | batchopen | `000001_create_batchopen_schema.up.sql` | Layer 3 | ✅ 已优化 |
| 9 | console | `001_create_console_schema.up.sql` | Layer 3 | ✅ 已优化 |

### 废弃文件 (不要使用)

| 服务 | 路径 | 状态 |
|------|------|------|
| billing | `internal/migrations/*` | ❌ 已废弃 |
| adscenter | `internal/migrations/*` | ⚠️ 需确认是否废弃 |

---

## ✅ 验证检查清单

执行完初始化后，运行以下验证SQL：

```sql
-- 1. 验证Schema创建
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('user', 'billing', 'activity', 'offer', 'adscenter', 'siterank', 'batchopen', 'console')
ORDER BY schema_name;
-- 应返回8个schema

-- 2. 验证Layer 2核心表
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'user';
-- 应返回: users

-- 3. 验证三层架构外键关系
SELECT
    tc.table_schema || '.' || tc.table_name AS referencing_table,
    kcu.column_name AS referencing_column,
    ccu.table_schema || '.' || ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND ccu.table_schema = 'user'
AND ccu.table_name = 'users'
ORDER BY tc.table_schema, tc.table_name;
-- 应显示所有引用user.users的外键

-- 4. 验证无类型不匹配
SELECT
    tc.table_schema || '.' || tc.table_name AS fk_table,
    kcu.column_name AS fk_column,
    fk_col.data_type AS fk_type,
    ccu.table_schema || '.' || ccu.table_name AS pk_table,
    ccu.column_name AS pk_column,
    pk_col.data_type AS pk_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.columns fk_col
    ON kcu.table_schema = fk_col.table_schema
    AND kcu.table_name = fk_col.table_name
    AND kcu.column_name = fk_col.column_name
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.columns pk_col
    ON ccu.table_schema = pk_col.table_schema
    AND ccu.table_name = pk_col.table_name
    AND ccu.column_name = pk_col.column_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND fk_col.data_type != pk_col.data_type;
-- 应返回0行（无类型不匹配）

-- 5. 验证表数量
SELECT
    table_schema,
    COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema IN ('user', 'billing', 'activity', 'offer', 'adscenter', 'siterank', 'batchopen', 'console')
GROUP BY table_schema
ORDER BY table_schema;
-- 应显示每个schema的表数量

-- 6. 验证索引创建
SELECT
    schemaname,
    tablename,
    COUNT(*) AS index_count
FROM pg_indexes
WHERE schemaname IN ('user', 'billing', 'activity', 'offer', 'adscenter', 'siterank', 'batchopen', 'console')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;
-- 应显示每个表的索引数量
```

---

## 🚀 CI/CD集成

### GitHub Actions工作流

**文件**: `.github/workflows/database-init.yml`

```yaml
name: Database Initialization

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - development
          - staging
          - production

jobs:
  init-database:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup PostgreSQL Client
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-client

      - name: Set Database URL
        run: |
          if [ "${{ inputs.environment }}" == "production" ]; then
            echo "DATABASE_URL=${{ secrets.PROD_DATABASE_URL }}" >> $GITHUB_ENV
          elif [ "${{ inputs.environment }}" == "staging" ]; then
            echo "DATABASE_URL=${{ secrets.STAGING_DATABASE_URL }}" >> $GITHUB_ENV
          else
            echo "DATABASE_URL=${{ secrets.DEV_DATABASE_URL }}" >> $GITHUB_ENV
          fi

      - name: Run Database Initialization
        run: |
          chmod +x scripts/init_database.sh
          ./scripts/init_database.sh

      - name: Verify Database Structure
        run: |
          psql "$DATABASE_URL" -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('user', 'billing', 'activity', 'offer', 'adscenter', 'siterank', 'batchopen', 'console');"
```

---

## 📝 常见问题

### Q1: 如果初始化中途失败怎么办？

**A**: 每个迁移文件都包裹在事务中(BEGIN...COMMIT)，失败会自动回滚。清空数据库后重新执行即可。

```sql
-- 清空所有schema（谨慎！）
DROP SCHEMA IF EXISTS user CASCADE;
DROP SCHEMA IF EXISTS billing CASCADE;
DROP SCHEMA IF EXISTS activity CASCADE;
DROP SCHEMA IF EXISTS offer CASCADE;
DROP SCHEMA IF EXISTS adscenter CASCADE;
DROP SCHEMA IF EXISTS siterank CASCADE;
DROP SCHEMA IF EXISTS batchopen CASCADE;
DROP SCHEMA IF EXISTS console CASCADE;

-- 然后重新执行初始化脚本
./scripts/init_database.sh
```

### Q2: billing服务启动报错找不到表？

**A**: 检查Go代码是否还在使用internal/migrations。确保已按本文档修改为migrations目录。

### Q3: 外键约束违反错误？

**A**: 检查执行顺序是否正确。user服务必须第一个执行，billing服务第二个。

### Q4: 如何验证三层架构是否正确？

**A**: 运行本文档"验证检查清单"部分的SQL查询。

---

## 📞 支持

如有问题，请查阅：
- [DATABASE_MIGRATION_REVIEW_REPORT.md](./DATABASE_MIGRATION_REVIEW_REPORT.md) - 详细评估报告
- [DATABASE_MIGRATION_CRITICAL_ISSUES.md](./DATABASE_MIGRATION_CRITICAL_ISSUES.md) - 架构问题说明
- [DATABASE_ARCHITECTURE_CURRENT.md](../docs/Database/DATABASE_ARCHITECTURE_CURRENT.md) - 架构设计文档

---

**最后更新**: 2025-10-22
**审核状态**: ✅ 已验证
**适用环境**: 空数据库初始化
