/**
 * Token Management Client
 * 处理Token相关的所有API操作
 */

import BaseApiClient from '../../core/BaseApiClient';
import type {
  TokenBalance,
  TokenStats,
  TokenTrendResponse,
  TopConsumersResponse,
} from '../../types/console';

const CONSOLE_API_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console';

export class TokenManagementClient extends BaseApiClient {
  constructor() {
    super(CONSOLE_API_BASE_URL);
  }

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

  /**
   * 获取Token消费趋势
   */
  async getTokenConsumptionTrend(
    days: number = 7,
    options?: { signal?: AbortSignal },
  ): Promise<TokenTrendResponse> {
    return this.get<TokenTrendResponse>(`/tokens/trends`, {
      params: { days },
      signal: options?.signal,
    });
  }

  /**
   * 获取Top Token消费者
   */
  async getTopTokenConsumers(
    limit: number = 10,
    options?: { signal?: AbortSignal },
  ): Promise<TopConsumersResponse> {
    return this.get<TopConsumersResponse>('/tokens/top-consumers', {
      params: { limit },
      signal: options?.signal,
    });
  }
}

export const tokenManagementClient = new TokenManagementClient();
