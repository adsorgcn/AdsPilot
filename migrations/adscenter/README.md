# AdsCenter服务迁移 - 从分散迁移到统一管理

## 迁移概述

本迁移文件将adscenter服务中分散的SQL迁移文件提取到db-admin统一管理系统中。

## 原始迁移位置

- 目录：`services/adscenter/internal/migrations/`
- 迁移文件数量：9个SQL文件
- 主要功能：Google Ads连接管理、幂等性、批量操作审计

## 迁移内容

### 001_user_ads_connection.yaml - Google Ads连接表
创建用户与Google Ads的连接管理表。

### 002_idempotency_keys.yaml - 幂等性控制
创建服务级幂等性键值表，防止重复操作。

### 003_bulk_audit_tables.yaml - 批量操作审计
创建批量操作的操作记录和审计表。

### 004_indexes_and_optimizations.yaml - 索引和优化
创建必要的性能索引。

### 005_mcc_link.yaml - MCC链接功能
添加主客户管理功能。

### 006_audit_events.yaml - 审计事件
添加通用审计事件表。

### 007_demo_fields.yaml - 演示数据支持
添加演示数据标记字段。

## 特殊考虑

### UUID主键
使用PostgreSQL的gen_random_uuid()函数生成UUID主键。

### JSONB数据
使用JSONB类型存储复杂结构数据，如操作计划和快照。

### 时区处理
所有时间戳字段使用TIMESTAMPTZ类型确保时区一致性。

## 风险评估

- **业务风险**: 🟡 中等 - adscenter是核心广告管理服务
- **数据风险**: 🟢 低 - 主要是DDL迁移，不涉及数据迁移
- **兼容性风险**: 🟡 中等 - 需要确保与现有Google Ads API兼容

## 执行计划

1. 在预发环境先执行验证
2. 确保所有表和索引正确创建
3. 验证Google Ads API集成功能
4. 部署到生产环境

## 验证清单

- [ ] 所有表结构正确创建
- [ ] 所有索引正确创建
- [ ] UUID生成功能正常
- [ ] JSONB字段操作正常
- [ ] Google Ads连接功能正常
- [ ] 批量操作审计功能正常