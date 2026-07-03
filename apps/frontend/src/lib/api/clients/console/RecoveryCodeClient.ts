/**
 * Recovery Code Client
 * 处理恢复码相关的所有API操作
 */

import BaseApiClient from '../../core/BaseApiClient';
import type { RecoveryCode, RecoveryCodeStats } from '../../types/console';

const CONSOLE_API_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console';

export class RecoveryCodeClient extends BaseApiClient {
  constructor() {
    super(CONSOLE_API_BASE_URL);
  }

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
}

export const recoveryCodeClient = new RecoveryCodeClient();
