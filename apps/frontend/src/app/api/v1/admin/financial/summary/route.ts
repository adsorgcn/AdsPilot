/**
 * Financial Summary API
 *
 * 提供财务数据汇总，包括收入、成本、利润等关键财务指标
 */

import { NextRequest, NextResponse } from 'next/server';
import { setCacheHeaders } from '~/lib/api/optimization/CacheHeaders';

interface FinancialSummary {
  totalRevenue: {
    amount: number;
    currency: string;
    growth: number; // 百分比增长
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
    margin: number; // 利润率百分比
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
    mrr: number; // Monthly Recurring Revenue
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

// 获取收入数据
async function getRevenueData(timeframe: string) {
  try {
    // TODO: 连接真实的计费系统
    // const revenue = await billingService.getRevenueByTimeframe(timeframe);

    // 临时的真实数据结构 - 准备连接实际数据源
    return {
      amount: 25000,
      currency: 'USD',
      growth: 15.5,
      period: timeframe
    };
  } catch (error) {
    console.error('[Financial Summary] Error fetching revenue data:', error);
    return {
      amount: 0,
      currency: 'USD',
      growth: 0,
      period: timeframe
    };
  }
}

// 获取成本数据
async function getCostsData(_timeframe: string) {
  try {
    // TODO: 连接真实的成本追踪系统
    // const costs = await costService.getCostsByTimeframe(_timeframe);

    return {
      amount: 8500,
      currency: 'USD',
      growth: 8.2,
      breakdown: {
        infrastructure: 3500,
        apis: 2500,
        support: 1500,
        other: 1000
      }
    };
  } catch (error) {
    console.error('[Financial Summary] Error fetching costs data:', error);
    return {
      amount: 0,
      currency: 'USD',
      growth: 0,
      breakdown: {
        infrastructure: 0,
        apis: 0,
        support: 0,
        other: 0
      }
    };
  }
}

// 获取Token指标
async function getTokenMetrics() {
  try {
    // TODO: 连接真实的Token系统
    // const metrics = await tokenService.getTokenMetrics();

    return {
      totalTokensSold: 150000,
      totalRevenue: 18750,
      averagePrice: 0.125,
      activeSubscriptions: 450
    };
  } catch (error) {
    console.error('[Financial Summary] Error fetching token metrics:', error);
    return {
      totalTokensSold: 0,
      totalRevenue: 0,
      averagePrice: 0,
      activeSubscriptions: 0
    };
  }
}

// 获取订阅指标
async function getSubscriptionMetrics() {
  try {
    // TODO: 连接真实的订阅系统
    // const metrics = await subscriptionService.getSubscriptionMetrics();

    return {
      totalSubscriptions: 450,
      mrr: 8500,
      churnRate: 3.2, // 百分比
      averageLifetimeValue: 280
    };
  } catch (error) {
    console.error('[Financial Summary] Error fetching subscription metrics:', error);
    return {
      totalSubscriptions: 0,
      mrr: 0,
      churnRate: 0,
      averageLifetimeValue: 0
    };
  }
}

// 获取趋势数据
async function getTrendsData(days: number) {
  try {
    // TODO: 连接真实的数据仓库
    // const trends = await analyticsService.getFinancialTrends(days);

    const trends = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // 模拟趋势数据 - 实际环境中从数据仓库获取
      const baseRevenue = 800;
      const baseCosts = 250;

      trends.push({
        period: date.toISOString().split('T')[0],
        revenue: baseRevenue + Math.random() * 200 - 100,
        costs: baseCosts + Math.random() * 50 - 25,
        profit: (baseRevenue - baseCosts) + Math.random() * 150 - 75,
        subscribers: 420 + Math.floor(Math.random() * 60 - 30)
      });
    }

    return trends;
  } catch (error) {
    console.error('[Financial Summary] Error fetching trends data:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    // TODO: 实现真实的权限检查
    // const user = await getCurrentUser(request);
    // if (!user || !user.isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '30d'; // 7d, 30d, 90d, 1y
    const trendsDays = Math.min(parseInt(searchParams.get('trends') || '30'), 90);

    // 并行获取所有数据
    const [revenue, costs, tokenMetrics, subscriptionMetrics, trends] = await Promise.all([
      getRevenueData(timeframe),
      getCostsData(timeframe),
      getTokenMetrics(),
      getSubscriptionMetrics(),
      getTrendsData(trendsDays)
    ]);

    // 计算利润
    const profit = {
      amount: revenue.amount - costs.amount,
      currency: revenue.currency,
      margin: revenue.amount > 0 ? ((revenue.amount - costs.amount) / revenue.amount) * 100 : 0,
      growth: revenue.growth - costs.growth
    };

    const financialSummary: FinancialSummary = {
      totalRevenue: revenue,
      totalCosts: costs,
      profit,
      tokenMetrics,
      subscriptionMetrics,
      trends
    };

    const response = NextResponse.json({
      success: true,
      data: financialSummary,
      meta: {
        timeframe,
        trendsDays,
        generated_at: new Date().toISOString(),
        currency: 'USD'
      }
    });

    // 缓存10分钟 - 财务数据更新频率较低
    return setCacheHeaders(response, '/api/v1/admin/financial/summary', undefined, 'medium');

  } catch (error) {
    console.error('[Financial Summary] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch financial summary',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    );
  }
}