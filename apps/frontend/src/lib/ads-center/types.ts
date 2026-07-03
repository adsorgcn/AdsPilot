export type AdsAccountStatus =
  | 'active'
  | 'pending'
  | 'paused'
  | 'suspended'
  | 'disconnected'
  | 'unknown'
  | 'error';

export type AdsAccountProvider = 'google' | 'meta' | 'tt' | 'other';

export interface AdsAccount {
  id: string;
  accountId: string;
  accountName: string;
  status: AdsAccountStatus;
  provider: AdsAccountProvider;
  currencyCode: string;
  timezone: string;
  connectedAt: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  totalCost: number;
  totalRevenue: number;
  totalConversions: number;
  roas: number;
  linkedOffersCount: number;
  activeCampaignsCount: number;
  userId?: string;
  platform?: 'google' | 'facebook' | 'tiktok' | 'other';
  currency?: string;
  lastSyncAt?: string;
  stats?: {
    totalSpend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    avgCPC: number;
    roas?: number;
    spendTrend?: 'up' | 'down' | 'stable';
  };
  error?: string;
}

export interface AdsAccountDetail extends AdsAccount {
  todayCost: number;
  todayRevenue: number;
  todayConversions: number;
  todayClicks: number;
  todayImpressions: number;
  trendData: Array<{
    date: string;
    cost: number;
    conversions: number;
    revenue: number;
  }>;
  linkedOffers: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  activeCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    objective?: string;
  }>;
}

export interface AdsAccountsListParams {
  status?: AdsAccountStatus | 'all';
  provider?: AdsAccountProvider | 'all';
}

export interface OAuthUrlResponse {
  authUrl: string;
}

export interface SyncAccountResponse {
  success: boolean;
  syncedAt: string;
}

export interface SyncAllAccountsResponse {
  success: boolean;
  syncedCount: number;
  syncedAt: string;
}

export interface DisconnectAccountResponse {
  success: boolean;
}

export interface StrategyPlanAction {
  type: string;
  params?: Record<string, unknown>;
  filter?: Record<string, unknown>;
}

export interface StrategyPlan {
  validateOnly?: boolean;
  actions: StrategyPlanAction[];
}

export interface AdsStrategy {
  id: string;
  title: string;
  description: string;
  plan: StrategyPlan;
}

export interface AdsStrategiesResponse {
  items: AdsStrategy[];
  updatedAt: string;
}

export interface AdsExecutionReportItem {
  type: string;
  total: number;
  errors: number;
  errorRate: number;
}

export interface AdsExecutionReport {
  days: number;
  items: AdsExecutionReportItem[];
  updatedAt: string;
}

export interface TransferBudgetPayload {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
}
