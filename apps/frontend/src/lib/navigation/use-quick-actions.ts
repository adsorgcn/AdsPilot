'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import configuration from '~/configuration';
import { useAdsAccounts } from '~/lib/ads-center/hooks/useAdsAccounts';
import { useBillingTokenBalance } from '~/lib/billing/hooks';
import useNavigationContext from '~/lib/navigation/use-navigation-context';

export type QuickAction = {
  key: string;
  label: string;
  href: string;
  highlight?: boolean;
  disabled?: boolean;
  reason?: string;
};

export default function useQuickActions(basePath: string) {
  // 直接调用微服务API（用户Dashboard不耦合Console服务）
  const { accounts } = useAdsAccounts();
  const { data: tokenBalance } = useBillingTokenBalance();
  const { subscriptionTier } = useNavigationContext();
  const { t } = useTranslation('common');

  return useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = [
      {
        key: 'create-offer',
        label: t('dashboardTopbar.quickActions.createOffer'),
        href: join(basePath, 'offers/new'),
      },
      {
        key: 'evaluate-offer',
        label: t('dashboardTopbar.quickActions.evaluateOffer'),
        href: join(basePath, 'offers?filter=pending'),
      },
      {
        key: 'connect-ads',
        label: t('dashboardTopbar.quickActions.connectAds'),
        href: join(basePath, 'adscenter'),
        highlight: accounts.length === 0,
      },
    ];

    const availableTokens = tokenBalance?.balance ?? 0;
    const monthlyAllocation = tokenBalance?.monthlyAllocation ?? null;
    const lowTokenBalance = availableTokens < (monthlyAllocation ? Math.max(100, monthlyAllocation * 0.05) : 100);

    if (lowTokenBalance) {
      actions.push({
        key: 'topup',
        label: t('dashboardTopbar.quickActions.topup'),
        href: '/settings?tab=tokens',
        highlight: true,
      });
    }

    if (subscriptionTier === 'trial') {
      actions.push({
        key: 'upgrade',
        label: t('dashboardTopbar.quickActions.upgrade'),
        href: '/pricing',
        highlight: true,
      });
    }

    return actions.slice(0, 4);
  }, [basePath, accounts, tokenBalance, subscriptionTier, t]);
}

function join(base: string, suffix?: string) {
  if (!suffix) {
    return ensureAbsolutePath(base);
  }

  const sanitized = suffix.startsWith('/') ? suffix.slice(1) : suffix;

  return ensureAbsolutePath(`${base}/${sanitized}`);
}

function ensureAbsolutePath(path: string) {
  if (!path) {
    return configuration.paths.appHome;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return path.startsWith('/') ? path : `/${path}`;
}
