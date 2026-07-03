/**
 * Console API 类型定义
 *
 * 包含所有管理后台相关的类型定义：
 * - Token 管理
 * - Offer 管理
 * - Subscription 管理
 * - Recovery Codes
 * - Task 管理
 * - 监控和分析
 * - 财务报告
 * - Feature Flags
 * - Notification 管理
 * - User 管理
 * - Export 管理
 */

// ============================================================
// Token Management Types
// ============================================================

export interface TokenBalance {
  userId: string;
  userEmail: string;
  balance: number;
  lastTransaction?: string;
}

export interface TokenStats {
  totalUsers: number;
  totalTokens: number;
  averageBalance: number;
  negativeBalanceCount: number;
}

export interface TokenConsumptionTrend {
  date: string;
  consumed: number;
  userCount: number;
  taskCount: number;
}

export interface TokenTrendResponse {
  trends: TokenConsumptionTrend[];
  totalConsumed: number;
  period: string;
  updatedAt: string;
}

export interface TopTokenConsumer {
  userId: string;
  userEmail: string;
  totalConsumed: number;
  taskCount: number;
  avgPerTask: number;
  lastActivity: string;
}

export interface TopConsumersResponse {
  consumers: TopTokenConsumer[];
  total: number;
  updatedAt: string;
}

export interface TokenConsumptionMetrics {
  totalConsumed: number;
  last7Days: number;
  last30Days: number;
  dailyAverage: number;
  trend: TrendDataPoint[];
  topConsumers: MemberConsumption[];
}

export interface MemberConsumption {
  userId: string;
  userEmail: string;
  consumed: number;
  taskCount: number;
}

// ============================================================
// Offer Management Types
// ============================================================

export interface Offer {
  id: string;
  userId: string;
  name: string;
  originalUrl: string;
  status: string;
  siterankScore?: number;
  totalRevenue?: number;
  createdAt: string;
}

export interface OfferStats {
  total: number;
  pendingEvaluation: number;
  deployable: number;
  deployed: number;
  averageScore: number;
  totalRevenue: number;
}

export interface OfferPerformanceMetrics {
  totalOffers: number;
  deployedOffers: number;
  averageSiterank: number;
  totalRevenue: number;
  successRate: number;
}

export interface ScoreBucket {
  range: string;
  count: number;
}

export interface OfferQualityMetrics {
  totalOffers: number;
  failedEvaluations: number;
  failureRate: number;
  averageSiterank: number;
  medianSiterank: number;
  scoreDistribution: ScoreBucket[];
  deployedOffers: number;
  offersWithRevenue: number;
  conversionRate: number;
  weekOverWeek: number;
  monthOverMonth: number;
  updatedAt: string;
}

export interface FailureReason {
  reason: string;
  count: number;
  percentage: number;
}

export interface FailureReasonsResponse {
  reasons: FailureReason[];
  total: number;
  updatedAt: string;
}

export interface ProblemOffer {
  id: string;
  name: string;
  url: string;
  status: string;
  siterankScore: number;
  evaluationStatus: string;
  failureReason: string;
  createdAt: string;
  flagged: string;
}

export interface ProblemOffersResponse {
  offers: ProblemOffer[];
  total: number;
  updatedAt: string;
}

// ============================================================
// Subscription Management Types
// ============================================================

export interface Subscription {
  id: string;
  userId: string;
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionWithUser extends Subscription {
  userEmail: string;
  userName: string;
}

export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  canceledSubscriptions: number;
  recentSubscriptions: number;
  expiringSoon: number;
  planCounts: PlanCount[];
  growthTrend: DataPoint[];
}

export interface PlanCount {
  planName: string;
  count: number;
}

export interface DataPoint {
  date: string;
  count: number;
}

export interface AdjustSubscriptionRequest {
  planName?: string;
  status?: string;
  days?: number;
}

// ============================================================
// Recovery Code Types
// ============================================================

export interface RecoveryCode {
  id: string;
  code?: string; // Only returned on generation
  used: boolean;
  usedAt?: string;
  usedFromIp?: string;
  createdAt: string;
  expiresAt: string;
}

export interface RecoveryCodeStats {
  total: number;
  active: number;
  expired: number;
  used: number;
  available: number;
}

