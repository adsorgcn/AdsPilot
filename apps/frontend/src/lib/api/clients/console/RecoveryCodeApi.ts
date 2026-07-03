/**
 * Recovery Code API
 */

import type BaseApiClient from '../../core/BaseApiClient';
import type { RecoveryCode, RecoveryCodeStats } from '../../types/console';

export class RecoveryCodeApi {
  constructor(private client: BaseApiClient) {}

  async generate(data: {
    count?: number;
    expiryDays?: number;
    expiresInDays?: number;
    reason: string;
  }): Promise<RecoveryCode[]> {
    return this.client.post<RecoveryCode[]>('/recovery-codes/generate', data);
  }

  async list(options?: { signal?: AbortSignal }): Promise<RecoveryCode[]> {
    return this.client.get<RecoveryCode[]>('/recovery-codes', {
      signal: options?.signal,
    });
  }

  async getStats(
    options?: { signal?: AbortSignal },
  ): Promise<RecoveryCodeStats> {
    return this.client.get<RecoveryCodeStats>('/recovery-codes/stats', {
      signal: options?.signal,
    });
  }
}
