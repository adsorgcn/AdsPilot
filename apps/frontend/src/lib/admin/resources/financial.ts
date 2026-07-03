/**
 * Financial Admin Resources
 * 财务相关的后台管理资源hooks
 *
 * ✅ 已实现财务数据API
 */

import { createParamResource, createStaticResource } from '~/lib/api/resources';

// 财务汇总数据接口
interface FinancialSummary {
  totalRevenue: {
    amount: number;
    currency: string;
    growth: number;
    period: string;
  };
  totalCosts: {
    amount: number;
    currency: string;
    growth: number;
    breakdown: {
      infrastructure: number;
      apis: number;
      support: number;
      other: number;
    };
  };
  profit: {
    amount: number;
    currency: string;
    margin: number;
    growth: number;
  };
  tokenMetrics: {
    totalTokensSold: number;
    totalRevenue: number;
    averagePrice: number;
    activeSubscriptions: number;
  };
  subscriptionMetrics: {
    totalSubscriptions: number;
    mrr: number;
    churnRate: number;
    averageLifetimeValue: number;
  };
  trends: Array<{
    period: string;
    revenue: number;
    costs: number;
    profit: number;
    subscribers: number;
  }>;
}

interface MonthlyReportsResponse {
  months: Array<{
    month: string;
    revenue: number;
    costs: number;
    profit: number;
    subscriptions: number;
    tokenSales: number;
  }>;
  summary: {
    totalRevenue: number;
    totalCosts: number;
    totalProfit: number;
    averageGrowth: number;
  };
}

interface RevenueTrendsResponse {
  trends: Array<{
    date: string;
    revenue: number;
    costs: number;
    profit: number;
    subscribers: number;
  }>;
  aggregates: {
    totalRevenue: number;
    averageDailyRevenue: number;
    growthRate: number;
    profitMargin: number;
  };
}

// 获取财务汇总数据
async function fetchFinancialSummary(timeframe = '30d'): Promise<FinancialSummary> {
  try {
    const response = await fetch(`/api/v1/admin/financial/summary?timeframe=${timeframe}`);

    if (!response.ok) {
      throw new Error(`Financial Summary API failed: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Financial Summary API error: ${result.error}`);
    }

    return result.data;
  } catch (error) {
    console.error('[Financial Summary] API call failed, falling back to mock data:', error);

    // 降级到基本数据结构
    return {
      totalRevenue: { amount: 0, currency: 'USD', growth: 0, period: timeframe },
      totalCosts: { amount: 0, currency: 'USD', growth: 0, breakdown: { infrastructure: 0, apis: 0, support: 0, other: 0 } },
      profit: { amount: 0, currency: 'USD', margin: 0, growth: 0 },
      tokenMetrics: { totalTokensSold: 0, totalRevenue: 0, averagePrice: 0, activeSubscriptions: 0 },
      subscriptionMetrics: { totalSubscriptions: 0, mrr: 0, churnRate: 0, averageLifetimeValue: 0 },
      trends: []
    };
  }
}

// ✅ 使用真实的API端点
export const useConsoleFinancialOverview = createStaticResource<FinancialSummary>(
  ['console', 'financial', 'overview'],
  () => fetchFinancialSummary(),
  {
    refreshInterval: 10 * 60 * 1000, // 10分钟
    revalidateOnFocus: true,
  },
);

// 获取月度报告
async function fetchMonthlyReports(months: number): Promise<MonthlyReportsResponse> {
  try {
    const response = await fetch(`/api/v1/admin/financial/monthly-reports?months=${months}`);

    if (!response.ok) {
      throw new Error(`Monthly Reports API failed: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Monthly Reports API error: ${result.error}`);
    }

    return result.data;
  } catch (error) {
    console.error('[Monthly Reports] API call failed:', error);
    // 返回空数据结构
    return {
      months: [],
      summary: { totalRevenue: 0, totalCosts: 0, totalProfit: 0, averageGrowth: 0 }
    };
  }
}

export const useFinancialMonthlyReports = createParamResource<
  { months: number },
  MonthlyReportsResponse
>(
  ({ months }) => (months ? ['console', 'financial', 'monthly-reports', months] : null),
  ({ months }, signal) => fetchMonthlyReports(months),
  {
    refreshInterval: 5 * 60 * 1000, // 5分钟
    revalidateOnFocus: false,
  },
);

// 获取收入趋势
async function fetchRevenueTrends(days: number): Promise<RevenueTrendsResponse> {
  try {
    const response = await fetch(`/api/v1/admin/financial/revenue-trends?days=${days}`);

    if (!response.ok) {
      throw new Error(`Revenue Trends API failed: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Revenue Trends API error: ${result.error}`);
    }

    return result.data;
  } catch (error) {
    console.error('[Revenue Trends] API call failed:', error);
    // 返回空数据结构
    return {
      trends: [],
      aggregates: { totalRevenue: 0, averageDailyRevenue: 0, growthRate: 0, profitMargin: 0 }
    };
  }
}

export const useFinancialRevenueTrends = createParamResource<
  { days: number },
  RevenueTrendsResponse
>(
  ({ days }) => (days ? ['console', 'financial', 'revenue-trends', days] : null),
  ({ days }, signal) => fetchRevenueTrends(days),
  {
    refreshInterval: 2 * 60 * 1000, // 2分钟
    revalidateOnFocus: true,
  },
);
