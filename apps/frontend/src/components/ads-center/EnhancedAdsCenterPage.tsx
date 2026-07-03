'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link2,
  Activity,
  Wifi,
  WifiOff,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

import { DashboardPageLayout } from '~/core/ui/PageLayout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '~/components/ui/GlassCard';
import { GradientButton } from '~/components/ui/GradientButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/core/ui/Tabs';

export function EnhancedAdsCenterPage() {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState('overview');
  const [connectionState] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [isReconnecting] = useState(false);

  const realtimeMetrics = {
    totalAccounts: 0,
    activeAccounts: 0,
    totalSpend: 0,
    todayImpressions: 0,
    todayClicks: 0,
  };

  const accounts: Array<{
    stats?: {
      totalSpend?: number;
      impressions?: number;
      clicks?: number;
      ctr?: number;
    };
  }> = [];

  const aggregateStats = {
    totalSpend: accounts.reduce((acc, a) => acc + (a.stats?.totalSpend || 0), 0),
    totalImpressions: accounts.reduce((acc, a) => acc + (a.stats?.impressions || 0), 0),
    totalClicks: accounts.reduce((acc, a) => acc + (a.stats?.clicks || 0), 0),
    avgCTR: accounts.length > 0
      ? accounts.reduce((acc, a) => acc + (a.stats?.ctr || 0), 0) / accounts.length
      : 0,
  };

  return (
    <DashboardPageLayout
      header={{
        title: t('adsCenter.title', 'Ads Center'),
        description: t('adsCenter.description', 'Manage your advertising accounts and campaigns'),
        actions: (
          <GradientButton size="sm">
            <Link2 className="h-4 w-4" />
            {t('adsCenter.connectAccount', 'Connect Account')}
          </GradientButton>
        ),
      }}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">{t('adsCenter.tabs.overview', 'Overview')}</TabsTrigger>
          <TabsTrigger value="accounts">{t('adsCenter.tabs.accounts', 'Accounts')}</TabsTrigger>
          <TabsTrigger value="mcc">{t('adsCenter.tabs.mcc', 'MCC Management')}</TabsTrigger>
          <TabsTrigger value="bulk">{t('adsCenter.tabs.bulk', 'Bulk Operations')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Connection Status & Real-time Metrics */}
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('adsCenter.realtime.title', 'Real-time Status')}
                <div className="flex items-center gap-1">
                  {connectionState === 'connected' ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {isReconnecting ? t('adsCenter.realtime.reconnecting', 'Reconnecting...') :
                     connectionState === 'connected' ? t('adsCenter.realtime.connected', 'Connected') :
                     t('adsCenter.realtime.disconnected', 'Disconnected')}
                  </span>
                </div>
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="text-center">
                  <div className="text-2xl font-bold">{realtimeMetrics.totalAccounts}</div>
                  <div className="text-sm text-muted-foreground">{t('adsCenter.stats.totalAccounts', 'Total Accounts')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{realtimeMetrics.activeAccounts}</div>
                  <div className="text-sm text-muted-foreground">{t('adsCenter.stats.activeAccounts', 'Active')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">${realtimeMetrics.totalSpend.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">{t('adsCenter.stats.totalSpend', 'Total Spend')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{realtimeMetrics.todayImpressions.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">{t('adsCenter.stats.impressions', 'Impressions')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{realtimeMetrics.todayClicks.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">{t('adsCenter.stats.clicks', 'Clicks')}</div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Aggregate Performance */}
          {accounts.length > 0 && (
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('adsCenter.aggregate.title', 'Aggregate Performance')}
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">${aggregateStats.totalSpend.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">{t('adsCenter.aggregate.totalSpend', 'Total Spend')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{aggregateStats.totalImpressions.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">{t('adsCenter.aggregate.impressions', 'Impressions')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{aggregateStats.totalClicks.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">{t('adsCenter.aggregate.clicks', 'Clicks')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{(aggregateStats.avgCTR * 100).toFixed(2)}%</div>
                    <div className="text-sm text-muted-foreground">{t('adsCenter.aggregate.ctr', 'Avg CTR')}</div>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
          )}

          {/* Features */}
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('adsCenter.features.title', 'Features')}
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                  <div>
                    <h4 className="font-medium">{t('adsCenter.feature.realtime', 'Real-time Monitoring')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('adsCenter.feature.realtimeDesc', 'Live performance tracking')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                  <div>
                    <h4 className="font-medium">{t('adsCenter.feature.budget', 'Smart Budget')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('adsCenter.feature.budgetDesc', 'Smart budget allocation')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                  <div>
                    <h4 className="font-medium">{t('adsCenter.feature.automation', 'Automation')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('adsCenter.feature.automationDesc', 'AI-powered optimization')}
                    </p>
                  </div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </TabsContent>

        {/* Accounts Tab - Placeholder */}
        <TabsContent value="accounts" className="space-y-6">
          <GlassCard>
            <GlassCardContent>
              <div className="text-center py-8">
                <h3 className="text-lg font-medium">{t('adsCenter.accounts.comingSoon', 'Account Management Coming Soon')}</h3>
                <p className="text-muted-foreground mt-2">
                  {t('adsCenter.accounts.description', 'Connect and manage your advertising accounts')}
                </p>
              </div>
            </GlassCardContent>
          </GlassCard>
        </TabsContent>

        {/* MCC Tab - Placeholder */}
        <TabsContent value="mcc" className="space-y-6">
          <GlassCard>
            <GlassCardContent>
              <div className="text-center py-8">
                <h3 className="text-lg font-medium">{t('adsCenter.mcc.comingSoon', 'MCC Management Coming Soon')}</h3>
                <p className="text-muted-foreground mt-2">
                  {t('adsCenter.mcc.description', 'Manage your My Client Center accounts')}
                </p>
              </div>
            </GlassCardContent>
          </GlassCard>
        </TabsContent>

        {/* Bulk Operations Tab - Placeholder */}
        <TabsContent value="bulk" className="space-y-6">
          <GlassCard>
            <GlassCardContent>
              <div className="text-center py-8">
                <h3 className="text-lg font-medium">{t('adsCenter.bulk.comingSoon', 'Bulk Operations Coming Soon')}</h3>
                <p className="text-muted-foreground mt-2">
                  {t('adsCenter.bulk.description', 'Perform bulk operations across multiple accounts')}
                </p>
              </div>
            </GlassCardContent>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </DashboardPageLayout>
  );
}