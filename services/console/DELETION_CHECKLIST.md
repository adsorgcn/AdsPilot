# Console服务删除清单

**执行日期**: 2025-10-14
**目标**: 从http.go删除非核心handler，减少80%代码

---

## ❌ 待删除的Handler方法 (32个)

### 监控相关 (3个)
- [ ] `getMonitoringOverview` - 监控概览
- [ ] `streamMonitoringOverview` - 实时监控流
- [ ] `GetServicesHealth` - 服务健康状态

### 审计增强 (5个，保留基础adminAuditList)
- [ ] `getAuditStats` - 审计统计
- [ ] `getUserActionHistory` - 用户行为追踪
- [ ] `getCriticalAuditLogs` - 关键日志
- [ ] `getEnhancedAuditLogs` - 增强审计
- [ ] `recordImpersonationAudit` - 模拟登录审计

###营销/导航/本地化 (5个)
- [ ] `GetMarketingSummary` - 营销内容摘要
- [ ] `InvalidateMarketingCache` - 营销缓存失效
- [ ] `GetNavigationConfig` - 导航配置
- [ ] `GetLocalizationConfig` - 本地化配置
- [ ] `RecordWebVitals` - Web性能指标

### NPS/指标 (2个)
- [ ] `RecordNpsFeedback` - NPS反馈
- [ ] `GetSuccessMetrics` - 成功指标

### Insights (2个)
- [ ] `getInsights` - Insights聚合
- [ ] `streamInsights` - Insights实时流

### 组织分析 (2个)
- [ ] `getOrganizationAnalytics` - 组织分析
- [ ] `getOrganizationRankings` - 组织排名

### Dashboard聚合 (7个)
- [ ] `GetUserDashboard` - 用户Dashboard
- [ ] `getDashboardStats` - Dashboard统计
- [ ] `getDashboardMetrics` - Dashboard指标
- [ ] `getDashboardTrends` - Dashboard趋势
- [ ] `getDashboardActivity` - 活动流
- [ ] `getTodayActivity` - 今日活动
- [ ] `getDashboardAlerts` - 告警列表

### 财务统计 (3个)
- [ ] `getFinancialOverview` - 财务概览
- [ ] `getMonthlyFinancial` - 月度财务
- [ ] `getFinancialTrends` - 财务趋势

### Offers统计 (6个)
- [ ] `getOffers` - Offers列表（管理后台）
- [ ] `getOfferStats` - Offers统计
- [ ] `getOfferQualityMetrics` - 质量指标
- [ ] `getOfferFailureReasons` - 失败原因
- [ ] `getProblemOffers` - 问题Offers
- [ ] `batchArchiveOffers` - 批量归档

### 报表生成 (2个)
- [ ] `getOfferMetricsReport` - Offer指标报表
- [ ] `getTokenUsageReport` - Token使用报表

### 导出中心 (3个)
- [ ] `recordExportRequest` - 记录导出请求
- [ ] `getExportHistory` - 导出历史
- [ ] `getExportStats` - 导出统计

### 通知广播 (6个)
- [ ] `getBroadcasts` - 广播列表
- [ ] `sendBroadcast` - 发送广播
- [ ] `getBroadcastStats` - 广播统计
- [ ] `getNotificationTemplates` - 通知模板
- [ ] `createNotificationTemplate` - 创建模板
- [ ] `previewNotificationTemplate` - 预览模板

### 功能开关 (2个)
- [ ] `getFeatureFlags` - 功能开关列表
- [ ] `updateFeatureFlag` - 更新功能开关

### 批量操作 (3个)
- [ ] `BulkArchiveOffers` - 批量归档Offers
- [ ] `bulkUpdateOfferStatus` - 批量更新Offer状态
- [ ] `bulkTopUpTokens` - 批量充值Tokens

### 恢复码 (4个)
- [ ] `generateRecoveryCodes` - 生成恢复码
- [ ] `listRecoveryCodes` - 恢复码列表
- [ ] `getRecoveryCodeStats` - 恢复码统计
- [ ] `verifyRecoveryCodeHandler` - 验证恢复码

### 广告账户 (2个)
- [ ] `getAdsAccountStats` - 广告账户统计
- [ ] `getAdsAccounts` - 广告账户列表

### 订阅管理 (3个)
- [ ] `getSubscriptions` - 订阅列表
- [ ] `getSubscriptionDetail` - 订阅详情
- [ ] `getSubscriptionStats` - 订阅统计

