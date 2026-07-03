/**
 * Console Service Dashboard API Types
 * Maps to: GET /api/v1/console/dashboard/:userId
 * Ref: /services/console/internal/handlers/aggregation.go
 */

export interface ConsoleDashboardData {
  userId: string;
  offers?: OffersSummary;
  tokens?: TokensSummary;
  accounts?: AccountsSummary;
  recentActivity?: RecentActivity;
  errors?: Record<string, string>;
}

export interface OnboardingChecklist {
  userId: string;
  progress: number;
  items: OnboardingItem[];
  resources: OnboardingResource[];
  updatedAt: string;
}

export interface OnboardingItem {
  key: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: string | null;
  actionLabel: string;
  actionHref: string;
}

export interface OnboardingResource {
  title: string;
  description: string;
  href: string;
}

export interface OffersSummary {
  total: number;
  active: number;
  paused: number;
  recent: OfferItem[];
  topKpi?: OfferKPI;
}

export interface OfferItem {
  id: string;
  url: string;
  brandName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferKPI {
  revenue: number;
  cost: number;
  conversions: number;
  roas: number;
}

export interface TokensSummary {
  balance: TokenBalance;
  recentTransactions: TokenTransaction[];
  monthlyUsage: number;
}

export interface TokenBalance {
  balance: number;
  reserved: number;
  available: number;
  monthlyAllocation?: number;
}

export interface TokenTransaction {
  id: string;
  amount: number;
  type: 'consume' | 'purchase' | 'refund';
  service: string;
  action: string;
  createdAt: string;
}

export interface AccountsSummary {
  total: number;
  active: number;
  recent: AccountItem[];
}

export interface AccountItem {
  id: string;
  customerId: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface RecentActivity {
  bulkOperations: BulkOperation[];
  rankingJobs: RankingJob[];
}

export interface BulkOperation {
  id: string;
  type: string;
  status: string;
  totalItems: number;
  processedItems: number;
  createdAt: string;
}

export interface RankingJob {
  id: string;
  offerUrl: string;
  status: string;
  createdAt: string;
}

/**
 * Legacy Dashboard Types (kept for backward compatibility)
 */

export interface DashboardMetrics {
  roas: number;
  roas_change: number;
  total_cost: number;
  cost_change: number;
  total_revenue: number;
  revenue_change: number;
  total_offers: number;
  active_offers: number;
  pending_evaluation: number;
  total_ads_accounts: number;
  active_campaigns: number;
  running_tasks: number;
  pending_tasks: number;
  token_balance: number;
  token_consumed_today: number;
}

export type RiskLevel = 'high' | 'medium' | 'low';

export interface RiskAlert {
  id: string;
  level: RiskLevel;
  type:
    | 'roas_drop'
    | 'budget_exceeded'
    | 'account_suspended'
    | 'low_token'
    | 'evaluation_failed';
  title: string;
  message: string;
  offer_id?: string;
  offer_url?: string;
  ads_account_id?: string;
  created_at: string;
  is_read: boolean;
}

export interface TopOffer {
  id: string;
  url: string;
  brand_name?: string;
  country: string;
  roas: number;
  total_revenue: number;
  total_cost: number;
  clicks: number;
  conversions: number;
  health_score?: number;
}

export interface TrendDataPoint {
  date: string;
  roas: number;
  revenue: number;
  cost: number;
  clicks: number;
  conversions: number;
}

export interface DashboardTrends {
  period: '7d' | '30d' | '90d';
  data_points: TrendDataPoint[];
}

export interface DashboardData {
  metrics: DashboardMetrics;
  risk_alerts: RiskAlert[];
  top_offers: TopOffer[];
  trends: DashboardTrends;
}

export interface DashboardParams {
  period?: '7d' | '30d' | '90d';
  include_alerts?: boolean;
  include_top_offers?: boolean;
  include_trends?: boolean;
  // organization_id removed during user-centric refactoring
}

export interface MarkAlertReadRequest {
  alert_id: string;
}