// ============================================================
// Task Management Types
// ============================================================

export interface Task {
  id: string;
  userId: string;
  organizationId: string;
  type: string;
  status: string;
  offerId?: string;
  offerUrl?: string;
  adsAccountId?: string;
  progress?: number;
  currentStep?: string;
  tokensConsumed: number;
  estimatedTokens?: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  tokensConsumed: number;
  avgTokensPerTask: number;
}

// ============================================================
// Monitoring Types
// ============================================================

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime?: number;
  lastCheck: string;
  message?: string;
}

export interface DatabaseMetrics {
  status: string;
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  totalQueries: number;
  slowQueries: number;
  avgQueryTime: number;
  databaseSize: number;
  lastBackup?: string;
}

export interface CacheMetrics {
  status: string;
  hitRate: number;
  hits: number;
  misses: number;
  keysCount: number;
  memoryUsed: number;
  memoryMax: number;
  evictedKeys: number;
  connectedClients: number;
}

export interface APIMetrics {
  totalRequests: number;
  errorRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  requestsPerMinute: number;
  activeConnections: number;
}

export interface ErrorLog {
  id: string;
  level: string;
  message: string;
  service: string;
  timestamp: string;
  details?: string;
}

export interface MonitoringOverview {
  services: ServiceHealth[];
  database: DatabaseMetrics;
  cache: CacheMetrics;
  api: APIMetrics;
  errorLogs: ErrorLog[];
  updatedAt: string;
}

export interface AdsAccount {
  id: string;
  userId: string;
  organizationId: string;
  accountId: string;
  accountName: string;
  provider: string;
  status: string;
  currencyCode: string;
  totalCost: number;
  totalRevenue: number;
  roas: number;
  linkedOffersCount: number;
  activeCampaignsCount: number;
  connectedAt: string;
  lastSyncedAt?: string;
  createdAt: string;
}

// Backward compatibility alias
export type AdsAccountAdmin = AdsAccount;

export interface AdsAccountStats {
  total: number;
  active: number;
  suspended: number;
  disconnected: number;
  totalCost: number;
  totalRevenue: number;
  averageRoas: number;
  linkedOffersCount: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
  change?: number;
}

export interface DashboardTrends {
  userGrowth: TrendDataPoint[];
  revenueGrowth: TrendDataPoint[];
  tokenConsumption: TrendDataPoint[];
  offerCreation: TrendDataPoint[];
  taskCompletion: TrendDataPoint[];
  period: string;
  updatedAt: string;
}

export interface DashboardMetrics {
  taskSuccessRate: number;
  avgTaskDuration: number;
  totalTasksToday: number;
  runningTasks: number;
  averageRoas: number;
  totalAdSpend: number;
  totalAdRevenue: number;
  avgResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  activeUsersToday: number;
  avgSessionDuration: number;
  updatedAt: string;
}

export interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  userEmail?: string;
  severity?: string;
  timestamp: string;
}

export interface RecentActivityResponse {
  activities: RecentActivity[];
  total: number;
  updatedAt: string;
}

export interface SystemAlerts {
  highErrorRate: boolean;
  serviceDown: boolean;
  databaseSlowQueries: boolean;
  highMemoryUsage: boolean;
  errorRateValue: number;
  slowQueryCount: number;
  memoryUsagePercent: number;
  updatedAt: string;
}

export interface MemberActivityMetrics {
  activeMembers7d: number;
  activeMembers30d: number;
  totalTasks: number;
  completedTasks: number;
  successRate: number;
  avgTasksPerUser: number;
}

export interface OrganizationQuotas {
  tokenLimit: number;
  tokenUsed: number;
  tokenUsagePercent: number;
  memberLimit: number;
  memberCount: number;
  memberUsagePercent: number;
}

// ============================================================
// Financial Report Types
// ============================================================

export interface FinancialOverview {
  totalRevenue: number;
  subscriptionRevenue: number;
  tokenRevenue: number;
  offerRevenue: number;
  totalCost: number;
  tokenCost: number;
  adCost: number;
  grossProfit: number;
  profitMargin: number;
  mrr: number;
  arr: number;
  period: string;
  updatedAt: string;
}

