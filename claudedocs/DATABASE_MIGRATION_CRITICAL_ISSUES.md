# 🚨 Google-Monetize 数据库迁移严重问题报告

**报告日期**: 2025-10-22
**评估类型**: 深度架构审查
**严重级别**: 🔴 **CRITICAL**

---

## 执行摘要

在深度审查过程中发现了一个**严重的架构不一致问题**，影响范围可能导致数据库迁移完全失效。

**核心问题**: billing服务存在**两套完全不兼容的迁移系统**，且代码与文档说明不一致。

---

## 🔴 严重问题 1: billing服务双迁移系统冲突

### 问题描述

billing服务同时存在两套完全不同的数据库迁移文件：

#### 迁移系统A: `services/billing/migrations/` (新架构)

**位置**: `services/billing/migrations/001_create_billing_schema.up.sql`

**特征**:
- ✅ 使用 `billing.` schema前缀
- ✅ 符合三层架构设计
- ✅ 正确引用 `user.users(id)`
- ✅ 表命名: `billing.accounts`, `billing.token_balances`, 等

**表结构示例**:
```sql
CREATE TABLE billing.accounts (
    user_id TEXT PRIMARY KEY REFERENCES user.users(id) ON DELETE CASCADE,
    account_type TEXT DEFAULT 'standard',
    balance_cents BIGINT DEFAULT 0,
    -- ...
);
```

**文件数量**: 1个迁移文件

---

#### 迁移系统B: `services/billing/internal/migrations/` (旧架构)

**位置**: `services/billing/internal/migrations/000001_create_initial_tables.up.sql` (及其他17个文件)

**特征**:
- ❌ **不使用schema前缀**（直接在public schema）
- ❌ **包含独立的User表**（违反三层架构）
- ❌ **包含Offer表**（与offer服务冲突）
- ❌ 使用Prisma风格命名（PascalCase + 引号）

**表结构示例**:
```sql
-- ❌ 违反三层架构：billing服务自己创建User表
CREATE TABLE IF NOT EXISTS "User" (
  "id"                      TEXT NOT NULL PRIMARY KEY,
  "email"                   TEXT NOT NULL UNIQUE,
  "name"                    TEXT,
  "role"                    TEXT NOT NULL DEFAULT 'USER',
  -- ...
);

-- ❌ 违反服务边界：billing创建Offer表
CREATE TABLE IF NOT EXISTS "Offer" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "userId"        TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name"          TEXT NOT NULL,
  -- ...
);

-- ❌ 表名使用引号和PascalCase
CREATE TABLE IF NOT EXISTS "TokenTransaction" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "userId"        TEXT NOT NULL REFERENCES "User"("id"),
  -- ...
);
```

**文件数量**: 18个迁移文件（000001 - 000017 + 008）

---

### 🔴 关键冲突

#### 1. 代码vs文档不一致

**README.md声明** (`services/billing/internal/migrations/README.md`):
```markdown
# 历史迁移文件

此目录包含的是历史迁移文件，**不再用于数据库迁移**。

当前使用的迁移文件位于：`services/billing/migrations/`

⚠️ **请勿直接使用这些文件进行迁移！**
```

**但Go代码实际使用** (`services/billing/cmd/server/main.go`):
```go
migrationsDir := "internal/migrations"  // ❌ 仍然使用旧的internal/migrations
```

**也出现在**:
- `services/billing/cmd/migrator/main.go`
- `services/billing/main.go`

---

#### 2. 架构冲突对比

| 方面 | 迁移系统A (新) | 迁移系统B (旧) | 状态 |
|------|---------------|---------------|------|
| **Schema前缀** | `billing.` | 无（public schema） | ❌ 冲突 |
| **User表** | 引用 `user.users` | 自己创建 `"User"` 表 | ❌ 严重冲突 |
| **Offer表** | 不包含 | 自己创建 `"Offer"` 表 | ❌ 服务边界冲突 |
| **表命名** | snake_case | PascalCase + 引号 | ❌ 风格冲突 |
| **三层架构** | ✅ 符合 | ❌ 违反 | ❌ 架构冲突 |
| **代码引用** | ❌ 未使用 | ✅ 实际使用 | 🚨 **致命问题** |

---

### 🔥 影响评估

#### 严重性: 🔴 **CRITICAL (P0)**

