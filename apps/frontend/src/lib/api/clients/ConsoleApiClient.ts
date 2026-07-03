/**
 * Console API 客户端
 *
 * 管理后台专用 API 客户端，提供：
 * - Token 管理
 * - Offer 管理
 * - Subscription 管理
 * - Recovery Codes
 * - Task 管理
 * - 监控和分析
 * - Feature Flags
 * - Notification 管理
 * - User 管理
 * - Export 管理
 *
 * @example
 * ```typescript
 * import { consoleApi } from '~/lib/api';
 *
 * const stats = await consoleApi.getTokenStats();
 * const offers = await consoleApi.getOffers({ page: 1, pageSize: 20 });
 * ```
 */

import BaseApiClient from '../core/BaseApiClient';
import type {
  // Token 相关类型
  TokenBalance,
  TokenStats,
  // Offer 相关类型
  Offer,
  OfferStats,
  // Subscription 相关类型
  Subscription,
  SubscriptionStats,
  // Recovery Code 相关类型
  RecoveryCode,
  RecoveryCodeStats,
  // Task 相关类型
  Task,
  TaskStats,
  // 监控相关类型
  MonitoringOverview,
  AdsAccountStats,
  AdsAccount,
  TokenTrendResponse,
  TopTokenConsumer,
  TopConsumersResponse,
  DashboardTrends,
  DashboardMetrics,
  RecentActivityResponse,
  SystemAlerts,
  InsightsResponse,
  // 财务相关类型
  FinancialOverview,
  MonthlyReportsResponse,
  RevenueTrendsResponse,
  OfferQualityMetrics,
  FailureReasonsResponse,
  ProblemOffersResponse,
  // 审计日志类型
  AuditLog,
  // Feature Flag 相关类型
  FeatureFlag,
  FeatureFlagListResponse,
  FeatureFlagHistoryResponse,
  // Notification 相关类型
  NotificationTemplate,
  NotificationTemplateListResponse,
  NotificationBroadcast,
  NotificationBroadcastListResponse,
  BroadcastStats,
  CreateNotificationTemplateRequest,
  BroadcastNotificationRequest,
  // 成功指标类型
  SuccessMetrics,
  NpsFeedbackRequest,
  // 用户管理类型
  User,
  UserActivityTimelineResponse,
  UserSearchResponse,
  // 导出管理类型
  ExportHistory,
  ExportStats,
} from '../types/console';

const CONSOLE_API_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console';

/**
 * Console API 客户端类
 * 继承自 BaseApiClient，自动处理认证和错误
 */
class ConsoleApiClient extends BaseApiClient {
  constructor() {
    super(CONSOLE_API_BASE_URL);
  }

  // ============================================================
  // Token Management APIs
  // ============================================================

  /**
   * 获取 Token 统计信息
   */
  async getTokenStats(options?: { signal?: AbortSignal }): Promise<TokenStats> {
    return this.get<TokenStats>('/tokens/stats', { signal: options?.signal });
  }

  /**
   * 获取 Token 余额列表
   */
  async getTokenBalances(
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: TokenBalance[]; total: number; totalPages: number }> {
    return this.get('/tokens/balances', { params, signal: options?.signal });
  }

  /**
   * 为用户充值 Token
   */
  async topUpTokens(data: {
    userId: string;
    amount: number;
    reason: string;
  }): Promise<void> {
    return this.post('/tokens/topup', data);
  }

  // ============================================================
  // Offer Management APIs
  // ============================================================

  /**
   * 获取 Offer 统计信息
   */
  async getOfferStats(options?: { signal?: AbortSignal }): Promise<OfferStats> {
    return this.get<OfferStats>('/offers/stats', { signal: options?.signal });
  }

  /**
   * 获取 Offer 列表
   */
  async getOffers(
    params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
      userEmail?: string;
      minScore?: number;
      maxScore?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: Offer[]; total: number; totalPages: number }> {
    return this.get('/offers', { params, signal: options?.signal });
  }

  /**
   * 批量归档 Offer
   */
  async batchArchiveOffers(data: {
    offerIds: string[];
    reason: string;
  }): Promise<void> {
    return this.post('/offers/batch-archive', data);
  }

  // ============================================================
  // Subscription Management APIs
  // ============================================================

  /**
   * 获取订阅统计信息
   */
  async getSubscriptionStats(options?: { signal?: AbortSignal }): Promise<SubscriptionStats> {
    return this.get<SubscriptionStats>('/subscriptions/stats', { signal: options?.signal });
  }

