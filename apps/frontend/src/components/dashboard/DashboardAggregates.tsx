'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { DashboardPageLayout } from '~/core/ui/PageLayout';
import { useRequireAuth } from '~/core/hooks/useRequireAuth';
import { useDemoDataInitialization } from '~/core/hooks/use-demo-data';

import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Badge from '~/core/ui/Badge';
import { Skeleton } from '~/core/ui/Skeleton';
import dynamic from 'next/dynamic';

// ✅ 懒加载仪表盘组件 - 减少首页加载负担
const AlertsBanner = dynamic(
  () => import('./AlertsBanner').then(mod => ({ default: mod.AlertsBanner })),
  {
    loading: () => <div className="h-20 w-full animate-pulse rounded-lg bg-muted" />,
    ssr: false
  }
);

const NotificationsFeed = dynamic(
  () => import('./NotificationsFeed').then(mod => ({ default: mod.NotificationsFeed })),
  {
    loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />,
    ssr: false
  }
);

import {
  TrendingUp,
  Package,
  Target,
  AlertTriangle,
  Plus,
  Link2,
  Play,
  FileText,
  Megaphone
} from 'lucide-react';

interface DashboardStats {
  userId: string;
  totalOffers: number;
  evaluatedOffers: number;
  pendingEvaluations: number;
  evaluatedToday?: number;
  avgScore?: string; // e.g., "B+", "A-"
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

interface DashboardAggregatesProps {
  className?: string;
}

export function DashboardAggregates({ className }: DashboardAggregatesProps) {
  const { t } = useTranslation();
  const user = useRequireAuth();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-initialize demo data for new users
  useDemoDataInitialization();

  useEffect(() => {
    fetchDashboardStats();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboardStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get auth token
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Fetch dashboard stats from console service
      const response = await fetch('/api/v1/console/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
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
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardStats();
  };

  if (error) {
    return (
      <DashboardPageLayout
        header={{
          title: t('dashboard.title', 'Dashboard'),
          description: t('dashboard.description', 'Overview of your affiliate marketing activities'),
        }}
      >
        <div className={className}>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="font-medium text-red-900">
                    {t('dashboard.error.title', 'Failed to Load Dashboard')}
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    {error}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {t('dashboard.error.retry', 'Retry')}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      header={{
        title: t('dashboard.title', 'Dashboard'),
        description: t('dashboard.description', 'Overview of your affiliate marketing activities'),
        actions: (
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {t('dashboard.refresh', 'Refresh')}
          </button>
        ),
      }}
    >
      <div className={`space-y-6 ${className || ''}`}>
        {/* Alerts Banner */}
        <AlertsBanner
          dashboardStats={dashboardStats}
          isLoading={isLoading}
          onRefresh={handleRefresh}
        />

        {/* Offer Performance Overview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t('dashboard.offerStats.title', 'Offer Performance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Total Offers */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.offerStats.totalOffers', 'Total Offers')}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-8 w-16" /> : dashboardStats?.totalOffers || 0}
                  </p>
                </div>
              </div>

              {/* Active/Evaluated Offers */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.offerStats.activeOffers', 'Active Offers')}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-green-600">
                    {isLoading ? <Skeleton className="h-8 w-16" /> : dashboardStats?.evaluatedOffers || 0}
                  </p>
                  {!isLoading && dashboardStats && dashboardStats.evaluatedToday !== undefined && dashboardStats.evaluatedToday > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      +{dashboardStats.evaluatedToday} {t('dashboard.offerStats.today', 'today')}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Average Score */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.offerStats.avgScore', 'Avg Score')}
                </p>
                <div className="flex items-baseline gap-2">
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : dashboardStats?.avgScore ? (
                    <>
                      <p className="text-2xl font-bold text-blue-600">
                        {dashboardStats.avgScore}
                      </p>
                      {dashboardStats.scoreTrend && (
                        <TrendingUp
                          className={`h-4 w-4 ${
                            dashboardStats.scoreTrend === 'up'
                              ? 'text-green-600'
                              : dashboardStats.scoreTrend === 'down'
                              ? 'text-red-600 rotate-180'
                              : 'text-gray-400'
                          }`}
                        />
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.offerStats.noScoreData', 'N/A')}
                    </p>
                  )}
                </div>
              </div>

              {/* Pending Evaluations */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.offerStats.pending', 'Pending')}
                </p>
                <p className="text-2xl font-bold text-yellow-600">
                  {isLoading ? <Skeleton className="h-8 w-16" /> : dashboardStats?.pendingEvaluations || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              {t('dashboard.quickActions.title', 'Quick Actions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Create Offer */}
              <button
                onClick={() => window.location.href = '/offers?action=create'}
                className="flex flex-col items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">
                    {t('dashboard.quickActions.createOffer', 'Create Offer')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('dashboard.quickActions.createOfferDesc', 'Add new offer to evaluate')}
                  </p>
                </div>
              </button>

              {/* Connect Ads Account */}
              <button
                onClick={() => window.location.href = '/adscenter'}
                className="flex flex-col items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
                  <Link2 className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">
                    {t('dashboard.quickActions.connectAds', 'Connect Ads Account')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('dashboard.quickActions.connectAdsDesc', 'Link Google/Facebook/TikTok')}
                  </p>
                </div>
              </button>

              {/* Start Evaluation */}
              <button
                onClick={() => window.location.href = '/offers?tab=pending'}
                className="flex flex-col items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
                disabled={isLoading || !dashboardStats || dashboardStats.pendingEvaluations === 0}
              >
                <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full">
                  <Target className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">
                    {t('dashboard.quickActions.startEval', 'Start Evaluation')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isLoading ? (
                      t('dashboard.quickActions.loading', 'Loading...')
                    ) : dashboardStats?.pendingEvaluations ? (
                      t('dashboard.quickActions.pendingCount', `${dashboardStats.pendingEvaluations} pending`)
                    ) : (
                      t('dashboard.quickActions.noPending', 'No pending offers')
                    )}
                  </p>
                </div>
              </button>

              {/* View Reports */}
              <button
                onClick={() => window.location.href = '/tasks'}
                className="flex flex-col items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full">
                  <FileText className="h-6 w-6 text-orange-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">
                    {t('dashboard.quickActions.viewTasks', 'View Tasks')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('dashboard.quickActions.viewTasksDesc', 'Check task results')}
                  </p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* AI Evaluation Stats and Notifications */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* AI Evaluation Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {t('dashboard.aiStats.title', 'AI Evaluation Stats')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : dashboardStats ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {t('dashboard.aiStats.total', 'Total AI Evaluations')}
                    </span>
                    <Badge variant="secondary">
                      {dashboardStats.aiEvaluationsTotal}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {t('dashboard.aiStats.success', 'Success Rate')}
                    </span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {dashboardStats.aiEvaluationsTotal > 0
                        ? Math.round((dashboardStats.aiEvaluationsSuccess / dashboardStats.aiEvaluationsTotal) * 100)
                        : 0}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {t('dashboard.aiStats.failed', 'Failed')}
                    </span>
                    <Badge variant="destructive">
                      {dashboardStats.aiEvaluationsFailed}
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.aiStats.noData', 'No AI evaluation data')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notifications Feed */}
          <div className="lg:col-span-2">
            <NotificationsFeed />
          </div>
        </div>

        {/* Ads Account Stats */}
        {dashboardStats?.adsAccounts && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                {t('dashboard.adsStats.title', 'Ads Account Performance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Total Accounts */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.adsStats.totalAccounts', 'Total Accounts')}
                  </p>
                  <p className="text-2xl font-bold">
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      dashboardStats.adsAccounts.totalAccounts
                    )}
                  </p>
                </div>

                {/* Active Accounts */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.adsStats.activeAccounts', 'Active Accounts')}
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      dashboardStats.adsAccounts.activeAccounts
                    )}
                  </p>
                </div>

                {/* Total Spend */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.adsStats.totalSpend', 'Total Spend')}
                  </p>
                  <div className="flex items-baseline gap-2">
                    {isLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : dashboardStats.adsAccounts.totalSpend !== undefined ? (
                      <>
                        <p className="text-2xl font-bold text-red-600">
                          ${(dashboardStats.adsAccounts.totalSpend / 100).toFixed(2)}
                        </p>
                        {dashboardStats.adsAccounts.spendTrend && (
                          <TrendingUp
                            className={`h-4 w-4 ${
                              dashboardStats.adsAccounts.spendTrend === 'up'
                                ? 'text-red-600'
                                : dashboardStats.adsAccounts.spendTrend === 'down'
                                ? 'text-green-600 rotate-180'
                                : 'text-gray-400'
                            }`}
                          />
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('dashboard.adsStats.noData', 'N/A')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Average CPC */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.adsStats.avgCPC', 'Avg CPC')}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : dashboardStats.adsAccounts.avgCPC !== undefined ? (
                    <p className="text-2xl font-bold text-blue-600">
                      ${(dashboardStats.adsAccounts.avgCPC / 100).toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.adsStats.noData', 'N/A')}
                    </p>
                  )}
                </div>
              </div>

              {/* Secondary Metrics Row */}
              {(dashboardStats.adsAccounts.revenue !== undefined || dashboardStats.adsAccounts.roas !== undefined) && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-6 pt-6 border-t">
                  {/* Revenue */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.adsStats.revenue', 'Revenue')}
                    </p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : dashboardStats.adsAccounts.revenue !== undefined ? (
                      <p className="text-2xl font-bold text-green-600">
                        ${(dashboardStats.adsAccounts.revenue / 100).toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('dashboard.adsStats.noData', 'N/A')}
                      </p>
                    )}
                  </div>

                  {/* ROAS */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.adsStats.roas', 'ROAS')}
                    </p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : dashboardStats.adsAccounts.roas !== undefined ? (
                      <p className="text-2xl font-bold text-purple-600">
                        {dashboardStats.adsAccounts.roas.toFixed(2)}x
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('dashboard.adsStats.noData', 'N/A')}
                      </p>
                    )}
                  </div>

                  {/* Pending Authorization */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.adsStats.pendingAuth', 'Pending Auth')}
                    </p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {isLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        dashboardStats.adsAccounts.pendingAuthorization
                      )}
                    </p>
                  </div>

                  {/* Offers Coverage */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {t('dashboard.adsStats.offersCoverage', 'Coverage')}
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {isLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        `${Math.round(dashboardStats.adsAccounts.offersCoverage)}%`
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Warning for pending authorization */}
              {!isLoading && dashboardStats.adsAccounts.pendingAuthorization > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-900">
                      {t('dashboard.adsStats.pendingWarning', 'Action Required')}
                    </p>
                    <p className="text-yellow-700 mt-1">
                      {t('dashboard.adsStats.pendingWarningDesc',
                        `You have ${dashboardStats.adsAccounts.pendingAuthorization} account(s) requiring authorization.`
                      )}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardPageLayout>
  );
}