### Onboarding (1个)
- [ ] `GetOnboardingChecklist` - 新手任务清单

---

## ✅ 保留的核心Handler方法 (22个)

### 用户管理 (3个)
- [x] `getUsers` - 用户列表
- [x] `usersTree` - 用户详情/更新/删除
- [x] `userActions` - 用户操作日志

### Token管理 (7个)
- [x] `getTokenStats` - Token统计
- [x] `getTokenBalances` - Token余额
- [x] `topUpTokens` - 充值Token
- [x] `rulesHandler` - Token规则列表/创建
- [x] `rulesTree` - Token规则详情/更新/删除
- [x] `getTokenConsumptionTrend` - 消耗趋势
- [x] `getTopTokenConsumers` - Top消费者

### 任务管理 (4个) - 已在tasks.go
- [x] `getTaskStats` - 任务统计
- [x] `getTasks` - 任务列表
- [x] `cancelTask` - 取消任务
- [x] `retryTask` - 重试任务

### 统计数据 (1个)
- [x] `getAdminStats` - 管理员统计

### 配置管理 (3个)
- [x] `configList` - 配置列表
- [x] `configHistory` - 配置历史
- [x] `configTree` - 配置详情/更新

### API密钥 (3个)
- [x] `apiKeysListCreate` - 密钥列表/创建
- [x] `apiKeysDetail` - 密钥详情/删除
- [x] `apiKeysValidate` - 验证密钥

### 健康检查 (1个)
- [x] `healthAggregate` - 聚合健康检查

---

## 📊 删除统计

| 类别 | 删除数量 | 保留数量 | 删除比例 |
|------|---------|---------|----------|
| Handler方法 | 32 | 22 | 59% |
| 路由端点 | ~58 | ~32 | 64% |
| 预计代码行数 | ~3,165 | ~800 | 80% |

---

## ⚠️ 注意事项

### 需要更新的相关文件
1. `services/console/internal/handlers/tasks.go` - 已存在任务管理
2. `services/console/internal/handlers/dashboard.go` - 需要删除
3. `services/console/internal/handlers/notifications.go` - 需要删除
4. `services/console/internal/handlers/feature_flags.go` - 需要删除
5. `services/console/internal/handlers/*_test.go` - 删除对应测试

### 数据库DDL清理
删除不再使用的表DDL初始化代码：
- [ ] `ensureFeatureFlagsDDL`
- [ ] `ensureNotificationsDDL`
- [ ] `ensureExportsDDL`
- [ ] `ensureInsightsDDL`

### 依赖的辅助文件
需要保留（被核心功能使用）：
- [x] `service_clients.go` - 服务间调用
- [x] `telemetry.go` - 遥测转发
- [x] `cache.go` - 缓存接口

可以删除：
- [ ] `aggregation.go` - Dashboard聚合逻辑
- [ ] `insights.go` - Insights聚合逻辑
- [ ] `marketing.go` - 营销数据聚合
- [ ] `navigation.go` - 导航配置
- [ ] `organization_analytics.go` - 组织分析
- [ ] `reports.go` - 报表生成
- [ ] `exports.go` - 导出中心

---

## 🔄 执行顺序

### Phase 1: 删除独立的辅助文件 ✅ 低风险
```bash
rm services/console/internal/handlers/dashboard.go
rm services/console/internal/handlers/dashboard_enhanced.go
rm services/console/internal/handlers/insights.go
rm services/console/internal/handlers/marketing.go
rm services/console/internal/handlers/navigation.go
rm services/console/internal/handlers/organization_analytics.go
rm services/console/internal/handlers/aggregation.go
rm services/console/internal/handlers/reports.go
rm services/console/internal/handlers/notifications.go
rm services/console/internal/handlers/feature_flags_test.go
```

### Phase 2: 从http.go删除方法 ⚠️ 中风险
1. 标记要删除的方法（添加 `// DEPRECATED` 注释）
2. 删除RegisterRoutes中对应的路由注册
3. 删除方法实现
4. 删除相关的DDL初始化

### Phase 3: 重构保留代码 ⚠️ 中风险
1. 将保留的22个方法按模块拆分到独立文件
2. 更新http.go为纯路由注册文件(<150行)

### Phase 4: 测试验证 🔒 必须
1. 编译验证: `cd services/console && go build`
2. 单元测试: `go test ./...`
3. 集成测试: 启动服务并测试核心API

---

**准备就绪**: 等待确认执行
