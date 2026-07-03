import { apiGet } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type { AdsAccount, AdsAccountDetail, AdsAccountProvider, AdsAccountsListParams } from '../types';

type AccountsResponse = {
  items?: AccountRecord[];
};

type AccountRecord = {
  id?: string;
  userId?: string;
  accountId?: string;
  accountName?: string;
  status?: string;
  provider?: string;
  currencyCode?: string;
  timezone?: string;
  connectedAt?: string;
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  totalCost?: number;
  totalRevenue?: number;
  totalConversions?: number;
  roas?: number;
  linkedOffersCount?: number;
  activeCampaignsCount?: number;
  error?: string;
};

type AccountDetailRecord = AccountRecord & {
  todayCost?: number;
  todayRevenue?: number;
  todayConversions?: number;
  todayClicks?: number;
  todayImpressions?: number;
  trendData?: Array<{
    date?: string;
    cost?: number;
    conversions?: number;
    revenue?: number;
  }>;
  linkedOffers?: Array<{
    id?: string;
    name?: string;
    status?: string;
  }>;
  activeCampaigns?: Array<{
    id?: string;
    name?: string;
    status?: string;
    objective?: string;
  }>;
};

export async function fetchAccountsSnapshot(endpoint: string): Promise<AdsAccount[]> {
  const data = await apiGet<AccountsResponse>(endpoint);
  return mapAccountsResponse(data);
}

export async function readAccountsStream(
  response: Response,
  onMessage: (payload: AccountsResponse) => void,
): Promise<void> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('无法读取广告账号实时流');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const parsed = parseSseEvent(rawEvent);
      if (parsed?.data) {
        try {
          const payload = JSON.parse(parsed.data) as AccountsResponse;
          onMessage(payload);
        } catch (error) {
          console.error('[adscenter] SSE 数据解析失败', error, parsed.data);
        }
      }

      boundary = buffer.indexOf('\n\n');
    }
  }
}

export function mapAccountsResponse(response: AccountsResponse): AdsAccount[] {
  return (response.items ?? []).map(mapAccountRecord);
}

export function buildAccountsEndpoint(
  params: AdsAccountsListParams,
  basePath: string = API_ENDPOINTS.ADSCENTER.ACCOUNTS,
) {
  const search = new URLSearchParams();

  if (params.status && params.status !== 'all') {
    search.set('status', params.status);
  }

  if (params.provider && params.provider !== 'all') {
    search.set('provider', params.provider);
  }

  const query = search.toString();

  return `${basePath}${query ? `?${query}` : ''}`;
}

export function mapAccountDetail(record: AccountDetailRecord): AdsAccountDetail {
  const base = mapAccountRecord(record);

  const trend = (record.trendData ?? []).map((item) => ({
    date: item.date ?? '',
    cost: item.cost ?? 0,
    conversions: item.conversions ?? 0,
    revenue: item.revenue ?? 0,
  }));

  return {
    ...base,
    todayCost: record.todayCost ?? 0,
    todayRevenue: record.todayRevenue ?? 0,
    todayConversions: record.todayConversions ?? 0,
    todayClicks: record.todayClicks ?? 0,
    todayImpressions: record.todayImpressions ?? 0,
    trendData: trend,
    linkedOffers: (record.linkedOffers ?? []).map((item) => ({
      id: item.id ?? '',
      name: item.name ?? '-',
      status: item.status ?? 'unknown',
    })),
    activeCampaigns: (record.activeCampaigns ?? []).map((item) => ({
      id: item.id ?? '',
      name: item.name ?? '-',
      status: item.status ?? 'unknown',
      objective: item.objective,
    })),
  };
}

function parseSseEvent(rawEvent: string): { event: string; data?: string } | null {
  if (!rawEvent.trim()) {
    return null;
  }

  const lines = rawEvent.split('\n');
  let eventType = 'message';
  let data = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const value = line.slice(5).trimStart();
      data += value + '\n';
    }
  }

  if (data.endsWith('\n')) {
    data = data.slice(0, -1);
  }

  return {
    event: eventType,
    data: data || undefined,
  };
}

function mapAccountRecord(record: AccountRecord): AdsAccount {
  const id = record.id ?? record.accountId ?? '';
  const accountId = record.accountId ?? record.id ?? '';
  const accountName = record.accountName ?? accountId;
  const connectedAt = normalizeDate(record.connectedAt ?? record.createdAt);
  const updatedAt = normalizeDate(record.updatedAt ?? connectedAt);
  const lastSyncedAt = record.lastSyncedAt
    ? normalizeDate(record.lastSyncedAt)
    : undefined;
  const provider = normalizeProvider(record.provider);
  const platform = mapPlatform(provider);
  const totalSpend = record.totalCost ?? 0;
  const totalConversions = record.totalConversions ?? 0;

  const stats = {
    totalSpend,
    impressions: 0,
    clicks: 0,
    conversions: totalConversions,
    ctr: 0,
    avgCPC: 0,
    roas: record.roas ?? 0,
    spendTrend: undefined,
  } as const;

  return {
    id,
    accountId,
    accountName,
    status: normalizeStatus(record.status),
    provider,
    currencyCode: record.currencyCode ?? 'USD',
    timezone: record.timezone ?? 'UTC',
    connectedAt,
    createdAt: connectedAt,
    updatedAt,
    lastSyncedAt,
    totalCost: record.totalCost ?? 0,
    totalRevenue: record.totalRevenue ?? 0,
    totalConversions: record.totalConversions ?? 0,
    roas: record.roas ?? 0,
    linkedOffersCount: record.linkedOffersCount ?? 0,
    activeCampaignsCount: record.activeCampaignsCount ?? 0,
    userId: record.userId,
    platform,
    currency: record.currencyCode ?? 'USD',
    lastSyncAt: lastSyncedAt,
    stats,
    error: record.error,
  };
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

function normalizeStatus(value?: string) {
  const status = (value ?? '').toLowerCase();

  switch (status) {
    case 'active':
    case 'enabled':
      return 'active';
    case 'pending':
    case 'invited':
      return 'pending';
    case 'paused':
      return 'paused';
    case 'suspended':
    case 'disabled':
      return 'suspended';
    case 'disconnected':
    case 'removed':
      return 'disconnected';
    default:
      return 'unknown';
  }
}

function normalizeProvider(value?: string) {
  const provider = (value ?? '').toLowerCase();

  switch (provider) {
    case 'google':
    case 'google_ads':
    case 'google-ads':
      return 'google';
    case 'meta':
    case 'facebook':
      return 'meta';
    case 'tt':
    case 'tiktok':
      return 'tt';
    default:
      return 'other';
  }
}

function mapPlatform(provider: AdsAccountProvider): 'google' | 'facebook' | 'tiktok' | 'other' {
  switch (provider) {
    case 'google':
      return 'google';
    case 'meta':
      return 'facebook';
    case 'tt':
      return 'tiktok';
    default:
      return 'other';
  }
}
