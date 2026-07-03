import { consoleApi } from '~/lib/api';
import type { TokenStats, TokenBalance } from '~/lib/api/types/console';

export interface TokenBalanceParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface TopUpPayload {
  userId: string;
  amount: number;
  reason: string;
}

export async function fetchTokenStats(signal?: AbortSignal): Promise<TokenStats> {
  return consoleApi.getTokenStats({ signal });
}

export async function fetchTokenBalances(
  params: TokenBalanceParams = {},
  signal?: AbortSignal,
) {
  return consoleApi.getTokenBalances(params, { signal });
}

export async function topUpTokens(payload: TopUpPayload) {
  return consoleApi.topUpTokens(payload);
}
