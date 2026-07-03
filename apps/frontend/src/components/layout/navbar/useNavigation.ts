/**
 * Navigation Hook
 * 处理导航栏的状态管理和逻辑
 */

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import configuration from '~/configuration';
import useUserSession from '~/core/hooks/use-user-session';
import useNavigationContext from '~/lib/navigation/use-navigation-context';
import { useNavigationConfig as useNavigationConfigApi } from '~/lib/navigation/hooks';
import { resolvePrimaryNavigationLinks } from '~/navigation.config';
import type { ComponentType } from 'react';

export type AppLink = {
  label: string;
  href: string;
  Icon?: ComponentType<{ className?: string }>;
};

export type PublicLink = {
  label: string;
  href: string;
};

export function useNavigation() {
  const { t, i18n } = useTranslation('common');
  const pathname = usePathname();
  const session = useUserSession();
  const { role, subscriptionTier, featureFlags } = useNavigationContext();
  const { data: apiNavigation } = useNavigationConfigApi();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isI18nReady, setIsI18nReady] = useState(false);

  // 等待i18n初始化完成
  useEffect(() => {
    if (i18n.isInitialized && i18n.language) {
      setIsI18nReady(true);
    }
  }, [i18n.isInitialized, i18n.language]);

  // 路由变化时关闭移动菜单
  useEffect(() => {
    if (mobileOpen) {
      setMobileOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isAuthenticated = Boolean(session?.auth);

  const basePath = useMemo(() => {
    return configuration.paths.appHome;
  }, []);

  // 公开链接(未登录时显示)
  const publicLinks: PublicLink[] = useMemo(() => {
    if (!isI18nReady) {
      return [];
    }
    return [
      { label: t('features'), href: '/features' },
      { label: t('pricing'), href: '/pricing' },
      { label: t('highValueOffers'), href: '/high-value-offers' },
      { label: t('support'), href: '/support' },
    ];
  }, [t, isI18nReady]);

  // 应用链接(登录后显示)
  const appLinks = useMemo((): AppLink[] => {
    if (!isAuthenticated) {
      return [];
    }

    // 优先使用API返回的导航配置
    if (apiNavigation) {
      return apiNavigation.items
        .filter((item) => item.type === 'link')
        .map((item) => ({
          label: (item as { label: string }).label,
          href: (item as { path: string }).path,
          Icon: undefined, // API配置暂不支持图标
        }));
    }

    // 降级到本地配置
    const navigationLinks = resolvePrimaryNavigationLinks({
      subscriptionTier,
      featureFlags,
    });

    return navigationLinks.map((link) => ({
      label: link.label,
      href: link.path.startsWith('/') ? link.path : `/${link.path}`,
      Icon: (props: { className?: string }) => link.Icon({ className: props.className ?? '' }),
    }));
  }, [apiNavigation, featureFlags, isAuthenticated, subscriptionTier]);

  // 当前显示的链接列表
  const currentLinks = useMemo<AppLink[]>(() => {
    if (isAuthenticated) {
      return appLinks;
    }

    return publicLinks.map((link) => ({
      label: link.label,
      href: link.href,
      Icon: undefined,
    }));
  }, [appLinks, isAuthenticated, publicLinks]);

  return {
    t,
    pathname,
    session,
    role,
    isAuthenticated,
    basePath,
    currentLinks,
    mobileOpen,
    setMobileOpen,
    isI18nReady,
  };
}