  /**
   * 获取订阅列表
   */
  async getSubscriptions(
    params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: Subscription[]; total: number; totalPages: number }> {
    return this.get('/subscriptions', { params, signal: options?.signal });
  }

  /**
   * 更新订阅状态
   */
  async updateSubscriptionStatus(
    subscriptionId: string,
    data: {
      status: string;
      reason?: string;
    },
  ): Promise<void> {
    return this.patch(`/subscriptions/${subscriptionId}/status`, data);
  }

  // ============================================================
  // Recovery Code APIs
  // ============================================================

  /**
   * 生成恢复码
   */
  async generateRecoveryCodes(data: {
    count?: number;
    expiryDays?: number;
    expiresInDays?: number;
    reason: string;
  }): Promise<RecoveryCode[]> {
    return this.post<RecoveryCode[]>('/recovery-codes/generate', data);
  }

  /**
   * 列出恢复码
   */
  async listRecoveryCodes(options?: { signal?: AbortSignal }): Promise<RecoveryCode[]> {
    return this.get<RecoveryCode[]>('/recovery-codes', { signal: options?.signal });
  }

  /**
   * 获取恢复码统计信息
   */
  async getRecoveryCodeStats(options?: { signal?: AbortSignal }): Promise<RecoveryCodeStats> {
    return this.get<RecoveryCodeStats>('/recovery-codes/stats', { signal: options?.signal });
  }

  // ============================================================
  // Task Management APIs
  // ============================================================

  /**
   * 获取任务统计信息
   */
  async getTaskStats(options?: { signal?: AbortSignal }): Promise<TaskStats> {
    return this.get<TaskStats>('/tasks/stats', { signal: options?.signal });
  }

