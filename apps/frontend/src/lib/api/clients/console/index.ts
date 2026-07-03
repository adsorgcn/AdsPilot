/**
 * Console API Clients - Unified Export (Simplified)
 *
 * 精简后仅保留核心功能客户端:
 * - Token管理
 * - Offer管理
 * - 任务管理
 * - 用户管理
 * - 恢复码管理
 * - 数据导出
 *
 * 已移除非核心功能:
 * - 财务报表 (FinancialClient)
 * - 通知管理 (NotificationClient)
 * - 功能开关 (FeatureFlagClient)
 * - 审计日志 (AuditClient)
 * - 监控仪表板 (MonitoringClient)
 * - 订阅管理 (SubscriptionManagementClient)
 */

// 导出核心功能客户端
export {
  TokenManagementClient,
  tokenManagementClient,
} from "./TokenManagementClient";
export {
  OfferManagementClient,
  offerManagementClient,
} from "./OfferManagementClient";
export {
  TaskManagementClient,
  taskManagementClient,
} from "./TaskManagementClient";
export {
  UserManagementClient,
  userManagementClient,
} from "./UserManagementClient";
export { ExportClient, exportClient } from "./ExportClient";
export { RecoveryCodeClient, recoveryCodeClient } from "./RecoveryCodeClient";

// 导入所有单例实例
import { tokenManagementClient } from "./TokenManagementClient";
import { offerManagementClient } from "./OfferManagementClient";
import { taskManagementClient } from "./TaskManagementClient";
import { userManagementClient } from "./UserManagementClient";
import { exportClient } from "./ExportClient";
import { recoveryCodeClient } from "./RecoveryCodeClient";

/**
 * 向后兼容的聚合客户端 (精简版)
 *
 * @deprecated 建议直接使用各个领域客户端,而不是通过consoleApi访问
 */
export class ConsoleApiClient {
  /** Token管理客户端 */
  readonly token = tokenManagementClient;

  /** Offer管理客户端 */
  readonly offer = offerManagementClient;

  /** 任务管理客户端 */
  readonly task = taskManagementClient;

  /** 用户管理客户端 */
  readonly user = userManagementClient;

  /** 导出客户端 */
  readonly export = exportClient;

  /** 恢复码客户端 */
  readonly recoveryCode = recoveryCodeClient;

  // 向后兼容的直接方法调用方式

  // Token相关方法
  getTokenStats = this.token.getTokenStats.bind(this.token);
  getTokenBalances = this.token.getTokenBalances.bind(this.token);
  topUpTokens = this.token.topUpTokens.bind(this.token);
  getTokenConsumptionTrend = this.token.getTokenConsumptionTrend.bind(
    this.token,
  );
  getTopTokenConsumers = this.token.getTopTokenConsumers.bind(this.token);

  // Offer相关方法
  getOfferStats = this.offer.getOfferStats.bind(this.offer);
  getOffers = this.offer.getOffers.bind(this.offer);
  /**
   * TODO: deployOffer - Deploy offer to production
   * Implementation: Add deployOffer method to OfferManagementClient
   * Backend endpoint: POST /api/v1/offers/:id/deploy
   */
  // deployOffer = this.offer.deployOffer.bind(this.offer);

  // 任务相关方法
  getTaskStats = this.task.getTaskStats.bind(this.task);
  getTasks = this.task.getTasks.bind(this.task);
  cancelTask = this.task.cancelTask.bind(this.task);
  retryTask = this.task.retryTask.bind(this.task);

  // 用户管理方法
  /**
   * TODO: User management methods
   * Implementation: Create UserManagementClient with methods:
   * - getUsers(params): List users with pagination
   * - getUserDetail(userId): Get user details
   * Backend endpoints: GET /api/v1/users, GET /api/v1/users/:id
   */
  // getUsers = this.user.getUsers.bind(this.user);
  // getUserDetail = this.user.getUserDetail.bind(this.user);

  // 恢复码方法
  generateRecoveryCodes = this.recoveryCode.generateRecoveryCodes.bind(
    this.recoveryCode,
  );
  /**
   * Note: Use getRecoveryCodeStats instead of getRecoveryCodes
   * getRecoveryCodes returns all codes which may be a security risk
   */

  // 导出方法
  /**
   * TODO: exportData - Export data to CSV/JSON
   * Implementation: Add exportData method to ExportClient
   * Backend endpoint: POST /api/v1/export
   * Params: { type: 'offers' | 'tasks' | 'users', format: 'csv' | 'json' }
   */
  // exportData = this.export.exportData.bind(this.export);
}

/**
 * 默认导出的单例实例
 *
 * @example
 * ```typescript
 * import { consoleApi } from '~/lib/api/clients/console';
 * const stats = await consoleApi.getTokenStats();
 * ```
 */
export const consoleApi = new ConsoleApiClient();

/**
 * 默认导出
 */
export default consoleApi;
