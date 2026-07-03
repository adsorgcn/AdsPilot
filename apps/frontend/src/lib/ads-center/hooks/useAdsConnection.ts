import { useCallback } from 'react';

import { apiGet, apiPost } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type {
  OAuthUrlResponse,
  SyncAccountResponse,
  SyncAllAccountsResponse,
  DisconnectAccountResponse,
} from '../types';

/**
 * 获取OAuth授权URL
 */
export function useGetOAuthUrl() {
  return useCallback(async () => {
    const data = await apiGet<OAuthUrlResponse>(
      API_ENDPOINTS.ADSCENTER.OAUTH_URL,
    );

    return data.authUrl;
  }, []);
}

/**
 * 同步单个广告账号
 */
export function useSyncAccount() {
  return useCallback(async (accountId: string) => {
    const data = await apiPost<SyncAccountResponse>(
      `/api/v1/adscenter/accounts/${accountId}/sync`,
      {},
    );

    return {
      success: data.success !== false,
      syncedAt: normalizeDate(data.syncedAt ?? (data as any).synced_at),
    } satisfies SyncAccountResponse;
  }, []);
}

/**
 * 同步所有广告账号
 */
export function useSyncAllAccounts() {
  return useCallback(async () => {
    const data = await apiPost<SyncAllAccountsResponse>(
      API_ENDPOINTS.ADSCENTER.ACCOUNTS_SYNC_ALL,
      {},
    );

    return {
      success: data.success !== false,
      syncedCount:
        data.syncedCount ?? (data as any).synced_count ?? 0,
      syncedAt: normalizeDate(data.syncedAt ?? (data as any).synced_at),
    } satisfies SyncAllAccountsResponse;
  }, []);
}

/**
 * 断开广告账号连接
 */
export function useDisconnectAccount() {
  return useCallback(async (accountId: string) => {
    const data = await apiPost<DisconnectAccountResponse>(
      `/api/v1/adscenter/accounts/${accountId}/disconnect`,
      {},
    );

    return data.success !== false;
  }, []);
}

function normalizeDate(value?: string) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}
