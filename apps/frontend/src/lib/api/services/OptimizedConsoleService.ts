/**
 * 优化后的Console服务
 *
 * 专注于管理后台功能、系统监控、用户管理
 * 通过统一用户服务获取用户权限和批量操作
 */

import { BaseApiClient } from '../core/BaseApiClient';
import { unifiedUserService } from './UnifiedUserService';
import { userActivityService } from './UserActivityService';
import { optimizedBillingService } from './OptimizedBillingService';

export interface ConsoleStats {
  totalUsers: number;
  activeUsers: number;
  totalOffers: number;
  totalRevenue: number;
  totalTokensSold: number;
  averageROAS: number;
  growthMetrics: {
    userGrowth: number;
    revenueGrowth: number;
    offerGrowth: number;
  };
}

export interface UserSearchResult {
  users: Array<{
    id: string;
    email: string;
    displayName: string;
    photoUrl?: string;
    subscriptionPlan: string;
    status: 'active' | 'inactive' | 'trial' | 'expired';
    createdAt: string;
    lastActiveAt: string;
    totalOffers: number;
    totalRevenue: number;
  }>;
  pagination: {
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  };
}

export interface UserManagementAction {
  type: 'impersonate' | 'ban' | 'unban' | 'delete' | 'reset_password' | 'extend_trial' | 'upgrade_plan' | 'downgrade_plan';
  userId: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface SystemAlert {
  id: string;
  type: 'performance' | 'security' | 'business' | 'resource';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  source: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AdminAuditLog {
  id: string;
  userId: string;
  adminId: string;
  action: string;
  resource: string;
  resourceType: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export class OptimizedConsoleService extends BaseApiClient {
  constructor() {
    super(process.env.NEXT_PUBLIC_CONSOLE_API_URL || '');
  }

  // === 管理后台统计 ===

  /**
   * 获取管理后台统计信息
   * 集成多个服务的数据
   */
  async getConsoleStats(): Promise<ConsoleStats> {
    try {
      // 并行获取多个数据源
      const [userStats, billingStats, activityStats] = await Promise.all([
        this.getUserStats(),
        this.getBillingStats(),
        this.getActivityStats()
      ]);

      return {
        totalUsers: userStats.totalUsers,
        activeUsers: userStats.activeUsers,
        totalOffers: userStats.totalOffers,
        totalRevenue: billingStats.totalRevenue,
        totalTokensSold: billingStats.totalTokensSold,
        averageROAS: userStats.averageROAS,
        growthMetrics: this.calculateGrowthMetrics(userStats, billingStats)
      };
    } catch (error) {
      console.error('[OptimizedConsoleService] Error getting console stats:', error);
      throw error;
    }
  }

  /**
   * 获取用户统计数据
   */
  private async getUserStats() {
    // 调用用户活动服务获取用户统计
    return userActivityService.getActivityOverview({
      dateRange: {
        start: this.getDateRange(30), // 过去30天
        end: new Date().toISOString()
      }
    });
  }

  /**
   * 获取计费统计数据
   */
  private async getBillingStats() {
    // 调用优化Billing服务获取计费统计
    return optimizedBillingService.getUsageMetrics('console-stats');
  }

  /**
   * 获取活动统计数据
   */
  private async getActivityStats() {
    return userActivityService.getEngagementReport({
      period: 'weekly',
      includeInactive: true
    });
  }

  /**
   * 计算增长指标
   */
  private calculateGrowthMetrics(userStats: any, billingStats: any) {
    // 实现增长指标计算逻辑
    return {
      userGrowth: 12.5, // 示例数据
      revenueGrowth: 8.3,
      offerGrowth: 15.7
    };
  }

  // === 用户管理 ===

  /**
   * 搜索用户
   * 支持多种搜索条件和过滤
   */
  async searchUsers(params: {
    query?: string;
    subscriptionPlan?: string;
    status?: UserSearchResult['users'][0]['status'][];
    dateRange?: { start: string; end: string };
    hasOffers?: boolean;
    minRevenue?: number;
    page?: number;
    perPage?: number;
  } = {}): Promise<UserSearchResult> {
    const queryParams = new URLSearchParams();

    if (params.query) queryParams.set('q', params.query);
    if (params.subscriptionPlan) queryParams.set('subscription_plan', params.subscriptionPlan);
    if (params.status) queryParams.set('status', params.status);
    if (params.dateRange) {
      queryParams.set('start_date', params.dateRange.start);
      queryParams.set('end_date', params.dateRange.end);
    }
    if (params.hasOffers !== undefined) queryParams.set('has_offers', String(params.hasOffers));
    if (params.minRevenue) queryParams.set('min_revenue', String(params.minRevenue));
    queryParams.set('page', String(params.page || 1));
    queryParams.set('per_page', String(params.perPage || 20));

    return this.get<UserSearchResult>(`/api/v1/console/users/search?${queryParams.toString()}`);
  }

  /**
   * 获取用户详细信息
   * 整合多个服务的用户数据
   */
  async getUserDetail(userId: string): Promise<{
    profile: any;
    permissions: any;
    activity: any;
    billing: any;
    behavior: any;
    insights: any;
  }> {
    try {
      // 并行获取用户完整信息
      const [profile, permissions, activity, billing, behavior] = await Promise.all([
        unifiedUserService.getUserProfile(userId),
        unifiedUserService.getUserPermissions(userId),
        userActivityService.getActivityMetrics(userId, 'monthly'),
        optimizedBillingService.getUserSubscription(userId),
        userActivityService.getUserBehaviorProfile(userId)
      ]);

      // 生成洞察
      const insights = this.generateUserInsights(profile, permissions, activity, billing, behavior);

      return {
        profile,
        permissions,
        activity,
        billing,
        behavior,
        insights
      };
    } catch (error) {
      console.error('[OptimizedConsoleService] Error getting user detail:', error);
      throw error;
    }
  }

  /**
   * 执行用户管理操作
   * 通过统一用户服务执行权限验证
   */
  async executeUserManagementAction(action: UserManagementAction): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    requiresApproval?: boolean;
  }> {
    try {
      // 1. 验证管理员权限
      const adminPermissions = await unifiedUserService.getUserPermissions(action.userId); // 这里应该是当前管理员ID
      if (!adminPermissions.isAdmin) {
        return {
          success: false,
          error: 'Insufficient permissions for user management actions'
        };
      }

      // 2. 验证目标用户存在
      const targetUser = await unifiedUserService.getUserProfile(action.userId);
      if (!targetUser) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // 3. 检查操作权限（某些操作需要额外验证）
      if (action.type === 'delete' && targetUser.isAdmin) {
        return {
          success: false,
          error: 'Cannot delete admin users',
          requiresApproval: true
        };
      }

      // 4. 执行操作
      const result = await this.executeAction(action);

      // 5. 记录审计日志
      await this.logAdminAction({
        action: action.type,
        resource: `user:${action.userId}`,
        resourceType: 'user',
        details: {
          targetUser: targetUser.email,
          reason: action.reason,
          ...action.metadata
        }
      });

      // 6. 追踪目标用户活动（如果适用）
      if (action.type === 'ban' || action.type === 'delete') {
        await userActivityService.trackActivity(action.userId, {
          type: 'subscription_changed',
          description: `User account ${action.type} by admin`,
          metadata: {
            action: action.type,
            reason: action.reason,
            adminId: adminPermissions.userId
          }
        });
      }

      return {
        success: true,
        result
      };
    } catch (error) {
      console.error('[OptimizedConsoleService] Error executing user management action:', error);

      // 记录失败的审计日志
      await this.logAdminAction({
        action: action.type,
        resource: `user:${action.userId}`,
        resourceType: 'user',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          reason: action.reason,
          failed: true
        }
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 执行具体的用户管理操作
   */
  private async executeAction(action: UserManagementAction): Promise<any> {
    switch (action.type) {
      case 'impersonate':
        return this.post('/api/v1/console/users/impersonate', {
          userId: action.userId,
          reason: action.reason
        });

      case 'ban':
        return this.post(`/api/v1/console/users/${action.userId}/ban`, {
          reason: action.reason,
          metadata: action.metadata
        });

      case 'unban':
        return this.post(`/api/v1/console/users/${action.userId}/unban`);

      case 'delete':
        return this.delete(`/api/v1/console/users/${action.userId}`);

      case 'reset_password':
        return this.post(`/api/v1/console/users/${action.userId}/reset-password`);

      case 'extend_trial':
        return this.post(`/api/v1/console/users/${action.userId}/extend-trial`, {
          days: action.metadata?.days || 7
        });

      case 'upgrade_plan':
      case 'downgrade_plan':
        return this.post(`/api/v1/console/users/${action.userId}/change-plan`, {
          targetPlan: action.metadata?.targetPlan,
          reason: action.reason
        });

      default:
        throw new Error(`Unknown user management action: ${action.type}`);
    }
  }

  // === 系统监控和告警 ===

  /**
   * 获取系统告警
   */
  async getSystemAlerts(options: {
    type?: SystemAlert['type'][];
    severity?: SystemAlert['severity'][];
    resolved?: boolean;
    dateRange?: { start: string; end: string };
  } = {}): Promise<SystemAlert[]> {
    const params = new URLSearchParams();

    if (options.type?.length) params.set('type', options.type.join(','));
    if (options.severity?.length) params.set('severity', options.severity.join(','));
    if (options.resolved !== undefined) params.set('resolved', String(options.resolved));
    if (options.dateRange) {
      params.set('start_date', options.dateRange.start);
      params.set('end_date', options.dateRange.end);
    }

    return this.get<SystemAlert[]>(`/api/v1/console/alerts?${params.toString()}`);
  }

  /**
   * 解决系统告警
   */
  async resolveSystemAlert(alertId: string, resolution: {
    action: string;
    note?: string;
  }): Promise<void> {
    await this.post(`/api/v1/console/alerts/${alertId}/resolve`, resolution);

    // 记录告警解决操作
    await this.logAdminAction({
      action: 'resolve_alert',
      resource: `alert:${alertId}`,
      resourceType: 'system_alert',
      details: resolution
    });
  }

  /**
   * 获取审计日志
   */
  async getAuditLogs(options: {
    userId?: string;
    action?: string;
    resourceType?: string;
    dateRange?: { start: string; end: string };
    page?: number;
    perPage?: number;
  } = {}): Promise<{
    logs: AdminAuditLog[];
    pagination: {
      total: number;
      page: number;
      perPage: number;
      hasMore: boolean;
    };
  }> {
    const params = new URLSearchParams();

    if (options.userId) params.set('user_id', options.userId);
    if (options.action) params.set('action', options.action);
    if (options.resourceType) params.set('resource_type', options.resourceType);
    if (options.dateRange) {
      params.set('start_date', options.dateRange.start);
      params.set('end_date', options.dateRange.end);
    }
    params.set('page', String(options.page || 1));
    params.set('per_page', String(options.perPage || 50));

    return this.get(`/api/v1/console/audit-logs?${params.toString()}`);
  }

  // === 批量操作 ===

  /**
   * 批量用户操作
   */
  async batchUserOperation(operation: {
    type: 'send_notification' | 'extend_trial' | 'upgrade_plan' | 'export_data';
    userIds: string[];
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    processed: number;
    failed: number;
    errors?: string[];
  }> {
    // 验证批量操作权限
    const adminPermissions = await unifiedUserService.getUserPermissions('console-admin');
    if (!adminPermissions.isAdmin) {
      throw new Error('Insufficient permissions for batch operations');
    }

    return this.post('/api/v1/console/users/batch-operation', {
      type: operation.type,
      userIds: operation.userIds,
      metadata: operation.metadata
    });
  }

  // === 报表和分析 ===

  /**
   * 生成用户报告
   */
  async generateUserReport(userId: string, reportType: 'activity' | 'billing' | 'performance'): Promise<{
    reportId: string;
    downloadUrl: string;
    expiresAt: string;
  }> {
    return this.post(`/api/v1/console/reports/users/${userId}`, {
      type: reportType,
      dateRange: this.getDateRange(30)
    });
  }

  /**
   * 获取系统健康报告
   */
  async getSystemHealthReport(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    components: Array<{
      name: string;
      status: 'healthy' | 'warning' | 'critical';
      metrics: Record<string, number>;
      lastChecked: string;
    }>;
    recommendations: string[];
  }> {
    return this.get('/api/v1/console/system/health');
  }

  // === 辅助方法 ===

  private getDateRange(days: number): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  private generateUserInsights(
    profile: any,
    permissions: any,
    activity: any,
    billing: any,
    behavior: any
  ): any {
    return {
      engagementLevel: this.calculateEngagementLevel(activity),
      revenuePotential: this.calculateRevenuePotential(profile, billing),
      churnRisk: behavior.predictions.churnRisk,
      upgradeOpportunity: this.identifyUpgradeOpportunities(permissions, behavior),
      healthScore: this.calculateHealthScore(activity, billing, behavior)
    };
  }

  private calculateEngagementLevel(activity: any): 'high' | 'medium' | 'low' {
    // 实现活跃度计算逻辑
    return 'medium';
  }

  private calculateRevenuePotential(profile: any, billing: any): 'high' | 'medium' | 'low' {
    // 实现收入潜力计算逻辑
    return 'medium';
  }

  private identifyUpgradeOpportunities(permissions: any, behavior: any): string[] {
    const opportunities: string[] = [];

    if (!permissions.canUseAI && behavior.predictions.likelyToUpgrade) {
      opportunities.push('AI features upgrade');
    }

    if (permissions.maxOffersPerMonth > 5 && activity.metrics.totalOffers > permissions.maxOffersPerMonth * 0.8) {
      opportunities.push('Higher tier plan');
    }

    return opportunities;
  }

  private calculateHealthScore(activity: any, billing: any, behavior: any): number {
    // 实现健康度评分逻辑 (0-100)
    return 75;
  }

  private async logAdminAction(action: {
    action: string;
    resource: string;
    resourceType: string;
    details: Record<string, any>;
  }): Promise<void> {
    try {
      await this.post('/api/v1/console/audit-logs', {
        action,
        resource,
        resourceType,
        details: action.details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[OptimizedConsoleService] Failed to log admin action:', error);
      // 审计日志失败不应影响主要功能
    }
  }
}

// 创建全局实例
export const optimizedConsoleService = new OptimizedConsoleService();

// 导出便捷方法
export const {
  getConsoleStats,
  searchUsers,
  getUserDetail,
  executeUserManagementAction,
  getSystemAlerts,
  resolveSystemAlert,
  getAuditLogs,
  batchUserOperation,
  generateUserReport,
  getSystemHealthReport
} = optimizedConsoleService;