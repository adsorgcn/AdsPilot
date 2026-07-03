'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Package,
  Target,
  CreditCard,
  Plus,
  Link2,
  Sparkles,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';

import { DashboardPageLayout } from '~/core/ui/PageLayout';
import { useRequireAuth } from '~/core/hooks/useRequireAuth';
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '~/components/ui/GlassCard';
import { MetricCard } from '~/components/ui/MetricCard';
import { GradientButton } from '~/components/ui/GradientButton';
import { ProgressRing } from '~/components/ui/ProgressRing';
import { DashboardHero } from './DashboardHero';
import { DashboardTrendsChart, type TimeRange } from './DashboardTrendsChart';
import { PageTransition } from '~/components/ui/PageTransition';
import { SkeletonMetricCard, SkeletonChart } from '~/components/ui/SkeletonLoader';

// Phase 4 & 5 Components - Ready for integration
// import { PullToRefresh } from '~/components/mobile/PullToRefresh';
// import { LazyImage } from '~/components/performance/LazyImage';
// import { useIsMobile } from '~/hooks/useMediaQuery';

interface DashboardStats {
  userId: string;
  totalOffers: number;
  evaluatedOffers: number;
  pendingEvaluations: number;
  evaluatedToday?: number;
  avgScore?: string;
  scoreTrend?: 'up' | 'down' | 'stable';
  aiEvaluationsTotal: number;
  aiEvaluationsSuccess: number;
  aiEvaluationsFailed: number;
  tokensTotal: number;
  tokensConsumed: number;
  tokensRemaining: number;
  adsAccounts?: {
    totalAccounts: number;
    activeAccounts: number;
    pendingAuthorization: number;
    offersCoverage: number;
    totalSpend?: number;
    avgCPC?: number;
    revenue?: number;
    roas?: number;
    spendTrend?: 'up' | 'down' | 'stable';
  };
  recentEvaluations: Array<{
    id: string;
    offerId: string;
    type: string;
    status: string;
    tokensConsumed: number;
    brandName?: string;
    domain?: string;
    aiScore?: number;
    completedAt?: string;
    createdAt: string;
  }>;
  lastUpdated: string;
}

