# Billing服务迁移文件说明

本目录包含Billing服务的所有数据库迁移文件，从分散的迁移文件整合为统一的YAML格式。

## 迁移文件列表

### 001_initial_schema.yaml
- **描述**: 创建Billing服务初始表结构
- **源文件**: `services/billing/internal/migrations/000001_create_initial_tables.up.sql`
- **内容**:
  - User表（用户基本信息）
  - UserToken表（用户Token余额）
  - TokenTransaction表（Token交易记录）
  - Subscription表（订阅信息）
  - 基础索引

### 002_token_management_system.yaml
- **描述**: 增强Token管理系统
- **源文件**: 合并了多个Token相关迁移文件
  - `000002_create_user_token_pool.up.sql`
  - `000003_token_tx_user_created_idx.up.sql`
  - `000004_token_credit_lot_and_allocations.up.sql`
  - `000005_token_repair_audit.up.sql`
  - `000006_backfill_token_credit_lots_from_pool.up.sql`
  - `008_add_service_fields_to_token_transaction.up.sql`
- **内容**:
  - UserTokenPool表（Token池管理）
  - TokenCreditLot表（积分批次）
  - TokenCreditAllocation表（积分分配）
  - TokenRepairAudit表（修复审计）
  - TokenTransaction表新增service和resource_id字段
  - 性能优化索引

### 003_subscription_management.yaml
- **描述**: 增强订阅管理系统
- **源文件**: 合并了订阅相关迁移文件
  - `000004_alter_token_tx_and_create_subscription.up.sql`
  - `000007_subscription_plan_configs.up.sql`
  - `000008_fix_starter_create_offer_permission.up.sql`
  - `000011_add_trial_fields_to_subscription.up.sql`
  - `000013_create_subscription_config_tables.up.sql`
  - `000014_trial_subscriptions_data_migration.up.sql`
  - `000015_enhance_token_transactions.up.sql`
  - `000016_create_pending_subscriptions.up.sql`
  - `000017_add_subscription_tier.up.sql`
- **内容**:
  - subscription_plan_configs表（计划配置）
  - subscription_permissions表（权限管理）
  - subscription_token_costs表（Token费用）
  - subscription_pricing表（定价信息）
  - subscription_config_history表（配置历史）
  - PendingSubscription表（待处理订阅）
  - Subscription表新增试用相关字段
  - 完整的索引体系

### 004_performance_optimization.yaml
- **描述**: 数据库性能优化和事件处理系统
- **源文件**: 合并了性能优化相关文件
  - `000009_add_billing_performance_indexes.up.sql`
  - `000010_add_offer_performance_indexes.up.sql`
  - `000012_create_processed_events_table.up.sql`
- **内容**:
  - processed_events表���已处理事件）
  - 全面的性能优化索引
  - user_token_summary统计视图
  - 复合索引优化

## 使用方法

### 应用迁移
```bash
# 应用单个迁移
dbctl ddl apply billing 001 --env=preview

# 应用所有迁移
dbctl ddl apply billing all --env=preview

# 验证迁移状态
dbctl ddl validate billing --env=preview
```

### 回滚迁移
```bash
# 回滚单个迁移
dbctl ddl rollback billing 004 --env=preview

# 回滚到指定版本
dbctl ddl rollback billing 002 --env=preview
```

## 迁移依赖关系

```
001_initial_schema.yaml
↓
002_token_management_system.yaml (依赖 001)
↓
003_subscription_management.yaml (依赖 002)
↓
004_performance_optimization.yaml (依赖 003)
```

## 注意事项

1. **数据安全**: 在生产环境应用迁移前，请确保已创建完整备份
2. **停机时间**: 部分迁移可能需要短暂的停机时间，建议在低峰期执行
3. **回滚计划**: 每个迁移都有对应的down脚本，确保可以安全回滚
4. **测试验证**: 在预发环境充分测试后再应用到生产环境

## 从原始迁移转换

本目录的YAML文件是从原始SQL迁移文件转换而来，保持了：

- ✅ 相同的数据库结构
- ✅ 相同的索引优化
- ✅ 相同的数据完整性约束
- ✅ 改进的依赖关系管理
- ✅ 更好的可读性和维护性

原始的`.down.sql`文件逻辑已经整合到YAML的`down`部分中，确保完整的回滚能力。