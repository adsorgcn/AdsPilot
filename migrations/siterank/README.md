# SiteRank服务迁移 - 从内嵌DDL到统一管理

## 迁移概述

本迁移文件将siterank服务中内嵌的DDL操作提取到db-admin统一管理系统中。

## 原始DDL位置

- 文件：`services/siterank/internal/handlers/ddl.go`
- 函数：`EnsureAllTables`
- 表数量：3个主表 + 7个迁移alter语句 + 9个性能索引

## 迁移内容

### 001_initial_schema.yaml - 初始表结构
创建以下表的完整DDL：
1. `offer_evaluations` - offer评估结果表
2. `evaluation_aggregations` - 评估聚合统计表
3. `token_reservations` - 代币预留表

### 002_performance_indexes.yaml - 性能索引
创建以下性能索引：
1. `idx_offer_evaluations_*` - offer_evaluations表的5个索引
2. `idx_token_reservations_*` - token_reservations表的4个索引

### 003_schema_evolution.yaml - Schema演进
添加以下字段支持schema演进：
1. `offer_evaluations`表的3个字段
2. `token_reservations`表的4个字段

## 特殊考虑

### 预发环境清理
原始DDL在预发环境会删除所有表以确保clean schema。这个逻辑需要在db-admin中通过环境配置处理。

### 复杂索引
包含多个复合索引和性能优化索引，需要确保正确创建。

## 风险评估

- **业务风险**: 🟡 中等 - siterank是核心评估服务
- **性能风险**: 🔴 高 - 大量性能索引，需要验证查询性能
- **数据风险**: 🟢 低 - 只是DDL迁移，不涉及数据迁移
- **回滚风险**: 🟢 低 - 可以通过删除表结构回滚

## 执行计划

1. 在预发环境先执行验证
2. 确保所有索引正确创建
3. 验证查询性能无回退
4. 部署到生产环境

## 验证清单

- [ ] 所有表结构正确创建
- [ ] 所有索引正确创建（9个索引）
- [ ] 所有迁移字段正确添加
- [ ] 应用启动正常
- [ ] 查询性能测试通过
- [ ] 索引使用率验证