export function EnhancedDashboard() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const user = useRequireAuth();
  // const isMobile = useIsMobile(); // Ready for mobile integration
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [trendsData, setTrendsData] = useState<Array<{ date: string; revenue: number; spend: number; roas: number }>>([]);

  const {
    canUseAI,
    canCreateOffers,
  } = useEnhancedSubscription();

  useEffect(() => {
    fetchDashboardStats();
    fetchTrendsData(timeRange);
    const interval = setInterval(() => {
      fetchDashboardStats();
      fetchTrendsData(timeRange);
    }, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);

      const token = await user?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/v1/console/dashboard/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${response.statusText}`);
      }

      const stats = await response.json();
      setDashboardStats(stats);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrendsData = async (range: TimeRange) => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      // TODO: Replace with actual API call
      // For now, generate mock data
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const mockData = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        return {
          date: date.toISOString().split('T')[0],
          revenue: Math.random() * 5000 + 3000,
          spend: Math.random() * 2000 + 1000,
          roas: Math.random() * 2 + 1.5,
        };
      });
      setTrendsData(mockData);
    } catch (err) {
      console.error('Failed to fetch trends data:', err);
    }
  };

  const tokenUsagePercentage = useMemo(() => {
    if (!dashboardStats) return 0;
    return (dashboardStats.tokensConsumed / dashboardStats.tokensTotal) * 100;
  }, [dashboardStats]);

  const roasColor = useMemo(() => {
    if (!dashboardStats?.adsAccounts?.roas) return 'text-gray-600';
    const roas = dashboardStats.adsAccounts.roas;
    if (roas >= 3) return 'text-green-600';
    if (roas >= 2) return 'text-blue-600';
    if (roas >= 1) return 'text-yellow-600';
    return 'text-red-600';
  }, [dashboardStats]);

  return (
    <PageTransition variant="fade">
      <DashboardPageLayout
      header={{
        title: t('dashboard.title', 'Dashboard'),
        description: t('dashboard.description', 'Overview of your affiliate marketing activities'),
        actions: (
          <GradientButton
            size="sm"
            onClick={() => router.push('/offers?action=create')}
            disabled={!canCreateOffers}
          >
            <Plus className="h-4 w-4" />
            {t('dashboard.createOffer', 'Create Offer')}
          </GradientButton>
        ),
      }}
    >
      <div className="space-y-6">
        {/* Enhanced Hero Section */}
        <DashboardHero
          userName={user?.data?.displayName || undefined}
          onAddOffer={() => router.push('/offers?action=create')}
          onConnectAccount={() => router.push('/adscenter')}
        />

        {/* AI Features Banner */}
        {canUseAI && (
          <GlassCard variant="primary" className="border-blue-300/50">
            <GlassCardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">
                    {t('dashboard.aiEnabled', 'AI Features Enabled')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.aiEnabledDesc', 'Unlock advanced evaluation and insights')}
                  </p>
                </div>
              </div>
              <GradientButton
                size="sm"
                onClick={() => router.push('/offers?action=evaluate')}
              >
                {t('dashboard.startAIEval', 'Start AI Evaluation')}
              </GradientButton>
            </GlassCardContent>
          </GlassCard>
        )}

        {/* Key Metrics Grid */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonMetricCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title={t('dashboard.metrics.totalOffers', 'Total Offers')}
            value={dashboardStats?.totalOffers || 0}
            subtitle={
              dashboardStats?.evaluatedToday
                ? `+${dashboardStats.evaluatedToday} ${t('dashboard.metrics.today', 'today')}`
                : undefined
            }
            icon={<Package className="h-6 w-6 text-blue-600" />}
            loading={isLoading}
            trend={dashboardStats?.totalOffers && dashboardStats.totalOffers > 0 ? 'up' : 'stable'}
            trendValue="+12%"
            sparklineData={[45, 52, 48, 60, 55, 58, dashboardStats?.totalOffers || 65]}
          />

          <MetricCard
            title={t('dashboard.metrics.evaluated', 'Evaluated')}
            value={dashboardStats?.evaluatedOffers || 0}
            trend={dashboardStats?.scoreTrend}
            trendValue={dashboardStats?.avgScore}
            icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
            variant="success"
            loading={isLoading}
            sparklineData={[30, 35, 38, 42, 45, 48, dashboardStats?.evaluatedOffers || 50]}
          />

          <MetricCard
            title={t('dashboard.metrics.pending', 'Pending')}
            value={dashboardStats?.pendingEvaluations || 0}
            subtitle={t('dashboard.metrics.awaitingEval', 'Awaiting evaluation')}
            icon={<Clock className="h-6 w-6 text-yellow-600" />}
            variant="warning"
            loading={isLoading}
            sparklineData={[15, 12, 10, 8, 6, 4, dashboardStats?.pendingEvaluations || 3]}
            trend="down"
          />

          <MetricCard
            title={t('dashboard.metrics.tokens', 'Token Balance')}
            value={dashboardStats?.tokensRemaining.toLocaleString() || 0}
            subtitle={`${dashboardStats?.tokensConsumed || 0} ${t('dashboard.metrics.consumed', 'consumed')}`}
            icon={<Zap className="h-6 w-6 text-purple-600" />}
            variant="primary"
            loading={isLoading}
          />
          </div>
        )}

        {/* Trends Chart */}
        {isLoading ? (
          <SkeletonChart height="400px" />
        ) : (
          <DashboardTrendsChart
            data={trendsData}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            isLoading={false}
          />
        )}

        {/* Token Usage Progress */}
        {dashboardStats && (
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t('dashboard.tokenUsage', 'Token Usage')}
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="flex items-center gap-6">
                <ProgressRing
                  value={dashboardStats.tokensConsumed}
                  max={dashboardStats.tokensTotal}
                  size="lg"
                  color={tokenUsagePercentage > 80 ? 'error' : 'primary'}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('dashboard.consumed', 'Consumed')}
                    </span>
                    <span className="font-medium">
                      {dashboardStats.tokensConsumed.toLocaleString()} /{' '}
                      {dashboardStats.tokensTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${tokenUsagePercentage}%` }}
                    />
                  </div>
                  {tokenUsagePercentage > 80 && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <AlertCircle className="h-4 w-4" />
                      {t('dashboard.lowTokens', 'Token balance running low')}
                    </div>
                  )}
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        )}

        {/* Quick Actions */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>
              {t('dashboard.quickActions', 'Quick Actions')}
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={() => router.push('/offers?action=create')}
                className="group flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-6 transition-all hover:border-blue-500 hover:bg-blue-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 transition-all group-hover:scale-110">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t('dashboard.actions.createOffer', 'Create Offer')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('dashboard.actions.createOfferDesc', 'Add new offer')}
                  </p>
                </div>
              </button>

              <button
                onClick={() => router.push('/adscenter')}
                className="group flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-6 transition-all hover:border-green-500 hover:bg-green-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 transition-all group-hover:scale-110">
                  <Link2 className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t('dashboard.actions.connectAds', 'Connect Ads')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('dashboard.actions.connectAdsDesc', 'Link accounts')}
                  </p>
                </div>
              </button>

              <button
                onClick={() => router.push('/offers?tab=pending')}
                className="group flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-6 transition-all hover:border-purple-500 hover:bg-purple-50"
                disabled={!dashboardStats || dashboardStats.pendingEvaluations === 0}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 transition-all group-hover:scale-110">
                  <Target className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t('dashboard.actions.evaluate', 'Evaluate')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dashboardStats?.pendingEvaluations
                      ? `${dashboardStats.pendingEvaluations} pending`
                      : 'No pending'}
                  </p>
                </div>
              </button>

              <button
                onClick={() => router.push('/tasks')}
                className="group flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-6 transition-all hover:border-orange-500 hover:bg-orange-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 transition-all group-hover:scale-110">
                  <BarChart3 className="h-6 w-6 text-orange-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{t('dashboard.actions.viewTasks', 'View Tasks')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('dashboard.actions.viewTasksDesc', 'Check results')}
                  </p>
                </div>
              </button>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Ads Performance (if available) */}
        {dashboardStats?.adsAccounts && (
          <GlassCard variant="gradient">
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('dashboard.adsPerformance', 'Ads Performance')}
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.ads.totalSpend', 'Total Spend')}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-red-600">
                    ${((dashboardStats.adsAccounts.totalSpend || 0) / 100).toFixed(2)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.ads.revenue', 'Revenue')}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-green-600">
                    ${((dashboardStats.adsAccounts.revenue || 0) / 100).toFixed(2)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.ads.roas', 'ROAS')}
                  </p>
                  <p className={`mt-1 text-2xl font-bold ${roasColor}`}>
                    {dashboardStats.adsAccounts.roas?.toFixed(2)}x
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.ads.avgCPC', 'Avg CPC')}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-blue-600">
                    ${((dashboardStats.adsAccounts.avgCPC || 0) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        )}
      </div>
    </DashboardPageLayout>
    </PageTransition>
  );
}