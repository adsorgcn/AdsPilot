/**
 * Console API Client
 * 管理后台相关的 API 调用
 */

import { apiGet, apiPost } from './index';
import { API_ENDPOINTS } from './endpoints';
import type {
  TokenStats,
  TokenBalance,
  OfferStats,
  Offer,
  OfferQualityMetrics,
  FailureReasonsResponse,
  ProblemOffersResponse,
  TaskStats,
  Task,
  AdsAccountStats,
  AdsAccount,
  DashboardMetrics,
  RecentActivityResponse,
  SuccessMetrics,
  SystemAlerts,
  RecoveryCodeStats,
  RecoveryCode,
} from './types/console';

// ============================================================
// Token Management
// ============================================================

export async function fetchTokenStats(signal?: AbortSignal): Promise<TokenStats> {
  return apiGet<TokenStats>(API_ENDPOINTS.CONSOLE.STATS, { signal });
}

export async function fetchTokenBalances(
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
  },
  signal?: AbortSignal,
): Promise<{ items: TokenBalance[]; total: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params.search) searchParams.set('search', params.search);

  const endpoint = `${API_ENDPOINTS.CONSOLE.STATS}?${searchParams.toString()}`;
  const data = await apiGet<{ items: TokenBalance[]; total: number; totalPages: number }>(endpoint, { signal });
  return data;
}

// ============================================================
// Offer Management
// ============================================================

export async function fetchOfferStats(signal?: AbortSignal): Promise<OfferStats> {
  return apiGet<OfferStats>(`${API_ENDPOINTS.CONSOLE.STATS}/offers`, { signal });
}

export async function fetchOffers(
  params: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    minScore?: number;
    maxScore?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
  signal?: AbortSignal,
): Promise<{ items: Offer[]; total: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  if (params.minScore !== undefined) searchParams.set('minScore', params.minScore.toString());
  if (params.maxScore !== undefined) searchParams.set('maxScore', params.maxScore.toString());
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const endpoint = `/api/v1/console/offers?${searchParams.toString()}`;
  return apiGet<{ items: Offer[]; total: number; totalPages: number }>(endpoint, { signal });
}

export async function fetchOfferQualityMetrics(signal?: AbortSignal): Promise<OfferQualityMetrics> {
  return apiGet<OfferQualityMetrics>(`${API_ENDPOINTS.CONSOLE.STATS}/offers/quality`, { signal });
}

export async function fetchFailureReasons(limit: number, signal?: AbortSignal): Promise<FailureReasonsResponse> {
  return apiGet<FailureReasonsResponse>(
    `${API_ENDPOINTS.CONSOLE.OFFERS_KPI_DEADLETTERS}?limit=${limit}`,
    { signal },
  );
}

export async function fetchProblemOffers(limit: number, signal?: AbortSignal): Promise<ProblemOffersResponse> {
  return apiGet<ProblemOffersResponse>(`/api/v1/console/offers/problems?limit=${limit}`, { signal });
}

// ============================================================
// Task Management
// ============================================================

export async function fetchTaskStats(signal?: AbortSignal): Promise<TaskStats> {
  return apiGet<TaskStats>(API_ENDPOINTS.CONSOLE.TASKS_STATS, { signal });
}

export async function fetchTasks(
  params: {
    page?: number;
    pageSize?: number;
    status?: string;
    type?: string;
    userId?: string;
  },
  signal?: AbortSignal,
): Promise<{ items: Task[]; total: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.type) searchParams.set('type', params.type);
  if (params.userId) searchParams.set('userId', params.userId);

  const endpoint = `${API_ENDPOINTS.CONSOLE.TASKS}?${searchParams.toString()}`;
  return apiGet<{ items: Task[]; total: number; totalPages: number }>(endpoint, { signal });
}

// ============================================================
// Ads Account Management
// ============================================================

export async function fetchAdsAccountStats(signal?: AbortSignal): Promise<AdsAccountStats> {
  return apiGet<AdsAccountStats>(`${API_ENDPOINTS.CONSOLE.STATS}/ads-accounts`, { signal });
}

export async function fetchAdsAccounts(
  params: {
    page?: number;
    limit?: number;
    status?: string;
    provider?: string;
    userId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
  signal?: AbortSignal,
): Promise<{ items: AdsAccount[]; total: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.provider) searchParams.set('provider', params.provider);
  if (params.userId) searchParams.set('userId', params.userId);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const endpoint = `/api/v1/console/ads-accounts?${searchParams.toString()}`;
  return apiGet<{ items: AdsAccount[]; total: number; totalPages: number }>(endpoint, { signal });
}

// ============================================================
// Dashboard
// ============================================================

export async function fetchDashboardMetrics(signal?: AbortSignal): Promise<DashboardMetrics> {
  return apiGet<DashboardMetrics>(API_ENDPOINTS.CONSOLE.DASHBOARD_STATS, { signal });
}

export async function fetchRecentActivity(signal?: AbortSignal): Promise<RecentActivityResponse> {
  return apiGet<RecentActivityResponse>(`${API_ENDPOINTS.CONSOLE.STATS}/activity`, { signal });
}

// ============================================================
// Success Metrics
// ============================================================

export async function fetchSuccessMetrics(signal?: AbortSignal): Promise<SuccessMetrics> {
  return apiGet<SuccessMetrics>(`${API_ENDPOINTS.CONSOLE.STATS}/success`, { signal });
}

// ============================================================
// System Alerts
// ============================================================

export async function fetchSystemAlerts(signal?: AbortSignal): Promise<SystemAlerts[]> {
  const data = await apiGet<SystemAlerts>(API_ENDPOINTS.CONSOLE.ALERTS, { signal });
  // Wrap in array for consistency with hook expectations
  return [data];
}

// ============================================================
// Recovery Codes
// ============================================================

export async function fetchRecoveryCodeStats(signal?: AbortSignal): Promise<RecoveryCodeStats> {
  return apiGet<RecoveryCodeStats>(`${API_ENDPOINTS.CONSOLE.STATS}/recovery-codes`, { signal });
}

export async function fetchRecoveryCodes(
  params: {
    page?: number;
    pageSize?: number;
    status?: string;
    userId?: string;
  },
  signal?: AbortSignal,
): Promise<{ items: RecoveryCode[]; total: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.userId) searchParams.set('userId', params.userId);

  const endpoint = `/api/v1/console/recovery-codes?${searchParams.toString()}`;
  return apiGet<{ items: RecoveryCode[]; total: number; totalPages: number }>(endpoint, { signal });
}

// ============================================================
// Task Actions
// ============================================================

export async function cancelTask(taskId: string, reason?: string): Promise<void> {
  await apiPost(API_ENDPOINTS.CONSOLE.TASKS__CANCEL(taskId), { reason });
}

export async function retryTask(taskId: string): Promise<void> {
  await apiPost(API_ENDPOINTS.CONSOLE.TASKS__RETRY(taskId), {});
}

// ============================================================
// Offer Actions
// ============================================================

export async function batchArchiveOffers(params: {
  offerIds: string[];
  reason?: string;
}): Promise<void> {
  await apiPost(`/api/v1/console/offers/batch-archive`, params);
}
