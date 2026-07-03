/**
 * Admin Resources - 向后兼容导出
 *
 * 此文件保持向后兼容性，所有资源已拆分到 resources/ 子目录
 *
 * 已迁移模块：
 * - Financial (财务) - resources/financial.ts
 * - Tokens (Token管理) - resources/tokens.ts
 * - Offers (Offer管理) - resources/offers.ts
 * - Tasks (任务) - resources/tasks.ts
 * - Ads Accounts (广告账号) - resources/ads-accounts.ts
 *
 * 待迁移模块 (从原文件614行中)：
 * - Subscriptions (订阅管理)
 * - Recovery Codes (恢复码)
 * - Success Metrics (成功指标)
 * - System Alerts (系统告警)
 * - Dashboard (仪表板)
 * - Users (用户管理)
 * - Feature Flags (功能开关)
 * - Notifications (通知)
 * - Monitoring (监控)
 * - Exports (导出)
 * - Audit Logs (审计日志)
 */

// 从模块化的文件中重新导出
export * from './resources';

// Legacy resources pending migration to individual modules
// Note: These will be gradually migrated to maintain clean architecture
