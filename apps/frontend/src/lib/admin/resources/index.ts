/**
 * Admin Resources - 统一导出
 *
 * 所有后台管理资源hooks的统一导出点
 * 保持向后兼容，同时提供更好的代码组织
 */

// Financial Resources
export { useConsoleFinancialOverview } from './financial';

// Token Resources
export { useConsoleTokenStats, useConsoleTokenBalances } from './tokens';

// Offer Resources
export {
  useConsoleOfferStats,
  useConsoleOffers,
  useConsoleOfferQualityMetrics,
  useConsoleOfferFailureReasons,
  useConsoleFailureReasons,
  useConsoleProblemOffers,
} from './offers';

// Task Resources
export { useConsoleTaskStats, useConsoleTaskList } from './tasks';

// Ads Account Resources
export { useConsoleAdsAccountStats, useConsoleAdsAccounts } from './ads-accounts';

// Dashboard Resources
export { useConsoleDashboardMetrics, useConsoleRecentActivity } from './dashboard';

// Success Metrics Resources
export { useConsoleSuccessMetrics } from './success-metrics';

// System Alerts Resources
export { useConsoleSystemAlerts } from './system-alerts';

// Recovery Codes Resources
export { useConsoleRecoveryCodeStats, useConsoleRecoveryCodes } from './recovery-codes';

// Note: Other resource modules pending migration to this centralized location
// - Subscriptions
// - Users
// - Feature Flags
// - Notifications
// - Monitoring
// - Exports
// - Audit Logs
