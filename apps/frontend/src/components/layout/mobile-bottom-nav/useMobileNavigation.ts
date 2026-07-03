/**
 * Mobile Navigation Hook
 * 移动端导航逻辑hooks
 */

import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Package, Megaphone, User } from 'lucide-react';

import configuration from '~/configuration';
import useNavigationContext from '~/lib/navigation/use-navigation-context';
import { useNavigationConfig as useNavigationConfigApi } from '~/lib/navigation/hooks';
import type {
  NavigationItem as ApiNavigationItem,
  NavigationLink as ApiNavigationLink,
} from '~/lib/navigation/types';
import { resolvePrimaryNavigationLinks } from '~/navigation.config';
import { createIconRenderer } from '~/components/icons';

import type { MobileItem } from './types';
import { DEFAULT_NAV_ITEMS } from './constants';
import {
  ensureAbsolutePath,
  getPath,
  adaptIconRenderer,
  adaptNavigationIcon,
} from './utils';

type ResolveParams = {
  role?: ReturnType<typeof useNavigationContext>['role'];
  subscriptionTier?: ReturnType<typeof useNavigationContext>['subscriptionTier'];
  featureFlags: ReturnType<typeof useNavigationContext>['featureFlags'];
  apiItems?: ApiNavigationItem[];
};

