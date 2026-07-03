# Offer服务迁移 - 从内嵌DDL到统一管理

## 迁移概述

本迁移文件将offer服务中内嵌的DDL操作提取到db-admin统一管理系统中。

## 原始DDL位置

- 文件：`services/offer/internal/handlers/ddl.go`
- 函数：`EnsureAllTables`
- 表数量：4个主要表 + 2个迁移alter语句

## 迁移内容

### 001_initial_schema.yaml - 初始表结构
创建以下表的完整DDL：
1. `OfferStatusHistory` - offer状态历史记录表
2. `OfferPreferences` - offer偏好设置表
3. `OfferKpiDeadLetter` - KPI死信队列表
4. `idempotency_keys` - 幂等性键值表

### 002_demo_data_support.yaml - 演示数据支持
添加以下字段用于支持演示数据：
1. `OfferStatusHistory.is_demo` - 标记演示数据
2. `OfferKpiDeadLetter.is_demo` - 标记演示数据

## 风险评估

- **业务风险**: 🟡 中等 - offer服务是核心业务服务
- **数据风险**: 🟢 低 - 只是DDL迁移，不涉及数据迁移
- **回滚风险**: 🟢 低 - 可以通过删除新表结构回滚

## 执行计划

1. 在预发环境先执行验证
2. 确保所有索引正确创建
3. 验证应用功能正常
4. 部署到生产环境

## 验证清单

- [ ] 所有表结构正确创建
- [ ] 所有索引正确创建
- [ ] 应用启动正常
- [ ] offer功能测试通过
- [ ] 性能测试无回退