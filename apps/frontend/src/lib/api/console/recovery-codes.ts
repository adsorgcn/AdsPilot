import { consoleApi } from '~/lib/api';
import type { RecoveryCode, RecoveryCodeStats } from '~/lib/api/types/console';

export interface GenerateRecoveryCodePayload {
  count?: number;
  expiryDays?: number;
  expiresInDays?: number;
  reason: string;
}

export async function generateRecoveryCodes(payload: GenerateRecoveryCodePayload) {
  return consoleApi.generateRecoveryCodes(payload);
}

export async function listRecoveryCodes(signal?: AbortSignal): Promise<RecoveryCode[]> {
  return consoleApi.listRecoveryCodes({ signal });
}

export async function fetchRecoveryCodeStats(signal?: AbortSignal): Promise<RecoveryCodeStats> {
  return consoleApi.getRecoveryCodeStats({ signal });
}
