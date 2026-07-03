'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crown,
  Zap,
  ArrowRight
} from 'lucide-react';

import { useEnhancedSubscription, useSubscriptionConfigs } from '~/core/hooks/use-billing-api';
import { Skeleton } from '~/core/ui/Skeleton';

/**
 * Subscription Status Card Component
 *
 * 显示用户当前订阅状态、Token余额和升级选项
 */
export function SubscriptionStatusCard() {
  const { t } = useTranslation();
  const {
    subscription,
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('dashboard.subscription.title', 'Subscription Status')}
          </CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !subscription) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-900">
            {t('dashboard.subscription.error', 'Subscription Error')}
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-700">
            {t('dashboard.subscription.errorDesc', 'Unable to load subscription information')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSubscriptionIcon = () => {
    if (subscription.tier === 'elite') return <Crown className="h-4 w-4 text-purple-600" />;
    if (subscription.tier === 'max') return <TrendingUp className="h-4 w-4 text-blue-600" />;
    if (subscription.tier === 'pro') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    return <Clock className="h-4 w-4 text-yellow-600" />;
  };

  const getSubscriptionBadgeVariant = () => {
    if (subscription.tier === 'elite') return 'default';
    if (subscription.isActive) return 'secondary';
    if (isOnTrial) return 'outline';
    return 'destructive';
  };

  const availableUpgrades = configs?.filter(config =>
    config.isActive &&
    config.sortOrder > (configs.find(c => c.id === subscription.tier)?.sortOrder ?? 0)
  ) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {t('dashboard.subscription.title', 'Subscription Status')}
        </CardTitle>
        {getSubscriptionIcon()}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Plan */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium capitalize">
              {subscription.tier} {t('dashboard.subscription.plan', 'Plan')}
            </p>
            <p className="text-xs text-muted-foreground">
              {isOnTrial
                ? t('dashboard.subscription.trialDaysLeft', '{{days}} days left', {
                    days: subscription.daysRemaining
                  })
                : subscription.isActive
                ? t('dashboard.subscription.active', 'Active')
                : t('dashboard.subscription.expired', 'Expired')
              }
            </p>
          </div>
          <Badge variant={getSubscriptionBadgeVariant()}>
            {isOnTrial
              ? t('dashboard.subscription.trial', 'Trial')
              : subscription.isActive
              ? t('dashboard.subscription.active', 'Active')
              : t('dashboard.subscription.inactive', 'Inactive')
            }
          </Badge>
        </div>

        {/* Token Balance */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {t('dashboard.subscription.tokens', 'Token Balance')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.subscription.monthlyAllocation', '{{allocated}} / {{used}}', {
                allocated: subscription.monthlyTokenAllocation,
                used: subscription.monthlyTokenAllocation - subscription.currentTokenBalance
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">
              {subscription.currentTokenBalance.toLocaleString()}
            </p>
            <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{
                  width: `${Math.max(0, (subscription.currentTokenBalance / subscription.monthlyTokenAllocation) * 100)}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t('dashboard.subscription.features', 'Features')}
          </p>
          <div className="flex flex-wrap gap-2">
            {canUseAI && (
              <Badge variant="secondary" className="gap-1">
                <Zap className="h-3 w-3" />
                {t('dashboard.subscription.aiFeatures', 'AI Features')}
              </Badge>
            )}
            {canCreateOffers && (
              <Badge variant="outline">
                {t('dashboard.subscription.createOffers', 'Create Offers')}
              </Badge>
            )}
            {canManageAds && (
              <Badge variant="outline">
                {t('dashboard.subscription.manageAds', 'Manage Ads')}
              </Badge>
            )}
          </div>
        </div>

        {/* Upgrade Section */}
        {(needsUpgrade || isExpired || availableUpgrades.length > 0) && (
          <div className="pt-3 border-t">
            {isExpired ? (
              <div className="space-y-2">
                <p className="text-sm text-red-600 font-medium">
                  {t('dashboard.subscription.expiredMessage', 'Your subscription has expired')}
                </p>
                {availableUpgrades.length > 0 && (
                  <Link href="/settings/subscription">
                    <Button className="w-full" variant="default">
                      {t('dashboard.subscription.renewNow', 'Renew Now')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            ) : needsUpgrade ? (
              <div className="space-y-2">
                <p className="text-sm text-blue-600 font-medium">
                  {t('dashboard.subscription.upgradeMessage', 'Unlock more features with a higher plan')}
                </p>
                {availableUpgrades.slice(0, 1).map(plan => (
                  <Link key={plan.id} href="/settings/subscription">
                    <Button className="w-full" variant="outline">
                      {t('dashboard.subscription.upgradeTo', 'Upgrade to {{plan}}', { plan: plan.name })}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                ))}
              </div>
            ) : isOnTrial && (
              <div className="space-y-2">
                <p className="text-sm text-yellow-600 font-medium">
                  {t('dashboard.subscription.trialMessage', 'Enjoying your trial?')}
                </p>
                {availableUpgrades.length > 0 && (
                  <Link href="/settings/subscription">
                    <Button className="w-full" variant="outline">
                      {t('dashboard.subscription.choosePlan', 'Choose Your Plan')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manage Subscription Link */}
        <div className="pt-2">
          <Link href="/settings/subscription">
            <Button variant="ghost" size="sm" className="w-full">
              {t('dashboard.subscription.manageSubscription', 'Manage Subscription')}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}