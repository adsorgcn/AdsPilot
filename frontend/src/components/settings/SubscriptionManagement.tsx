'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import { Button } from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import {
  Crown,
  Check,
  X,
  TrendingUp,
  Zap,
  Star,
  ChevronRight,
  AlertTriangle,
  Info,
  CheckCircle2
} from 'lucide-react';

import { useSubscription, useSubscriptionConfigs, usePricingConfigs, useCreateTrialSubscription, useUpgradeSubscription } from '~/core/hooks/use-billing-api';
import { Skeleton } from '~/core/ui/Skeleton';

/**
 * Subscription Management Component
 *
 * 显示当前订阅状态、套餐对比和升级选项
 */
export function SubscriptionManagement() {
  const { t } = useTranslation();
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription();
  const { data: configs, isLoading: configsLoading } = useSubscriptionConfigs();
  const { data: pricing } = usePricingConfigs();
  const createTrial = useCreateTrialSubscription();
  const upgradeSubscription = useUpgradeSubscription();

  const [isUpgrading, setIsUpgrading] = useState(false);

  if (subscriptionLoading || !subscription) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.subscription.loading', 'Loading subscription...')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mt-2" />
            <Skeleton className="h-8 w-16 mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(true);
    try {
      await upgradeSubscription(planId);
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleCreateTrial = async () => {
    try {
      await createTrial();
    } catch (error) {
      console.error('Failed to create trial:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            {t('settings.subscription.current.title', 'Current Subscription')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-semibold capitalize">{subscription.tier}</h3>
                  {subscription.isOnTrial && (
                    <Badge variant="outline">
                      {t('settings.subscription.current.trial', 'Trial')}
                    </Badge>
                  )}
                  {subscription.isActive && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {t('settings.subscription.current.active', 'Active')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {subscription.isExpired
                    ? t('settings.subscription.current.expired', 'Subscription expired')
                    : subscription.isActive
                    ? t('settings.subscription.current.activeDesc', 'Your subscription is active and all features are available')
                    : t('settings.subscription.current.inactiveDesc', 'Manage your subscription to access features')}
                }
              </div>
              {subscription.isExpired && (
                <Button onClick={handleCreateTrial} className="ml-auto">
                  {t('settings.subscription.current.reactivate', 'Reactivate')}
                </Button>
              )}
            </div>

            {/* Token Balance */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t('settings.subscription.current.tokenBalance', 'Token Balance')}
                </span>
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {subscription.currentTokenBalance.toLocaleString()} / {subscription.monthlyTokenAllocation.toLocaleString()}
                  </div>
                  <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${Math.max(0, (subscription.currentTokenBalance / subscription.monthlyTokenAllocation) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="border-t pt-4">
              <span className="text-sm font-medium block mb-3">
                {t('settings.subscription.current.features', 'Current Features')}
              </span>
              <div className="flex flex-wrap gap-2">
                {subscription.canUseAI && (
                  <Badge variant="secondary" className="gap-1">
                    <Zap className="h-3 w-3" />
                    {t('settings.subscription.current.aiFeatures', 'AI Evaluation')}
                  </Badge>
                )}
                {canCreateOffers && (
                  <Badge variant="outline">
                    {t('settings.subscription.current.createOffers', 'Create Offers')}
                  </Badge>
                )}
                {canManageAds && (
                  <Badge variant="outline">
                    {t('settings.subscription.current.manageAds', 'Manage Ads')}
                  </Badge>
                )}
              </div>
            </div>

            {/* Upgrade Alert */}
            {!subscription.canUseAI && !subscription.isOnTrial && (
              <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">
                      {t('settings.subscription.current.upgradeTitle', 'Upgrade to Access AI Features')}
                    </h4>
                    <p className="text-sm text-blue-700 mt-1">
                      {t('settings.subscription.current.upgradeDesc', 'Upgrade to Professional or Elite to access AI evaluation and advanced features')}
                    </p>
                    <div className="mt-3">
                      <Link href="/settings/subscription/plans">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          {t('settings.subscription.current.viewPlans', 'View Upgrade Options')}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.subscription.plans.title', 'Available Plans')}</CardTitle>
        </CardHeader>
        <CardContent>
          {configsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border rounded-lg p-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-full mt-2" />
                  <Skeleton className="h-4 w-3/4 mt-1" />
                  <div className="mt-4 flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {configs?.map((plan) => {
                const isCurrentPlan = plan.id === subscription.tier;
                const canUpgrade = subscription.availableUpgrades?.includes(plan.id as any);
                const isRecommended = plan.id === 'professional';

                return (
                  <div
                    key={plan.id}
                    className={`relative border rounded-lg p-6 transition-all ${
                      isCurrentPlan
                        ? 'border-blue-500 bg-blue-50'
                        : isRecommended
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute -top-2 right-4">
                        <Badge className="bg-green-500 text-white">
                          <Star className="h-3 w-3 mr-1" />
                          {t('settings.subscription.plans.recommended', 'Recommended')}
                        </Badge>
                      </div>
                    )}

                    {isCurrentPlan && (
                      <div className="absolute -top-2 right-4">
                        <Badge className="bg-blue-500 text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('settings.subscription.plans.current', 'Current')}
                        </Badge>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-lg font-semibold">{plan.name}</h3>
                          <p className="text-sm text-muted-foreground">{plan.description}</p>
                        </div>

                        <div>
                          <div className="text-2xl font-bold">
                            {plan.monthlyTokens.toLocaleString()}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t('settings.subscription.plans.tokensPerMonth', 'Tokens per month')}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium block mb-2">
                            {t('settings.subscription.plans.features', 'Features')}
                          </span>
                          <div className="space-y-1">
                            {plan.features.map((feature, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <Check className="h-4 w-4 text-green-500" />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {isCurrentPlan ? (
                            <Button variant="outline" disabled className="flex-1">
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              {t('settings.subscription.plans.currentPlan', 'Current Plan')}
                            </Button>
                          ) : canUpgrade ? (
                            <Button
                              onClick={() => handleUpgrade(plan.id)}
                              disabled={isUpgrading}
                              className="flex-1"
                            >
                              {isUpgrading ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                                  {t('settings.subscription.plans.upgrading', 'Upgrading...')}
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="h-4 w-4 mr-2" />
                                  {t('settings.subscription.plans.upgrade', 'Upgrade')}
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button variant="outline" disabled className="flex-1">
                              <X className="h-4 w-4 mr-2" />
                              {t('settings.subscription.plans.notAvailable', 'Not Available')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.subscription.billing.title', 'Billing History')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-3" />
            <p>{t('settings.subscription.billing.comingSoon', 'Billing history will be available soon')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}