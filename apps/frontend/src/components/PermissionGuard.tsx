'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import {
  LockClosedIcon,
  StarIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface PermissionGuardProps {
  children: ReactNode;
  requirePermission?: 'createOffers' | 'useAI' | 'manageAds';
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

export function PermissionGuard({
  children,
  requirePermission,
  fallback,
  showUpgradePrompt = true,
}: PermissionGuardProps) {
  const { t } = useTranslation();
  const {
    subscription,
    isLoading: subscriptionLoading,
    canCreateOffers,
    canUseAI,
    canManageAds,
    isOnTrial,
    isExpired,
  } = useEnhancedSubscription();

  // Check if the required permission is available
  const hasPermission = () => {
    switch (requirePermission) {
      case 'createOffers':
        return canCreateOffers;
      case 'useAI':
        return canUseAI;
      case 'manageAds':
        return canManageAds;
      default:
        return true;
    }
  };

  // Show loading state
  if (subscriptionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check if user has the required permission
  if (!hasPermission()) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (!showUpgradePrompt) {
      return null;
    }

    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <LockClosedIcon className="h-5 w-5" />
            {t('permissionGuard.title', '需要升级订阅')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-amber-700">
            {requirePermission === 'createOffers' && (
              <p>
                {t('permissionGuard.createOffersMessage', '创建Offer功能需要Professional或Elite套餐。')}
              </p>
            )}
            {requirePermission === 'useAI' && (
              <p>
                {t('permissionGuard.useAIMessage', 'AI评估功能需要Professional或Elite套餐。')}
              </p>
            )}
            {requirePermission === 'manageAds' && (
              <p>
                {t('permissionGuard.manageAdsMessage', '广告账号管理功能需要Elite套餐。')}
              </p>
            )}
          </div>

          {/* Current subscription status */}
          {subscription && (
            <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-amber-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{subscription.tier}</span>
                  {isOnTrial && (
                    <Badge variant="outline">
                      {t('permissionGuard.trial', '试用')}
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant="destructive">
                      {t('permissionGuard.expired', '已过期')}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('permissionGuard.currentPlan', '当前套餐')}
                </div>
              </div>
            </div>
          )}

          {/* Upgrade prompt */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <StarIcon className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <div className="font-medium text-blue-900">
                {t('permissionGuard.upgradeTitle', '升级以解锁功能')}
              </div>
              <div className="text-xs text-blue-700">
                {t('permissionGuard.upgradeDesc', '获得更多功能和更高的使用限制')}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Link href="/settings/subscription">
              <Button className="flex-1">
                <ArrowRightIcon className="h-4 w-4 mr-2" />
                {t('permissionGuard.viewPlans', '查看套餐')}
              </Button>
            </Link>
            <Button variant="outline" className="flex-1">
              <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
              {t('permissionGuard.learnMore', '了解更多')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show trial warning if applicable
  if (isOnTrial && requirePermission) {
    return (
      <>
        <Card className="border-blue-200 bg-blue-50 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <div className="font-medium text-blue-900">
                  {t('permissionGuard.trialMode', '试用模式')}
                </div>
                <div className="text-sm text-blue-700">
                  {t('permissionGuard.trialMessage', '您正在使用试用版，功能使用可能受限。')}
                  {subscription?.daysRemaining && (
                    <span>
                      {' '}{t('permissionGuard.trialDaysLeft', '剩余 {{days}} 天', { days: subscription.daysRemaining })}
                    </span>
                  )}
                </div>
              </div>
              <Link href="/settings/subscription">
                <Button variant="outline" size="sm">
                  {t('permissionGuard.upgradeNow', '立即升级')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        {children}
      </>
    );
  }

  // Show content if user has permission
  return <>{children}</>;
}