**当前状态**:
- 如果代码使用 `internal/migrations`，则数据库中有：
  - ❌ `public."User"` 表（与 `user.users` 冲突）
  - ❌ `public."Offer"` 表（与 `offer.offers` 冲突）
  - ❌ `public."TokenTransaction"` 表（与 `billing.token_transactions` 冲突）
  - ✅ 三层架构完全被破坏

- 如果切换到 `migrations/001`，则：
  - ❌ 现有数据无法迁移（表结构完全不同）
  - ❌ 应用代码可能引用旧表名
  - ❌ 需要复杂的数据迁移脚本

**影响范围**:
1. **数据完整性**: 可能存在重复的User和Offer数据
2. **应用稳定性**: 代码可能引用错误的表
3. **三层架构**: 架构设计完全失效
4. **其他服务**: offer、user服务可能受到影响

---

## 🔍 验证当前数据库状态

### 验证SQL

请在生产/预发布环境执行以下SQL确认当前使用的是哪套迁移：

```sql
-- 检查是否存在新架构的billing schema
SELECT schema_name FROM information_schema.schemata
WHERE schema_name = 'billing';

-- 检查是否存在旧架构的User表（public schema）
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('User', 'Offer', 'TokenTransaction', 'Subscription');

-- 检查billing schema中的表
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'billing'
ORDER BY table_name;

-- 检查user schema是否存在
SELECT schema_name FROM information_schema.schemata
WHERE schema_name = 'user';

-- 验证三层架构：检查billing.accounts是否引用user.users
SELECT
    tc.constraint_name,
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'billing'
AND tc.table_name = 'accounts';
```

---

## 📋 修复方案

### 方案1: 使用新架构迁移 (推荐)

**前提条件**:
- 当前数据库**尚未**使用旧的internal/migrations
- 或者是全新部署

**步骤**:
1. **修改Go代码**，使其指向新的migrations目录

**修改文件**: `services/billing/cmd/server/main.go`
```go
// Before
migrationsDir := "internal/migrations"

// After
migrationsDir := "migrations"
```

**同样修改**:
- `services/billing/cmd/migrator/main.go`
- `services/billing/main.go`

2. **删除或归档internal/migrations**
```bash
# 备份旧迁移文件
mv services/billing/internal/migrations services/billing/internal/migrations.backup

# 或者添加明显的禁用标记
touch services/billing/internal/migrations/.DEPRECATED
```

3. **运行新迁移**
```bash
cd services/billing
go run cmd/migrator/main.go up
```

**优点**:
- ✅ 符合三层架构
- ✅ 无服务边界冲突
- ✅ Schema隔离清晰

**缺点**:
- ❌ 如果已有旧数据，需要数据迁移

---

### 方案2: 数据迁移从旧架构到新架构

**前提条件**:
- 当前数据库**已经**使用了旧的internal/migrations
- 存在生产数据需要保留

**步骤**:

**阶段1: 准备**
1. 备份当前数据库
```bash
pg_dump $DATABASE_URL > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql
```

2. 创建数据迁移脚本

**创建文件**: `services/billing/migrations/002_migrate_from_old_schema.up.sql`

