/**
 * Token Admin Resources
 * Token管理相关的后台资源hooks（仅核心功能）
 */

import { createParamResource, createStaticResource } from '~/lib/api/resources';
import type {
  TokenStats,
  TokenBalance,
} from '~/lib/api/types/console';
import {
  fetchTokenStats,
  fetchTokenBalances,
} from '~/lib/api/console';

export const useConsoleTokenStats = createStaticResource<TokenStats>(
  ['console', 'tokens', 'stats'],
  fetchTokenStats,
  {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  },
);

export const useConsoleTokenBalances = createParamResource<
  {
    page?: number;
    pageSize?: number;
    search?: string;
  },
  { items: TokenBalance[]; total: number; totalPages: number }
>(
  (params) => ['console', 'tokens', 'balances', params],
  (params, signal) => fetchTokenBalances(params, signal),
  {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  },
);