  /**
   * 获取任务列表
   */
  async getTasks(
    params: {
      page?: number;
      limit?: number;
      pageSize?: number;
      status?: string;
      userId?: string;
      type?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: Task[]; total: number; totalPages: number }> {
    return this.get('/tasks', { params, signal: options?.signal });
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string, reason: string): Promise<void> {
    return this.post(`/tasks/${taskId}/cancel`, { reason });
  }

  /**
   * 重试任务
   */
  async retryTask(taskId: string): Promise<void> {
    return this.post(`/tasks/${taskId}/retry`);
  }

  // ============================================================
  // Monitoring APIs
  // ============================================================

  /**
   * 获取监控概览
   */
  async getMonitoringOverview(options?: { signal?: AbortSignal }): Promise<MonitoringOverview> {
    return this.get<MonitoringOverview>('/monitoring/overview', { signal: options?.signal });
  }

  /**
   * 订阅监控概览的实时更新（SSE）
   */
  async streamMonitoringOverview(options?: { signal?: AbortSignal }): Promise<Response> {
    return this.requestRaw('/monitoring/stream', {
      signal: options?.signal,
      headers: {
        Accept: 'text/event-stream',
      },
    });
  }

  /**
   * 获取 AI Insights Feed
   */
  async getInsights(options?: { signal?: AbortSignal }): Promise<InsightsResponse> {
    return this.get('/insights', { signal: options?.signal });
  }

  /**
   * 订阅 AI Insights 实时更新
   */
  async streamInsights(options?: { signal?: AbortSignal }): Promise<Response> {
    return this.requestRaw('/insights/stream', {
      signal: options?.signal,
      headers: {
        Accept: 'text/event-stream',
      },
    });
  }

  /**
   * 获取广告账户统计信息
   */
  async getAdsAccountStats(options?: { signal?: AbortSignal }): Promise<AdsAccountStats> {
    return this.get<AdsAccountStats>('/monitoring/ads-accounts/stats', { signal: options?.signal });
  }

  /**
   * 获取广告账户列表
   */
  async getAdsAccounts(
    params: {
      page?: number;
      pageSize?: number;
      limit?: number;
      status?: string;
      provider?: string;
      search?: string;
      userId?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: AdsAccount[]; total: number; totalPages: number }> {
    return this.get('/monitoring/ads-accounts', { params, signal: options?.signal });
  }

  /**
   * 获取 Token 消费趋势
   */
  async getTokenConsumptionTrend(
    days: number = 30,
    options?: { signal?: AbortSignal },
  ): Promise<TokenTrendResponse> {
    return this.get('/monitoring/token-consumption-trend', { params: { days }, signal: options?.signal });
  }

  /**
   * 获取 Token 消费 Top 用户
   */
  async getTopTokenConsumers(
    params?: {
      limit?: number;
      period?: string;
      days?: number;
    },
    options?: { signal?: AbortSignal },
  ): Promise<TopConsumersResponse> {
    return this.get<TopConsumersResponse>('/monitoring/top-token-consumers', { params, signal: options?.signal });
  }

  /**
   * 获取 Dashboard 趋势
   */
  async getDashboardTrends(
    days: number = 30,
    options?: { signal?: AbortSignal },
  ): Promise<DashboardTrends> {
    return this.get('/monitoring/dashboard-trends', { params: { days }, signal: options?.signal });
  }

  /**
   * 获取 Dashboard 指标
   */
  async getDashboardMetrics(options?: { signal?: AbortSignal }): Promise<DashboardMetrics> {
    return this.get<DashboardMetrics>('/monitoring/dashboard-metrics', { signal: options?.signal });
  }

  /**
   * 获取最近活动
   */
  async getRecentActivity(
    limit: number = 10,
    options?: { signal?: AbortSignal },
  ): Promise<RecentActivityResponse> {
    return this.get('/monitoring/recent-activity', { params: { limit }, signal: options?.signal });
  }

  /**
   * 获取系统告警
   */
  async getSystemAlerts(options?: { signal?: AbortSignal }): Promise<SystemAlerts> {
    return this.get<SystemAlerts>('/monitoring/system-alerts', { signal: options?.signal });
  }

  // ============================================================
  // Financial APIs
  // ============================================================

  /**
   * 获取财务概览
   */
  async getFinancialOverview(): Promise<FinancialOverview> {
    return this.get<FinancialOverview>('/financial/overview');
  }

  /**
   * 获取月度报告
   */
  async getMonthlyReports(months: number = 12): Promise<MonthlyReportsResponse> {
    return this.get('/financial/monthly-reports', { params: { months } });
  }

  /**
   * 获取收入趋势
   */
  async getRevenueTrends(days: number = 90): Promise<RevenueTrendsResponse> {
    return this.get('/financial/revenue-trends', { params: { days } });
  }

  // ============================================================
  // Quality Monitoring APIs
  // ============================================================

  /**
   * 获取 Offer 质量指标
   */
  async getOfferQualityMetrics(options?: { signal?: AbortSignal }): Promise<OfferQualityMetrics> {
    return this.get<OfferQualityMetrics>('/quality/offer-metrics', { signal: options?.signal });
  }

  /**
   * 获取失败原因统计
   */
  async getFailureReasons(options?: { signal?: AbortSignal }): Promise<FailureReasonsResponse> {
    return this.get<FailureReasonsResponse>('/quality/failure-reasons', { signal: options?.signal });
  }

  /**
   * 获取问题 Offer 列表
   */
  async getProblemOffers(options?: { signal?: AbortSignal }): Promise<ProblemOffersResponse> {
    return this.get<ProblemOffersResponse>('/quality/problem-offers', { signal: options?.signal });
  }

  // ============================================================
  // Audit Log APIs
  // ============================================================

  /**
   * 获取审计日志
   */
  async getAuditLogs(
    params?: {
      page?: number;
      pageSize?: number;
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: string;
      endDate?: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: AuditLog[]; total: number; totalPages: number }> {
    return this.get('/audit-logs', { params, signal: options?.signal });
  }

  // ============================================================
  // Feature Flag APIs
  // ============================================================

  /**
   * 列出所有 Feature Flag
   */
  async listFeatureFlags(options?: { signal?: AbortSignal }): Promise<FeatureFlagListResponse> {
    return this.get<FeatureFlagListResponse>('/feature-flags', { signal: options?.signal });
  }

  /**
   * 获取 Feature Flag 历史记录
   */
  async getFeatureFlagHistory(
    key?: string,
    options?: { signal?: AbortSignal },
  ): Promise<FeatureFlagHistoryResponse> {
    return this.get('/feature-flags/history', {
      params: key ? { key } : undefined,
      signal: options?.signal,
    });
  }

  /**
   * 创建 Feature Flag
   */
  async createFeatureFlag(payload: {
    key: string;
    name?: string;
    description: string;
    enabled: boolean;
    reason?: string;
    rollout_percentage?: number;
  }): Promise<{ status: string }> {
    return this.post('/config/feature-flags', payload);
  }

  /**
   * 更新 Feature Flag
   */
  async updateFeatureFlag(
    key: string,
    payload: {
      name?: string;
      description?: string;
      enabled?: boolean;
      reason?: string;
      rollout_percentage?: number;
    },
  ): Promise<{ status: string }> {
    return this.put(`/config/feature-flags/${encodeURIComponent(key)}`, payload);
  }

  /**
   * 删除 Feature Flag
   */
  async deleteFeatureFlag(key: string): Promise<{ status: string }> {
    return this.delete(`/feature-flags/${key}`);
  }

  // ============================================================
  // Notification Management APIs
  // ============================================================

  /**
   * 列出所有通知模板
   */
  async listNotificationTemplates(options?: { signal?: AbortSignal }): Promise<NotificationTemplateListResponse> {
    return this.get<NotificationTemplateListResponse>('/notifications/templates', { signal: options?.signal });
  }

  /**
   * 列出所有广播通知
   */
  async listBroadcasts(options?: { signal?: AbortSignal }): Promise<NotificationBroadcastListResponse> {
    return this.get<NotificationBroadcastListResponse>('/notifications/broadcasts', { signal: options?.signal });
  }

  /**
   * 获取广播统计信息
   */
  async getBroadcastStats(options?: { signal?: AbortSignal }): Promise<BroadcastStats> {
    return this.get<BroadcastStats>('/notifications/broadcasts/stats', { signal: options?.signal });
  }

  /**
   * 创建通知模板
   */
  async createNotificationTemplate(
    payload: CreateNotificationTemplateRequest,
  ): Promise<{ template_id: string }> {
    return this.post('/notifications/templates/create', payload);
  }

  /**
   * 广播通知
   */
  async broadcastNotification(
    payload: BroadcastNotificationRequest,
  ): Promise<{ broadcast_id: string; totalTargets: number }> {
    return this.post('/notifications/broadcasts/send', payload);
  }

  /**
   * 预览通知模板
   */
  async previewNotificationTemplate(payload: {
    template_id: string;
    variables: Record<string, any>;
  }): Promise<{
    subject: string;
    body: string;
    html: string;
  }> {
    return this.post('/notifications/templates/preview', payload);
  }

  // ============================================================
  // Success Metrics APIs
  // ============================================================

  /**
   * 获取成功指标
   */
  async getSuccessMetrics(options?: { signal?: AbortSignal }): Promise<SuccessMetrics> {
    return this.get<SuccessMetrics>('/success-metrics', { signal: options?.signal });
  }

  /**
   * 提交 NPS 反馈
   */
  async submitNpsFeedback(payload: NpsFeedbackRequest): Promise<void> {
    return this.post('/success-metrics/nps-feedback', payload);
  }

  // ============================================================
  // User Management APIs
  // ============================================================

  /**
   * 搜索用户
   */
  async searchUsers(
    params: {
      q?: string;
      query?: string;
      status?: string;
      tag?: string;
      limit?: number;
    },
    options?: { signal?: AbortSignal },
  ): Promise<UserSearchResponse> {
    return this.get<UserSearchResponse>('/users/search', { params, signal: options?.signal });
  }

  /**
   * 获取用户活动时间线
   */
  async getUserActivityTimeline(
    userId: string,
    limit: number = 20,
    options?: { signal?: AbortSignal },
  ): Promise<UserActivityTimelineResponse> {
    return this.get(`/users/${userId}/activity-timeline`, { params: { limit }, signal: options?.signal });
  }

  /**
   * 为用户添加标签
   */
  async addUserTag(
    userId: string,
    tag: string,
    note?: string,
  ): Promise<{ status: string }> {
    return this.post(`/users/${userId}/tags`, { tag, note });
  }

  /**
   * 移除用户标签
   */
  async removeUserTag(userId: string, tag: string): Promise<{ status: string }> {
    return this.delete(`/users/${userId}/tags/${tag}`);
  }

  // ============================================================
  // Export Management APIs
  // ============================================================

  /**
   * 获取导出历史记录
   */
  async getExportHistory(options?: { signal?: AbortSignal }): Promise<{ history: ExportHistory[]; total: number }> {
    return this.get('/exports/history', { signal: options?.signal });
  }

  /**
   * 记录导出操作
   */
  async recordExport(params: {
    type: string;
    format: string;
    start_date?: string;
    end_date?: string;
    record_count: number;
  }): Promise<{ success: boolean; export_id: string }> {
    return this.post('/exports/record', params);
  }

  /**
   * 获取导出统计信息
   */
  async getExportStats(options?: { signal?: AbortSignal }): Promise<ExportStats> {
    return this.get<ExportStats>('/exports/stats', { signal: options?.signal });
  }
}

// 导出单例实例
export const consoleApi = new ConsoleApiClient();

// 导出类型（用于扩展）
export type { ConsoleApiClient };