```sql
-- ========================================
-- 数据迁移: 从旧架构迁移到新架构
-- 优先级: P0
-- 风险等级: HIGH
-- ========================================

BEGIN;

-- 1. 创建billing schema (如果不存在)
CREATE SCHEMA IF NOT EXISTS billing;

-- 2. 从旧User表迁移到billing.accounts
-- 注意: 假设user.users已存在且数据已同步
INSERT INTO billing.accounts (
    user_id, account_type, status, balance_cents,
    currency, created_at, updated_at
)
SELECT
    u.id,
    'standard' AS account_type,
    'active' AS status,
    COALESCE(ut."balance", 0) AS balance_cents,
    'USD' AS currency,
    u."createdAt" AS created_at,
    now() AS updated_at
FROM "User" u
LEFT JOIN "UserToken" ut ON u.id = ut."userId"
ON CONFLICT (user_id) DO NOTHING;

-- 3. 迁移TokenTransaction到billing.token_transactions
INSERT INTO billing.token_transactions (
    id, user_id, token_type, amount,
    balance_before, balance_after,
    transaction_type, source, description,
    created_at, metadata
)
SELECT
    tt.id,
    tt."userId",
    'search' AS token_type,  -- 默认类型
    tt.amount,
    tt."balanceBefore",
    tt."balanceAfter",
    CASE
        WHEN tt.type = 'EARN' THEN 'purchase'
        WHEN tt.type = 'SPEND' THEN 'consumption'
        ELSE 'adjustment'
    END AS transaction_type,
    tt.source,
    tt.description,
    tt."createdAt",
    tt.metadata
FROM "TokenTransaction" tt
ON CONFLICT (id) DO NOTHING;

-- 4. 迁移Subscription到billing.subscriptions
INSERT INTO billing.subscriptions (
    id, user_id, plan_name, status,
    current_period_start, current_period_end,
    trial_end, amount_cents, currency,
    billing_interval, auto_renew,
    created_at, updated_at, metadata
)
SELECT
    s.id,
    s."userId",
    s."planName",
    CASE
        WHEN s.status = 'ACTIVE' THEN 'active'
        WHEN s.status = 'CANCELLED' THEN 'cancelled'
        WHEN s.status = 'TRIAL' THEN 'trial'
        ELSE 'paused'
    END AS status,
    now() AS current_period_start,
    s."currentPeriodEnd",
    s."trialEndsAt",
    0 AS amount_cents,  -- 需要从pricing_plans获取
    'USD' AS currency,
    'month' AS billing_interval,
    true AS auto_renew,
    now() AS created_at,
    now() AS updated_at,
    '{}'::jsonb AS metadata
FROM "Subscription" s
ON CONFLICT (id) DO NOTHING;

-- 5. 验证迁移结果
DO $$
DECLARE
    old_user_count INTEGER;
    new_account_count INTEGER;
    old_tx_count INTEGER;
    new_tx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO old_user_count FROM "User";
    SELECT COUNT(*) INTO new_account_count FROM billing.accounts;
    SELECT COUNT(*) INTO old_tx_count FROM "TokenTransaction";
    SELECT COUNT(*) INTO new_tx_count FROM billing.token_transactions;

    RAISE NOTICE '========================================';
    RAISE NOTICE '数据迁移验证结果:';
    RAISE NOTICE '========================================';
    RAISE NOTICE '用户: 旧表 % → 新表 %', old_user_count, new_account_count;
    RAISE NOTICE '交易: 旧表 % → 新表 %', old_tx_count, new_tx_count;

    IF new_account_count < old_user_count * 0.95 THEN
        RAISE EXCEPTION '❌ 账户迁移不完整: 预期至少 %, 实际 %',
            (old_user_count * 0.95)::INTEGER, new_account_count;
    END IF;

    IF new_tx_count < old_tx_count * 0.95 THEN
        RAISE EXCEPTION '❌ 交易迁移不完整: 预期至少 %, 实际 %',
            (old_tx_count * 0.95)::INTEGER, new_tx_count;
    END IF;

    RAISE NOTICE '✅ 数据迁移验证通过';
END $$;

-- 6. 重命名旧表（保留备份）
ALTER TABLE "User" RENAME TO "_deprecated_User";
ALTER TABLE "UserToken" RENAME TO "_deprecated_UserToken";
ALTER TABLE "TokenTransaction" RENAME TO "_deprecated_TokenTransaction";
ALTER TABLE "Subscription" RENAME TO "_deprecated_Subscription";

RAISE NOTICE '✅ 旧表已重命名为 _deprecated_* 前缀';

COMMIT;
```

**阶段2: 执行迁移**
1. 在staging环境测试迁移脚本
2. 验证数据完整性
3. 更新应用代码指向新表
4. 在生产环境执行迁移

**阶段3: 清理**
等待观察期（建议30天）后，删除旧表：
```sql
DROP TABLE IF EXISTS "_deprecated_User" CASCADE;
DROP TABLE IF EXISTS "_deprecated_UserToken" CASCADE;
DROP TABLE IF EXISTS "_deprecated_TokenTransaction" CASCADE;
DROP TABLE IF EXISTS "_deprecated_Subscription" CASCADE;
```

---

### 方案3: 保持旧架构（不推荐）

**仅在以下情况考虑**:
- 迁移到新架构风险过高
- 生产数据量巨大
- 时间紧迫无法完成迁移

**步骤**:
1. 删除 `services/billing/migrations/001_create_billing_schema.up.sql`
2. 更新README说明继续使用internal/migrations
3. 接受三层架构不完整的现状
4. 记录技术债务，计划未来迁移

**缺点**:
- ❌ 违反三层架构设计
- ❌ 服务边界不清晰
- ❌ 与其他服务不一致
- ❌ 长期维护成本高

---

## 🔍 其他服务检查

### adscenter服务

**发现**: adscenter也有 `internal/migrations` 目录

