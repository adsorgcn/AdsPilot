/**
 * Token Management API
 * Console API 的 Token 管���功能
 */

import type BaseApiClient from '../../core/BaseApiClient';
import type { TokenStats, TokenBalance } from '../../types/console';

export class TokenManagementApi {
  constructor(private client: BaseApiClient) {}

  /**
   * 获取 Token 统计信息
   */
  async getStats(options?: { signal?: AbortSignal }): Promise<TokenStats> {
    return this.client.get<TokenStats>('/tokens/stats', {
      signal: options?.signal,
    });
  }

  /**
   * 获取 Token 余额列表
   */
  async getBalances(
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
    },
    options?: { signal?: AbortSignal },
  ): Promise<{ items: TokenBalance[]; total: number; totalPages: number }> {
    return this.client.get('/tokens/balances', {
      params,
      signal: options?.signal,
    });
  }

  /**
   * 为用户充值 Token
   */
  async topUp(data: {
    userId: string;
    amount: number;
    reason: string;
  }): Promise<void> {
    return this.client.post('/tokens/topup', data);
  }
}
