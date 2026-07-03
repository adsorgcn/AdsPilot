import { consoleApi } from '~/lib/api';
import type { Offer, OfferStats } from '~/lib/api/types/console';

export interface OfferListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  userEmail?: string;
  minScore?: number;
  maxScore?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface BatchArchivePayload {
  offerIds: string[];
  reason: string;
}

export async function fetchOfferStats(signal?: AbortSignal): Promise<OfferStats> {
  return consoleApi.getOfferStats({ signal });
}

export async function fetchOffers(
  params: OfferListParams = {},
  signal?: AbortSignal,
): Promise<{ items: Offer[]; total: number; totalPages: number }> {
  return consoleApi.getOffers(params, { signal });
}

export async function batchArchiveOffers(payload: BatchArchivePayload) {
  return consoleApi.batchArchiveOffers(payload);
}