**文件列表**:
```
services/adscenter/internal/migrations/
├── 001_create_user_ads_connection.sql
├── 005_idempotency.sql
├── 006_bulk_audit.sql
├── 007_bulk_action_indexes.sql
├── 007_mcc_link.sql
├── 008_audit_events.sql
├── 009_add_demo_fields.sql
└── README.md
```

**状态**: ⚠️ **需要验证**

**检查要点**:
1. 这些文件是否与主迁移文件 `001_create_adscenter_schema.up.sql` 冲突？
2. 代码实际使用哪个目录？
3. 是否也存在双迁移系统问题？

**建议操作**:
```bash
# 检查adscenter代码中的迁移目录引用
grep -r "migrations" services/adscenter/cmd --include="*.go"

# 读取README了解情况
cat services/adscenter/internal/migrations/README.md
```

---

## 📊 优先级和时间线

### 🔴 P0 - 立即处理 (本周内)

1. **验证当前数据库状态**
   - 运行验证SQL确认使用的迁移系统
   - 检查是否存在表冲突
   - 确认三层架构完整性

2. **决定迁移方案**
   - 评估现有数据量和业务影响
   - 选择方案1或方案2
   - 制定详细执行计划

3. **修复billing服务代码**
   - 更新Go代码指向正确的migrations目录
   - 添加集成测试验证迁移正确性

### ⚠️ P1 - 高优先级 (两周内)

4. **检查adscenter服务**
   - 验证是否存在类似问题
   - 统一迁移管理策略

5. **建立迁移规范**
   - 明确禁止多套迁移系统
   - Code Review检查迁移文件
   - CI/CD自动化验证

### 📋 P2 - 改进建议 (一个月内)

6. **完善文档**
   - 更新迁移文档说明
   - 记录架构决策
   - 创建迁移最佳实践指南

7. **技术债务清理**
   - 删除已弃用的迁移文件
   - 统一命名规范
   - 优化迁移性能

---

## ✅ 推荐执行顺序

### 第一步: 紧急验证 (今天完成)
```bash
# 1. 连接到预发布/生产数据库
psql $DATABASE_URL

# 2. 运行验证SQL（见上文"验证当前数据库状态"章节）

# 3. 确认当前使用的迁移系统
```

### 第二步: 风险评估 (明天完成)
- 评估数据量
- 评估业务影响时间窗口
- 确定回滚策略

### 第三步: 选择方案 (本周完成)
- 如果是新系统或数据量小 → 方案1
- 如果有生产数据 → 方案2
- 紧急情况 → 方案3（不推荐）

### 第四步: 执行迁移 (两周内)
- Staging环境测试
- 生产环境执行
- 监控和验证

---

## 🎯 成功标准

迁移成功的标准：

1. ✅ **代码一致性**: Go代码使用统一的migrations目录
2. ✅ **文档一致性**: README与实际使用情况一致
3. ✅ **架构合规性**: 符合三层架构设计
4. ✅ **数据完整性**: 迁移前后数据100%一致
5. ✅ **服务边界**: billing不包含User和Offer表
6. ✅ **测试通过**: 所有集成测试和E2E测试通过
7. ✅ **性能验证**: 迁移后应用性能无明显下降

---

## 🔗 相关文档

- 第一份评估报告: `claudedocs/DATABASE_MIGRATION_REVIEW_REPORT.md`
- 三层架构文档: `docs/Database/DATABASE_ARCHITECTURE_CURRENT.md`
- 必知文档: `docs/BasicPrinciples/MustKnowV7.md`

---

**报告生成时间**: 2025-10-22
**下次审查**: 迁移完成后立即复核

---

## 附录: 完整表对比

### 旧架构表 (internal/migrations)
```
public."User"
public."Event"
public."Subscription"
public."UserToken"
public."TokenTransaction"
public."Offer"
(可能还有其他表)
```

### 新架构表 (migrations)
```
billing.accounts
billing.token_balances
billing.token_transactions
billing.subscriptions
billing.invoices
billing.pricing_plans
billing.usage_records
billing.refunds
```

### 依赖关系

**旧架构依赖**:
```
"User" (自己创建)
  ↓
"Subscription", "UserToken", "TokenTransaction", "Offer"
```

**新架构依赖**:
```
user.users (user服务创建)
  ↓
billing.accounts (billing服务创建)
  ↓
billing.subscriptions, billing.token_balances, billing.token_transactions, ...
```

---

**结论**: 这是一个需要**立即处理**的严重架构问题，否则会导致三层架构完全失效，数据完整性无法保证。