export function useMobileNavigation() {
  const { t } = useTranslation('navigation');
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const navigationContext = useNavigationContext();

  const appPrefix = configuration.paths.appPrefix.replace(/^\//, '');
  const isAppRoute = segments[0] === appPrefix;
  const basePath = `/${appPrefix}`;

  const { data: apiNavigation } = useNavigationConfigApi();

  const dynamicItems = resolveMobileItems({
    subscriptionTier: navigationContext.subscriptionTier,
    featureFlags: navigationContext.featureFlags,
    apiItems: apiNavigation?.items,
  });

  const items = dynamicItems.length > 0 ? dynamicItems : fallbackMobileItems(basePath);

  const translatedItems = items.map((item) => {
    const translationKey = item.labelKey ?? `mobileNav.${item.key}`;
    const label = t(translationKey, {
      defaultValue: item.label ?? item.key,
    });

    return {
      ...item,
      label,
    };
  });

  return {
    t,
    pathname,
    isAppRoute,
    items: translatedItems,
  };
}

function resolveMobileItems({
  subscriptionTier,
  featureFlags,
  apiItems,
}: ResolveParams): MobileItem[] {
  if (apiItems && apiItems.length > 0) {
    return resolveMobileItemsFromApi(apiItems);
  }

  const links = resolvePrimaryNavigationLinks({
    subscriptionTier,
    featureFlags,
  });

  if (links.length === 0) {
    return [];
  }

  const dashboardLink = links.find((link) => link.path === getPath('')) ?? null;
  const offersLink = links.find((link) => link.path.includes('/offers')) ?? null;
  const adsLink =
    links.find((link) => link.path.includes('/adscenter')) ??
    links.find((link) => link.path.includes('/tasks')) ??
    null;

  const result: MobileItem[] = [];

  if (dashboardLink) {
    result.push({
      key: 'dashboard',
      label: dashboardLink.label,
      labelKey: 'mobileNav.dashboard',
      href: ensureAbsolutePath(dashboardLink.path),
      icon: adaptNavigationIcon(dashboardLink.Icon),
    });
  } else {
    result.push({
      key: 'dashboard',
      labelKey: 'mobileNav.dashboard',
      href: ensureAbsolutePath(getPath('')),
      icon: LayoutDashboard,
    });
  }

  if (offersLink) {
    result.push({
      key: 'offers',
      label: offersLink.label,
      labelKey: 'mobileNav.offers',
      href: ensureAbsolutePath(offersLink.path),
      icon: adaptNavigationIcon(offersLink.Icon),
    });
  } else {
    result.push({
      key: 'offers',
      labelKey: 'mobileNav.offers',
      href: ensureAbsolutePath(getPath('offers')),
      icon: Package,
    });
  }

  if (adsLink) {
    const isAds = adsLink.path.includes('/adscenter');
    const iconRenderer = adaptNavigationIcon(adsLink.Icon);
    result.push({
      key: isAds ? 'ads' : 'tasks',
      label: adsLink.label,
      labelKey: isAds ? 'mobileNav.ads' : 'mobileNav.tasks',
      href: ensureAbsolutePath(adsLink.path),
      icon: iconRenderer,
    });
  } else {
    result.push({
      key: 'ads',
      labelKey: 'mobileNav.ads',
      href: ensureAbsolutePath(getPath('adscenter')),
      icon: Megaphone,
    });
  }

  result.push({
    key: 'me',
    labelKey: 'mobileNav.me',
    href: '/userinfo',
    icon: User,
    match: (pathname) => pathname.startsWith('/userinfo'),
  });

  return result.slice(0, 4);
}

function resolveMobileItemsFromApi(
  items: ApiNavigationItem[],
): MobileItem[] {
  const linkMap = new Map<string, ApiNavigationLink>();

  const collect = (link: ApiNavigationLink) => {
    if (link.key) {
      linkMap.set(link.key, link);
    }
  };

  items.forEach((item) => {
    if (item.type === 'link') {
      collect(item);
      return;
    }

    if (item.type === 'group') {
      item.children.forEach(collect);
    }
  });

  const result: MobileItem[] = [];
  const dashboardLink = linkMap.get('dashboard');
  const offersLink = linkMap.get('offers');
  const adsLink = linkMap.get('ads') ?? linkMap.get('tasks');

  if (dashboardLink) {
    result.push({
      key: 'dashboard',
      label: dashboardLink.label,
      labelKey: 'mobileNav.dashboard',
      href: ensureAbsolutePath(dashboardLink.path),
      icon: adaptIconRenderer(createIconRenderer(dashboardLink.icon)),
    });
  } else {
    result.push({
      key: 'dashboard',
      labelKey: 'mobileNav.dashboard',
      href: ensureAbsolutePath(getPath('')),
      icon: LayoutDashboard,
    });
  }

  if (offersLink) {
    result.push({
      key: 'offers',
      label: offersLink.label,
      labelKey: 'mobileNav.offers',
      href: ensureAbsolutePath(offersLink.path),
      icon: adaptIconRenderer(createIconRenderer(offersLink.icon)),
    });
  } else {
    result.push({
      key: 'offers',
      labelKey: 'mobileNav.offers',
      href: ensureAbsolutePath(getPath('offers')),
      icon: Package,
    });
  }

  if (adsLink) {
    const isAds = adsLink.key === 'ads' || adsLink.path.includes('/adscenter');
    const iconRenderer = adaptIconRenderer(createIconRenderer(adsLink.icon));

    result.push({
      key: isAds ? 'ads' : 'tasks',
      label: adsLink.label,
      labelKey: isAds ? 'mobileNav.ads' : 'mobileNav.tasks',
      href: ensureAbsolutePath(adsLink.path),
      icon: iconRenderer,
    });
  } else {
    result.push({
      key: 'ads',
      labelKey: 'mobileNav.ads',
      href: ensureAbsolutePath(getPath('adscenter')),
      icon: Megaphone,
    });
  }

  result.push({
    key: 'me',
    labelKey: 'mobileNav.me',
    href: '/userinfo',
    icon: User,
    match: (pathname) => pathname.startsWith('/userinfo'),
  });

  return result.slice(0, 4);
}

function fallbackMobileItems(basePath: string): MobileItem[] {
  return DEFAULT_NAV_ITEMS.map((item) => {
    if (item.key === 'me') {
      return item;
    }

    const suffix = item.href
      .replace(configuration.paths.appHome, '')
      .replace(/^\//, '');
    const href = suffix ? `${basePath}/${suffix}` : basePath;

    return {
      ...item,
      href: ensureAbsolutePath(href),
    };
  });
}