export interface MonthlyReport {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  profitMargin: number;
  newSubscriptions: number;
  churn: number;
  netSubscriptions: number;
}

export interface MonthlyReportsResponse {
  reports: MonthlyReport[];
  total: number;
  updatedAt: string;
}

export interface RevenueTrend {
  date: string;
  subscriptionRevenue: number;
  tokenRevenue: number;
  offerRevenue: number;
  totalRevenue: number;
}

export interface RevenueTrendsResponse {
  trends: RevenueTrend[];
  period: string;
  updatedAt: string;
}

// ============================================================
// Audit Log Types
// ============================================================

export interface AuditLog {
  id: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  reason?: string;
  ipAddress?: string;
  createdAt: string;
}

// ============================================================
// Feature Flag Types
// ============================================================

export interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  created_at?: string;
  updated_at: string;
  updated_by?: string;
}

export interface FeatureFlagHistory {
  id: string;
  key: string;
  old_value: boolean;
  new_value: boolean;
  reason?: string;
  changed_at: string;
  changed_by?: string;
}

export interface FeatureFlagListResponse {
  flags: FeatureFlag[];
  total: number;
  updatedAt?: string;
}

export interface FeatureFlagHistoryResponse {
  history: FeatureFlagHistory[];
  key?: string;
}

// ============================================================
// Notification Management Types
// ============================================================

export interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateNotificationTemplateRequest {
  name: string;
  type: string;
  subject: string;
  body: string;
  variables: string[];
}

export interface NotificationBroadcast {
  id: string;
  templateId: string;
  templateName: string;
  status: string;
  targetGroup: string;
  totalTargets: number;
  sent: number;
  failed: number;
  createdAt: string;
}

export interface BroadcastStats {
  totalBroadcasts: number;
  totalSent: number;
  totalFailed: number;
  successRate: number;
}

export interface NotificationTemplateListResponse {
  templates: NotificationTemplate[];
  total: number;
}

export interface NotificationBroadcastListResponse {
  broadcasts: NotificationBroadcast[];
  total: number;
}

export interface BroadcastNotificationRequest {
  templateId: string;
  targetGroup: string;
  filters?: Record<string, unknown>;
  sendAt?: string;
}

export interface BroadcastNotificationResponse {
  broadcastId: string;
  totalTargets: number;
  status: string;
  scheduledAt?: string;
}

// ============================================================
// Success Metrics Types
// ============================================================

export interface SuccessMetrics {
  usersTotal: number;
  activatedUsers: number;
  returningUsers: number;
  activationRate: number;
  retentionRate: number;
  conversionRate: number;
  qualifiedOffers: number;
  updatedAt: string;
}

export interface NpsFeedbackRequest {
  score: number;
  comment?: string;
}

// ============================================================
// User Management Types
// ============================================================

export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  status: string;
  subscriptionTier: string;
  totalOffers: number;
  totalTasks: number;
  tokensConsumed: number;
  tags: string[];
  role?: string;
  createdAt: string;
}

export interface UserSearchResult extends User {
  // Alias for backward compatibility
}

export interface UserActivity {
  id: string;
  type: string;
  title?: string;
  description: string;
  timestamp: string;
  severity?: 'info' | 'warning' | 'error';
}

export interface UserActivityTimelineResponse {
  activities: UserActivity[];
  total: number;
}

export interface UserSearchResponse {
  users: UserSearchResult[];
  total: number;
}

// ============================================================
// Export Management Types
// ============================================================

export interface ExportHistory {
  id: string;
  type: string;
  format: string;
  status: string;
  start_date: string;
  end_date: string;
  record_count: number;
  file_size: number;
  created_by: string;
  created_at: string;
  completed_at?: string;
  error_msg: string;
}

export interface ExportStats {
  total_exports: number;
  today_exports: number;
  week_exports: number;
  total_records: number;
  type_breakdown: Record<string, number>;
}

// ============================================================
// Insights Types
// ============================================================

export interface InsightAction {
  label: string;
  url: string;
}

export interface Insight {
  id: string;
  category: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  action?: InsightAction;
  createdAt: string;
  meta?: Record<string, string>;
}

export interface InsightsResponse {
  items: Insight[];
  generatedAt: string;
}
