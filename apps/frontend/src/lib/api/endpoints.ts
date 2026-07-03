/**
 * API端点常量
 *
 * 🤖 本文件由 scripts/openapi/generate-endpoints.sh 自动生成
 * ⚠️  请勿手动修改！修改请更新 specs/openapi/*.yaml
 *
 * 【API开发三步法】
 * 1. 在 specs/openapi/*.yaml 定义OpenAPI规范
 * 2. 运行 scripts/openapi/generate.sh 生成代码
 * 3. Gateway通过render-gateway.sh自动部署
 */

export const API_ENDPOINTS = {
  /**
   * Billing服务 - 计费与订阅管理
   */
  BILLING: {
    TOKENS_BALANCE: '/api/v1/billing/tokens/balance',
    TOKENS_TRANSACTIONS: '/api/v1/billing/tokens/transactions',
    SUBSCRIPTION: '/api/v1/billing/subscription',
    TOKENS_RESERVE: '/api/v1/billing/tokens/reserve',
    TOKENS_COMMIT: '/api/v1/billing/tokens/commit',
    TOKENS_RELEASE: '/api/v1/billing/tokens/release',
    TOKENS_CREDIT_PURCHASED: '/api/v1/billing/tokens/credit/purchased',
    TOKENS_CREDIT_SUBSCRIPTION: '/api/v1/billing/tokens/credit/subscription',
    TOKENS_CONSISTENCY: '/api/v1/billing/tokens/consistency',
    TOKENS_CONSISTENCY_PLAN: '/api/v1/billing/tokens/consistency/plan',
    TOKENS_CONSISTENCY_REPAIR: '/api/v1/billing/tokens/consistency/repair',
    SUBSCRIPTIONS_ME: '/api/v1/billing/subscriptions/me',
    TOKENS_USAGE: '/api/v1/billing/tokens/usage',
    CONFIG_ALL: '/api/v1/billing/config/all',
    CONFIG_PRICING: '/api/v1/billing/config/pricing',
    CONFIG_PRICING_: (plan: string) => `/api/v1/billing/config/pricing/{plan}`,
    CONFIG_HISTORY: '/api/v1/billing/config/history',
    TRIAL_START: '/api/v1/billing/trial/start',
    TRIAL_STATUS: '/api/v1/billing/trial/status',
    TRIAL_CONVERT: '/api/v1/billing/trial/convert',
    ADMIN_PERMISSIONS: '/api/v1/billing/admin/permissions',
    ADMIN_TOKEN_COSTS: '/api/v1/billing/admin/token-costs',
  },

  /**
   * Offer服务 - Offer管理
   */
  OFFERS: {
    LIST: '/api/v1/offers',
    BATCH: '/api/v1/offers/batch',
    _BY_ID: (id: string) => `/api/v1/offers/${id}`,
    _BY_ID_STATUS: (id: string) => `/api/v1/offers/${id}/status`,
    _BY_ID_KPI: (id: string) => `/api/v1/offers/${id}/kpi`,
    _BY_ID_KPI_AGGREGATE: (id: string) => `/api/v1/offers/${id}/kpi/aggregate`,
    _BY_ID_PREFERENCES: (id: string) => `/api/v1/offers/${id}/preferences`,
    _BY_ID_ACCOUNTS: (id: string) => `/api/v1/offers/${id}/accounts`,
    _ACCOUNT_BY_ID: (id: string, accountId: string) => `/api/v1/offers/${id}/accounts/${accountId}`,
    _BY_ID_EVALUATE: (id: string) => `/api/v1/offers/${id}/evaluate`,
    _BY_ID_EVALUATION: (id: string) => `/api/v1/offers/${id}/evaluation`,
    _BY_ID_REVENUES: (id: string) => `/api/v1/offers/${id}/revenues`,
    _REVENUE_BY_ID: (id: string, revenueId: string) => `/api/v1/offers/${id}/revenues/${revenueId}`,
    _BY_ID_COUNTRIES: (id: string) => `/api/v1/offers/${id}/countries`,
  },

  /**
   * AdsCenter服务 - 广告管理中心
   */
  ADSCENTER: {
    ACCOUNTS: '/api/v1/adscenter/accounts',
    ACCOUNTS_: (id: string) => `/api/v1/adscenter/accounts/${id}`,
    ACCOUNTS_STREAM: '/api/v1/adscenter/accounts/stream',
    ACCOUNTS_SYNC_ALL: '/api/v1/adscenter/accounts/sync-all',
    STRATEGIES: '/api/v1/adscenter/strategies',
    EXECUTION_REPORT: '/api/v1/adscenter/execution-report',
    BUDGET_TRANSFER: '/api/v1/adscenter/budget/transfer',
    CONFIGURATIONS: '/api/v1/adscenter/configurations',
    CONFIGURATIONS_: (id: string) => `/api/v1/adscenter/configurations/${id}`,
    EXECUTIONS: '/api/v1/adscenter/executions',
    PREFLIGHT: '/api/v1/adscenter/preflight',
    BULK_ACTIONS: '/api/v1/adscenter/bulk-actions',
    BULK_ACTIONS_: (id: string) => `/api/v1/adscenter/bulk-actions/${id}`,
    BULK_ACTIONS__PLAN: (id: string) => `/api/v1/adscenter/bulk-actions/${id}/plan`,
    BULK_ACTIONS_VALIDATE: '/api/v1/adscenter/bulk-actions/validate',
    BULK_ACTIONS__AUDITS: (id: string) => `/api/v1/adscenter/bulk-actions/${id}/audits`,
    BULK_ACTIONS__ROLLBACK: (id: string) => `/api/v1/adscenter/bulk-actions/${id}/rollback`,
    BULK_ACTIONS__ROLLBACK_PLAN: (id: string) => `/api/v1/adscenter/bulk-actions/${id}/rollback-plan`,
    BULK_ACTIONS__ROLLBACK_EXECUTE: (id: string) => `/api/v1/adscenter/bulk-actions/${id}/rollback-execute`,
    BULK_ACTIONS__REPORT: (id: string) => `/api/v1/adscenter/bulk-actions/${id}/report`,
    SETTINGS_LINK_ROTATION: '/api/v1/adscenter/settings/link-rotation',
    MCC_LINK: '/api/v1/adscenter/mcc/link',
    MCC_STATUS: '/api/v1/adscenter/mcc/status',
    MCC_UNLINK: '/api/v1/adscenter/mcc/unlink',
    MCC_REFRESH: '/api/v1/adscenter/mcc/refresh',
    MCC_LINKS: '/api/v1/adscenter/mcc/links',
    CONNECTIONS: '/api/v1/adscenter/connections',
    AUDITS: '/api/v1/adscenter/audits',
    KEYWORDS_EXPAND: '/api/v1/adscenter/keywords/expand',
    DIAGNOSE: '/api/v1/adscenter/diagnose',
    DIAGNOSE_PLAN: '/api/v1/adscenter/diagnose/plan',
    DIAGNOSE_METRICS: '/api/v1/adscenter/diagnose/metrics',
    DIAGNOSE_EXECUTE: '/api/v1/adscenter/diagnose/execute',
    LIMITS_ME: '/api/v1/adscenter/limits/me',
  },

  /**
   * Console服务 - 管理后台专用
   * ⚠️ 用户Dashboard请直接调用微服务API（Offers、Billing等）
   */
  CONSOLE: {
    SLO: '/api/v1/console/slo',
    ALERTS: '/api/v1/console/alerts',
    INCIDENTS: '/api/v1/console/incidents',
    NOTIFICATIONS_RULES: '/api/v1/console/notifications/rules',
    NOTIFICATIONS_RULES_: (id: string) => `/api/v1/console/notifications/rules/${id}`,
    NOTIFICATIONS_RULES_EVALUATE: '/api/v1/console/notifications/rules/evaluate',
    NOTIFICATIONS_SETTINGS: '/api/v1/console/notifications/settings',
    OFFERS_KPI_DEADLETTERS: '/api/v1/console/offers/kpi/deadletters',
    OFFERS_KPI_RETRY: '/api/v1/console/offers/kpi/retry',
    STATS: '/api/v1/console/stats',
    NAVIGATION: '/api/v1/console/navigation',
    USERS: '/api/v1/console/users',
    USERS_: (id: string) => `/api/v1/console/users/${id}`,
    USERS__SUBSCRIPTION: (id: string) => `/api/v1/console/users/${id}/subscription`,
    USERS__TOKENS: (id: string) => `/api/v1/console/users/${id}/tokens`,
    TASKS: '/api/v1/console/tasks',
    TASKS_STREAM: '/api/v1/console/tasks/stream',
    TASKS_STATS: '/api/v1/console/tasks/stats',
    TASKS__CANCEL: (id: string) => `/api/v1/console/tasks/${id}/cancel`,
    TASKS__RETRY: (id: string) => `/api/v1/console/tasks/${id}/retry`,
    DASHBOARD_STATS: '/api/v1/console/dashboard/stats',
    DASHBOARD_: (userId: string) => `/api/v1/console/dashboard/${userId}`,
  },

  /**
   * Recommendations服务 - 推荐与风险检测
   */
  RECOMMENDATIONS: {
    KEYWORDS_BRAND_CHECK: '/api/v1/recommend/keywords/brand-check',
    INTERNAL_OFFLINE_BRAND_AUDIT: '/api/v1/recommend/internal/offline/brand-audit',
    INTERNAL_OFFLINE_BRAND_COVERAGE_AUDIT: '/api/v1/recommend/internal/offline/brand-coverage-audit',
    BRAND_COVERAGE: '/api/v1/recommend/brand-coverage',
    BRAND_COVERAGE_PLANNED: '/api/v1/recommend/brand-coverage/planned',
    KEYWORDS_BRAND_PROFILE: '/api/v1/recommend/keywords/brand-profile',
    KEYWORDS_BRAND_RESULTS: '/api/v1/recommend/keywords/brand-results',
    OPPORTUNITIES: '/api/v1/recommend/opportunities',
    OPPORTUNITIES_: (id: string) => `/api/v1/recommend/opportunities/{id}`,
  },

  /**
   * UserActivity服务 - 用户活动管理
   */
  USERACTIVITY: {
    CHECKIN: '/api/v1/check-in',
    CHECKIN_STATUS: '/api/v1/check-in/status',
    CHECKIN_HISTORY: '/api/v1/check-in/history',
    REFERRAL: '/api/v1/referral',
  },

  /**
   * 健康检查端点
   */
  HEALTH: {
    /** Gateway就绪检查 */
    READYZ: '/readyz',
    /** 整体健康检查 */
    AGGREGATE: '/api/health',
    /** AdsCenter健康检查 */
    ADSCENTER: '/api/health/adscenter',
    /** Console健康检查 */
    CONSOLE: '/api/health/console',
    /** Billing健康检查 */
    BILLING: '/api/health/billing',
  },
} as const;

/**
 * 类型提取工具
 */
export type ApiEndpoints = typeof API_ENDPOINTS;
export type BillingEndpoints = ApiEndpoints['BILLING'];
export type UserActivityEndpoints = ApiEndpoints['USERACTIVITY'];
export type OffersEndpoints = ApiEndpoints['OFFERS'];
export type AdsCenterEndpoints = ApiEndpoints['ADSCENTER'];
export type ConsoleEndpoints = ApiEndpoints['CONSOLE'];
export type NotificationsEndpoints = ApiEndpoints['NOTIFICATIONS'];
export type RecommendationsEndpoints = ApiEndpoints['RECOMMENDATIONS'];
export type HealthEndpoints = ApiEndpoints['HEALTH'];
