/**
 * Console API 客户端 - 重构版本
 *
 * 使用 Facade 模式，将功能委托给专门的子 API 客户端
 * 保持向后兼容的同时，提供更好的代码组织
 *
 * @example
 * ```typescript
 * import { consoleApi } from '~/lib/api';
 *
 * // 使用子 API（推荐）
 * const stats = await consoleApi.tokens.getStats();
 * const offers = await consoleApi.offers.getList({ page: 1, pageSize: 20 });
 *
 * // 向后兼容方法（将逐步废弃）
 * const stats = await consoleApi.getTokenStats();
 * const offers = await consoleApi.getOffers({ page: 1, pageSize: 20 });
 * ```
 */

import BaseApiClient from '../core/BaseApiClient';

// 导入子 API 客户端
import { TokenManagementApi } from './console/TokenManagementApi';
import { OfferManagementApi } from './console/OfferManagementApi';
import { SubscriptionManagementApi } from './console/SubscriptionManagementApi';
import { RecoveryCodeApi } from './console/RecoveryCodeApi';
import { TaskManagementApi } from './console/TaskManagementApi';

const CONSOLE_API_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console';

/**
 * Console API 客户端类
 * 继承自 BaseApiClient，自动处理认证和错误
 */
class ConsoleApiClient extends BaseApiClient {
  // 子 API 客户端实例
  public readonly tokens: TokenManagementApi;
  public readonly offers: OfferManagementApi;
  public readonly subscriptions: SubscriptionManagementApi;
  public readonly recoveryCodes: RecoveryCodeApi;
  public readonly tasks: TaskManagementApi;

  constructor() {
    super(CONSOLE_API_BASE_URL);

    // 初始化子 API 客户端
    this.tokens = new TokenManagementApi(this);
    this.offers = new OfferManagementApi(this);
    this.subscriptions = new SubscriptionManagementApi(this);
    this.recoveryCodes = new RecoveryCodeApi(this);
    this.tasks = new TaskManagementApi(this);
  }

  // ============================================================
  // 向后兼容方法 - Token Management
  // 这些方法将逐步废弃，请使用 consoleApi.tokens.*
  // ============================================================

  /**
   * @deprecated 使用 consoleApi.tokens.getStats() 替代
   */
  async getTokenStats(options?: { signal?: AbortSignal }) {
    return this.tokens.getStats(options);
  }

  /**
   * @deprecated 使用 consoleApi.tokens.getBalances() 替代
   */
  async getTokenBalances(
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
    },
    options?: { signal?: AbortSignal },
  ) {
    return this.tokens.getBalances(params, options);
  }

  /**
   * @deprecated 使用 consoleApi.tokens.topUp() 替代
   */
  async topUpTokens(data: {
    userId: string;
    amount: number;
    reason: string;
  }) {
    return this.tokens.topUp(data);
  }

  // ============================================================
  // 向后兼容方法 - Offer Management
  // ============================================================

  /**
   * @deprecated 使用 consoleApi.offers.getStats() 替代
   */
  async getOfferStats(options?: { signal?: AbortSignal }) {
    return this.offers.getStats(options);
  }

  /**
   * @deprecated 使用 consoleApi.offers.getList() 替代
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
  ) {
    return this.offers.getList(params, options);
  }

  /**
   * @deprecated 使用 consoleApi.offers.batchArchive() 替代
   */
  async batchArchiveOffers(data: { offerIds: string[]; reason: string }) {
    return this.offers.batchArchive(data);
  }

  // ============================================================
  // 向后兼容方法 - Subscription Management
  // ============================================================

  /**
   * @deprecated 使用 consoleApi.subscriptions.getStats() 替代
   */
  async getSubscriptionStats(options?: { signal?: AbortSignal }) {
    return this.subscriptions.getStats(options);
  }

  /**
   * @deprecated 使用 consoleApi.subscriptions.getList() 替代
   */
  async getSubscriptions(
    params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
    },
    options?: { signal?: AbortSignal },
  ) {
    return this.subscriptions.getList(params, options);
  }

  /**
   * @deprecated 使用 consoleApi.subscriptions.updateStatus() 替代
   */
  async updateSubscriptionStatus(
    subscriptionId: string,
    data: {
      status: string;
      reason?: string;
    },
  ) {
    return this.subscriptions.updateStatus(subscriptionId, data);
  }

  // ============================================================
  // 向后兼容方法 - Recovery Code
  // ============================================================

  /**
   * @deprecated 使用 consoleApi.recoveryCodes.generate() 替代
   */
  async generateRecoveryCodes(data: {
    count?: number;
    expiryDays?: number;
    expiresInDays?: number;
    reason: string;
  }) {
    return this.recoveryCodes.generate(data);
  }

  /**
   * @deprecated 使用 consoleApi.recoveryCodes.list() 替代
   */
  async listRecoveryCodes(options?: { signal?: AbortSignal }) {
    return this.recoveryCodes.list(options);
  }

  /**
   * @deprecated 使用 consoleApi.recoveryCodes.getStats() 替代
   */
  async getRecoveryCodeStats(options?: { signal?: AbortSignal }) {
    return this.recoveryCodes.getStats(options);
  }

  // ============================================================
  // 向后兼容方法 - Task Management
  // ============================================================

  /**
   * @deprecated 使用 consoleApi.tasks.getStats() 替代
   */
  async getTaskStats(options?: { signal?: AbortSignal }) {
    return this.tasks.getStats(options);
  }

  /**
   * @deprecated 使用 consoleApi.tasks.getList() 替代
   */
  async getTasks(
    params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      type?: string;
      userId?: string;
    },
    options?: { signal?: AbortSignal },
  ) {
    return this.tasks.getList(params, options);
  }

  /**
   * @deprecated 使用 consoleApi.tasks.cancel() 替代
   */
  async cancelTask(taskId: string, reason?: string) {
    return this.tasks.cancel(taskId, reason);
  }

  /**
   * @deprecated 使用 consoleApi.tasks.retry() 替代
   */
  async retryTask(taskId: string) {
    return this.tasks.retry(taskId);
  }
}

// 导出单例实例
export const consoleApi = new ConsoleApiClient();

export default ConsoleApiClient;
