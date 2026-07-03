export interface TokenBalance {
  currentBalance: number;
  totalConsumed: number;
  totalGranted: number;
  lastUpdated: string;

  // Legacy aliases for backward compatibility
  balance?: number;
  totalBalance?: number;
  todayConsumed?: number;
  thisMonthConsumed?: number;
  pendingTasksCount?: number;
  estimatedCostForPending?: number;
  monthlyAllocation?: number;
}

export interface RawTokenBalance {
  current_balance?: number;
  currentBalance?: number;
  balance?: number;
  total_balance?: number;
  totalBalance?: number;
  total_granted?: number;
  totalGranted?: number;
  today_consumed?: number;
  todayConsumed?: number;
  this_month_consumed?: number;
  monthConsumed?: number;
  pending_tasks_count?: number;
  pendingTasks?: number;
  estimated_cost_for_pending?: number;
  estimatedCostForPending?: number;
  updated_at?: string;
  last_updated?: string;
}

export interface TokenTransaction {
  id: string;
  type: string;
  amount: number;
  description?: string;
  createdAt: string;
}

export interface TokenUsageSummary {
  userId: string;
  totalConsumed: number;
  totalTopUp: number;
  byService: Record<string, number>;
  startDate: string;
  endDate: string;
}

export interface SubscriptionInfo {
  id: string;
  planName: string;
  status: string;
  currentPeriodEnd: string;
}

export interface CheckinCalendarDay {
  day: number;
  checkedIn: boolean;
}

export interface CheckinStatus {
  hasCheckedInToday: boolean;  // Matches API response
  currentStreak: number;       // Updated from 'streak' to match API response
  totalCheckins: number;       // Added to match API response
  streak?: number;

  // Additional fields from API response
  longestStreak?: number;
  tokensEarned?: number;
  canCheckin?: boolean;
  todayChecked?: boolean;
  lastCheckinAt?: string | null;
  nextCheckinTime?: string | null;

  // Frontend-specific fields
  nextReward?: number;
  calendar?: CheckinCalendarDay[];
}

export interface PerformCheckinResponse {
  success: boolean;
  reward: number;
  streak: number;
  balance: number;
  message?: string;
}

export interface ReferralRecord {
  id: string;
  refereeName?: string;
  refereeEmail?: string;
  status: string;
  referrerRewardDays: number;
  createdAt: string;
  completedAt?: string | null;
}

export interface ReferralSummary {
  referralCode: string;
  totalInvites: number;
  successfulInvites: number;
  totalRewardsDays: number;
  pendingInvites: number;
  records: ReferralRecord[];
}

// Offers API response types - matches fixed backend format
export interface OffersListResponse {
  items: any[];  // Array of offer objects
  total: number;
  totalPages: number;
}

// Dashboard Stats API response types - matches fixed backend format
export interface DashboardStatsResponse {
  userId: string;
  totalOffers: number;
  evaluatedOffers: number;
  pendingEvaluations: number;
  evaluatedToday: number;
  aiEvaluationsTotal: number;
  aiEvaluationsSuccess: number;
  aiEvaluationsFailed: number;
  tokensRemaining: number;
  tokensTotal: number;
  tokensConsumed: number;
  avgScore?: string;
  scoreTrend?: string;
  recentEvaluations: any[];
  lastUpdated: string;
}

// Ads Accounts API response types - matches fixed backend format
export interface AdsAccountsResponse {
  items: any[];  // Array of ads account objects
  total: number;
  totalPages: number;
}
