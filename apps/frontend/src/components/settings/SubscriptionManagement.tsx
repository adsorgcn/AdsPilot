'use client';

import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import { Skeleton } from '~/core/ui/Skeleton';
import { 
  CreditCard, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Crown, 
  Zap,
  ArrowRight,
  Calendar,
  DollarSign
} from 'lucide-react';

import { useEnhancedSubscription, useSubscriptionConfigs } from '~/core/hooks/use-billing-api';
import { PlanComparisonTable, type PlanTier } from './PlanComparisonTable';
import { useRouter } from 'next/navigation';

/**
 * Subscription Management Component
 * 
 * 显示用户订阅详情、Token余额、功能权限和升级选项
 */
export function SubscriptionManagement() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    subscription,
    permissions,
    isLoading,
    error,
    canUseAI,
    canCreateOffers,
    canManageAds,
    isOnTrial,
    isExpired,
    needsUpgrade
  } = useEnhancedSubscription();

  const { data: configs } = useSubscriptionConfigs();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertTriangle className="h-5 w-5" />
            {t('subscription.error.title', 'Unable to Load Subscription')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-700">
            {t('subscription.error.description', 'There was an error loading your subscription information. Please try again later.')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSubscriptionIcon = () => {
    if (subscription.tier === 'elite') return <Crown className="h-5 w-5 text-purple-600" />;
    if (subscription.tier === 'max') return <TrendingUp className="h-5 w-5 text-blue-600" />;
    if (subscription.tier === 'pro') return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    return <Clock className="h-5 w-5 text-yellow-600" />;
  };

  const getSubscriptionBadgeColor = () => {
    if (subscription.tier === 'elite') return 'normal';
    if (subscription.isActive) return 'success';
    if (isOnTrial) return 'info';
    return 'error';
  };

  const availableUpgrades = configs?.filter(config =>
    config.isActive &&
    config.sortOrder > (configs.find(c => c.id === subscription.tier)?.sortOrder ?? 0)
  ) ?? [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getSubscriptionIcon()}
            {t('subscription.currentPlan', 'Current Plan')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Info */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="text-lg font-semibold capitalize">
                {subscription.tier} {t('subscription.plan', 'Plan')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isOnTrial
                  ? t('subscription.trialEndsOn', 'Trial ends on {{date}}', {
                      date: subscription.trialEndDate ? formatDate(subscription.trialEndDate) : 'N/A'
                    })
                  : subscription.subscriptionEndDate
                  ? t('subscription.renewsOn', 'Renews on {{date}}', {
                      date: formatDate(subscription.subscriptionEndDate)
                    })
                  : t('subscription.noRenewal', 'No renewal date')
                }
              </p>
            </div>
            <Badge color={getSubscriptionBadgeColor()}>
              {isOnTrial
                ? t('subscription.trial', 'Trial')
                : subscription.isActive
                ? t('subscription.active', 'Active')
                : t('subscription.inactive', 'Inactive')
              }
            </Badge>
          </div>

          {/* Trial Warning */}
          {isOnTrial && subscription.daysRemaining !== null && subscription.daysRemaining <= 7 && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900">
                  {t('subscription.trialEnding', 'Your trial is ending soon')}
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  {t('subscription.trialDaysLeft', 'You have {{days}} days left in your trial period.', {
                    days: subscription.daysRemaining
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Expired Warning */}
          {isExpired && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">
                  {t('subscription.expired', 'Your subscription has expired')}
                </p>
                <p className="text-sm text-red-700 mt-1">
                  {t('subscription.expiredDesc', 'Please renew your subscription to continue using premium features.')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            {t('subscription.tokenBalance', 'Token Balance')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">
                {subscription.currentTokenBalance.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('subscription.tokensAvailable', 'tokens available')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">
                {t('subscription.monthlyAllocation', 'Monthly Allocation')}
              </p>
              <p className="text-lg font-semibold">
                {subscription.monthlyTokenAllocation.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{t('subscription.used', 'Used')}</span>
              <span>
                {((1 - subscription.currentTokenBalance / subscription.monthlyTokenAllocation) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.max(0, (subscription.currentTokenBalance / subscription.monthlyTokenAllocation) * 100)}%`
                }}
              />
            </div>
          </div>

          {/* Low Balance Warning */}
          {subscription.currentTokenBalance < subscription.monthlyTokenAllocation * 0.2 && (
            <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-700">
                {t('subscription.lowBalance', 'Your token balance is running low. Consider upgrading your plan for more tokens.')}
              </p>
            </div>
          )}

          <Link href="/settings/tokens">
            <Button variant="outline" className="w-full">
              {t('subscription.viewTokenHistory', 'View Token History')}
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Features & Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {t('subscription.features', 'Features & Permissions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${canUseAI ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t('subscription.aiFeatures', 'AI Features')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {canUseAI ? t('subscription.enabled', 'Enabled') : t('subscription.disabled', 'Disabled')}
                </p>
              </div>
              {canUseAI && <Zap className="h-4 w-4 text-blue-600" />}
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${canCreateOffers ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t('subscription.createOffers', 'Create Offers')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {canCreateOffers ? t('subscription.enabled', 'Enabled') : t('subscription.disabled', 'Disabled')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${canManageAds ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t('subscription.manageAds', 'Manage Ads')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {canManageAds ? t('subscription.enabled', 'Enabled') : t('subscription.disabled', 'Disabled')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t('subscription.basicFeatures', 'Basic Features')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('subscription.enabled', 'Enabled')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Comparison Table */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          {t('subscription.comparePlans', 'Compare Plans')}
        </h3>
        <PlanComparisonTable
          currentPlan={(subscription.tier || 'trial') as PlanTier}
          onUpgrade={(plan) => {
            router.push(`/settings/subscription?plan=${plan}`);
          }}
        />
      </div>

      {/* Upgrade Options */}
      {(needsUpgrade || isExpired || availableUpgrades.length > 0) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <TrendingUp className="h-5 w-5" />
              {isExpired 
                ? t('subscription.renewSubscription', 'Renew Your Subscription')
                : t('subscription.upgradeYourPlan', 'Upgrade Your Plan')
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-blue-700">
              {isExpired
                ? t('subscription.renewDesc', 'Renew your subscription to regain access to all features.')
                : t('subscription.upgradeDesc', 'Unlock more features, higher limits, and additional tokens with a premium plan.')
              }
            </p>

            {availableUpgrades.length > 0 && (
              <div className="space-y-3">
                {availableUpgrades.map(plan => (
                  <div key={plan.id} className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div>
                      <p className="font-semibold capitalize">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {plan.description || t('subscription.premiumFeatures', 'Premium features and higher limits')}
                      </p>
                    </div>
                    <Link href={`/settings/subscription?plan=${plan.id}`}>
                      <Button variant="default">
                        {t('subscription.selectPlan', 'Select Plan')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <Link href="/settings/subscription">
              <Button variant="outline" className="w-full">
                {t('subscription.viewAllPlans', 'View All Plans')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Subscription Details */}
      {subscription.subscriptionEndDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-600" />
              {t('subscription.subscriptionDetails', 'Subscription Details')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('subscription.subscriptionId', 'Subscription ID')}
                </p>
                <p className="text-sm font-medium mt-1 font-mono">
                  {subscription.subscriptionId || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  {t('subscription.nextRenewalDate', 'Next Renewal Date')}
                </p>
                <p className="text-sm font-medium mt-1">
                  {formatDate(subscription.subscriptionEndDate)}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Link href="/settings/billing">
                <Button variant="outline" className="w-full">
                  {t('subscription.manageBilling', 'Manage Billing')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
