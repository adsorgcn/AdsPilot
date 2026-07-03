'use client';

import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { DashboardPageLayout } from '~/core/ui/PageLayout';
import Button from '~/core/ui/Button';
import Alert from '~/core/ui/Alert';
import Badge from '~/core/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';
import { useAdsAccounts } from '~/lib/ads-center/hooks/useAdsAccounts';
import { PermissionGuard } from '~/components/PermissionGuard';
import LazyRender from '~/core/ui/LazyRender';
import { SimpleOAuthFlow, type AdsPlatform } from './SimpleOAuthFlow';
import { AdsAccountsList } from './AdsAccountsList';
import type { AdsAccount } from '~/lib/ads-center/types';

export function AdsCenterPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [connectedAccounts, setConnectedAccounts] = useState<AdsAccount[]>([]);
  const [showOAuthFlow, setShowOAuthFlow] = useState<AdsPlatform | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Fetch accounts data
  const {
    accounts,
    isLoading: accountsLoading,
    error: accountsError,
    refresh,
  } = useAdsAccounts();

  useEffect(() => {
    setConnectedAccounts(accounts);
  }, [accounts]);

  // Get subscription information and permissions
  const {
    subscription,
    canManageAds
  } = useEnhancedSubscription();

  
  const handleOAuthError = (error: Error) => {
    console.error('OAuth error:', error);
    toast.error(t('adsCenter.errors.oauthFailed', 'OAuth connection failed'));
    setShowOAuthFlow(null);
  };

  // Handlers for account management
  const handleRefreshAccount = async (_accountId: string) => {
    setIsLoading(true);
    try {
      // Refresh account data from API
      await refresh();
      toast.success(t('adsCenter.success.accountRefreshed', 'Account refreshed successfully'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(t('adsCenter.errors.refreshFailed', 'Failed to refresh account: {{message}}', { message }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm(t('adsCenter.confirmations.deleteAccount', 'Are you sure you want to disconnect this account?'))) {
      return;
    }
    
    try {
      // Remove account from list
      setConnectedAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
      toast.success(t('adsCenter.success.accountDeleted', 'Account disconnected successfully'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(t('adsCenter.errors.deleteFailed', 'Failed to disconnect account: {{message}}', { message }));
    }
  };

  const handleConfigureAccount = (accountId: string) => {
    // Navigate to account configuration page
    router.push(`/adscenter/accounts/${accountId}/settings`);
  };

  return (
    <PermissionGuard requirePermission="manageAds">
      <DashboardPageLayout
        header={{
          title: t('adsCenter.ui.title', 'Ads Center'),
          description: t('adsCenter.ui.description', 'Manage your advertising accounts and campaigns'),
          actions: (
            <PermissionGuard requirePermission="manageAds" fallback={null}>
              <Button size={'sm'}>
                {t('adsCenter.ui.connectAccount', 'Connect Account')}
              </Button>
            </PermissionGuard>
          ),
        }}
      >
        <div className={'flex flex-col gap-6'}>
          {/* Subscription status for Ads features */}
          {subscription && canManageAds && (
            <Alert type={'success'}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm">
                  <strong>{t('adsCenter.ui.premiumFeatures', '高级广告功能已启用')}</strong>
                  <p className="text-muted-foreground mt-1">
                    {t('adsCenter.ui.unlimitedAccounts', '无限广告账号连接')}
                  </p>
                </div>
                <Badge variant="outline">
                  {subscription.tier} {t('adsCenter.ui.plan', '套餐')}
                </Badge>
              </div>
            </Alert>
          )}

          {/* Platform OAuth flows */}
          <LazyRender>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Google Ads */}
              {showOAuthFlow === 'google' ? (
                <SimpleOAuthFlow
                  platform="google"
                  onError={handleOAuthError}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-sm">G</span>
                      </div>
                      Google Ads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('adsCenter.ui.googleAdsDesc', '连接Google Ads账号同步广告系列和性能数据')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowOAuthFlow('google')}
                    >
                      {t('adsCenter.ui.connectGoogleAds', '连接Google Ads')}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Facebook Ads */}
              {showOAuthFlow === 'facebook' ? (
                <SimpleOAuthFlow
                  platform="facebook"
                  onError={handleOAuthError}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">f</span>
                      </div>
                      Facebook Ads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('adsCenter.ui.facebookAdsDesc', '管理Facebook和Instagram广告活动')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowOAuthFlow('facebook')}
                    >
                      {t('adsCenter.ui.connectFacebookAds', '连接Facebook Ads')}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* TikTok Ads */}
              {showOAuthFlow === 'tiktok' ? (
                <SimpleOAuthFlow
                  platform="tiktok"
                  onError={handleOAuthError}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">TT</span>
                      </div>
                      TikTok Ads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('adsCenter.ui.tiktokAdsDesc', '连接TikTok Ads管理短视频广告活动')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowOAuthFlow('tiktok')}
                    >
                      {t('adsCenter.ui.connectTikTokAds', '连接TikTok Ads')}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </LazyRender>

          {accountsError ? (
            <Alert type={'error'}>
              <div className="text-sm">
                {t('adsCenter.errors.fetchFailed', '加载广告账号失败，请稍后重试')}
              </div>
            </Alert>
          ) : null}

          {/* Connected accounts overview */}
          <AdsAccountsList
            accounts={connectedAccounts}
            isLoading={isLoading || accountsLoading}
            onRefresh={handleRefreshAccount}
            onDelete={handleDeleteAccount}
            onConfigure={handleConfigureAccount}
          />

          {/* Features overview */}
          <Card>
            <CardHeader>
              <CardTitle>{t('adsCenter.ui.features', '功能特性')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">{t('adsCenter.ui.realTimeSync', '实时同步')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('adsCenter.ui.realTimeSyncDesc', '自动同步广告数据和性能指标')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">{t('adsCenter.ui.performanceTracking', '性能追踪')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('adsCenter.ui.performanceTrackingDesc', '详细的广告活动性能分析')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">{t('adsCenter.ui.budgetManagement', '预算管理')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('adsCenter.ui.budgetManagementDesc', '智能预算分配和优化建议')}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <div className="font-medium">{t('adsCenter.ui.automatedBidding', '自动竞价')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('adsCenter.ui.automatedBiddingDesc', 'AI驱动的竞价策略优化')}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardPageLayout>
    </PermissionGuard>
  );
}
