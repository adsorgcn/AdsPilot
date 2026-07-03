import { useCallback } from 'react';

import { apiPost } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type { TransferBudgetPayload } from '../types';

/**
 * 转移广告预算
 */
export function useTransferBudget() {
  return useCallback(async (payload: TransferBudgetPayload) => {
    return apiPost<Record<string, unknown>>(
      API_ENDPOINTS.ADSCENTER.BUDGET_TRANSFER,
      {
        from_account_id: payload.fromAccountId,
        to_account_id: payload.toAccountId,
        amount: payload.amount,
      },
    );
  }, []);
}
