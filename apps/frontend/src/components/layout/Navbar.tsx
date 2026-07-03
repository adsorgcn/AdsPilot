'use client';

import { createElement, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import classNames from 'clsx';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import configuration from '~/configuration';
import useUserSession from '~/core/hooks/use-user-session';
import useSignOut from '~/core/hooks/use-sign-out';
import useNavigationContext from '~/lib/navigation/use-navigation-context';
import { useNavigationConfig as useNavigationConfigApi } from '~/lib/navigation/hooks';
import type {
  NavigationItem as ApiNavigationItem,
  NavigationLink as ApiNavigationLink,
} from '~/lib/navigation/types';
import { resolvePrimaryNavigationLinks } from '~/navigation.config';
import { createIconRenderer } from '~/components/icons';
import Button from '~/core/ui/Button';
import DarkModeToggle from '~/components/DarkModeToggle';
import ProfileDropdown from '~/components/ProfileDropdown';
import LanguageSwitcher from '~/components/LanguageSwitcher';
import NotificationsPopover from '~/components/NotificationsPopover';

type PublicLink = {
  label: string;
  href: string;
};

type AppLink = {
  label: string;
  href: string;
  Icon?: ComponentType<{ className?: string }>;
};

export default function Navbar() {
  const { t, i18n } = useTranslation('common');
  const pathname = usePathname();
  const session = useUserSession();
  const signOut = useSignOut();
  const { subscriptionTier, featureFlags } = useNavigationContext();
  const { data: apiNavigation } = useNavigationConfigApi();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isI18nReady, setIsI18nReady] = useState(false);

  useEffect(() => {
    if (i18n.isInitialized && i18n.language) {
      setIsI18nReady(true);
    }
  }, [i18n.isInitialized, i18n.language]);

  const publicLinks: PublicLink[] = useMemo(() => {
    // Wait for i18n to be ready before rendering to avoid English flash
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

  useEffect(() => {
    if (mobileOpen) {
      setMobileOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isAuthenticated = Boolean(session?.auth);

  const appLinks = useMemo(() => {
    if (!isAuthenticated) {
      return [] as AppLink[];
    }

    if (apiNavigation) {
      return mapApiNavigationToAppLinks(apiNavigation.items);
    }

    const navigationLinks = resolvePrimaryNavigationLinks({
      subscriptionTier,
      featureFlags,
    });

    const normalized = navigationLinks.map((link) => ({
      label: link.label,
      href: ensureAbsolutePath(link.path),
      Icon: wrapIconComponent(link.Icon),
    }));

    return limitAppLinks(normalized);
  }, [
    apiNavigation,
    featureFlags,
    isAuthenticated,
    subscriptionTier,
  ]);

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

  return (
    <nav
      className={classNames(
        'sticky top-0 z-50',
        // 高度: 64px → 56px
        'h-14',
        // 边框: 更淡
        'border-b border-border/40',
        // 背景: 玻璃态效果
        'bg-background/60 backdrop-blur-xl backdrop-saturate-150',
        'supports-[backdrop-filter]:bg-background/60',
        // 阴影
        'shadow-[0_1px_0_0_rgba(0,0,0,0.03)]',
        'dark:shadow-[0_1px_0_0_rgba(255,255,255,0.03)]',
        // 动画
        'transition-all duration-300',
      )}
      role="navigation"
      aria-label={t('mainNavigation')}
    >
      <div className="layout-container flex h-full items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/assets/images/favicon/logo.png"
            alt={configuration.site.siteName}
            width={1954}
            height={116}
            sizes="(max-width: 768px) 112px, 128px"
            className={classNames(
              'h-auto w-28 sm:w-32',
              'transition-transform duration-200',
              'group-hover:scale-105'
            )}
            priority
          />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {currentLinks.map((link) => {
            const IconComponent = link.Icon;
            const active = isActive(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={classNames(
                  'relative flex items-center gap-2 px-3 py-1.5 rounded-lg',
                  'text-base font-medium',
                  'transition-colors duration-200',
                  // 活动状态
                  active ? 'text-primary' : 'text-foreground/70 hover:text-foreground',
                )}
              >
                {IconComponent && <IconComponent className="h-4 w-4" />}
                <span>{t(link.label)}</span>

                {/* 活动指示器 - Framer Motion */}
                {active && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute inset-0 -z-10 rounded-lg bg-muted"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center md:flex">
          <div className="flex items-center gap-2.5">
            <DarkModeToggle />
            <LanguageSwitcher variant="icon" />
          </div>

          {isAuthenticated ? (
            <div className="ml-4 flex items-center gap-2.5">
              <NotificationsPopover />

              <ProfileDropdown
                className="w-full"
                userSession={session}
                signOutRequested={signOut}
              />
            </div>
          ) : (
            <Button
              href={configuration.paths.signIn}
              size="sm"
              round
              className={classNames(
                'ml-4 px-5 text-sm font-semibold whitespace-nowrap',
                'shadow-lg shadow-primary/20 hover:shadow-primary/40',
              )}
            >
              {t('getStartedCta')}
            </Button>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition hover:bg-muted md:hidden"
          aria-label={t('toggleNavigation')}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="border-t border-border/40 bg-background/95 backdrop-blur-xl md:hidden"
        >
          <div className="flex flex-col gap-2 px-4 py-4">
            {currentLinks.map((link) => {
              const IconComponent = link.Icon;
              const active = isActive(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={classNames(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium',
                    active
                      ? 'bg-primary/10 text-primary-600 dark:text-primary-300'
                      : 'text-muted-foreground hover:bg-muted/70',
                  )}
                >
                  {IconComponent ? (
                    <IconComponent className="h-5 w-5" />
                  ) : null}
                  <span>{t(link.label)}</span>
                </Link>
              );
            })}

            <div className="mt-2 flex flex-col gap-2">
              <DarkModeToggle />
              <LanguageSwitcher variant="icon" />
            </div>

            {isAuthenticated ? (
              <Button
                variant="ghost"
                className="justify-start gap-2"
                onClick={() => signOut()}
              >
                <LogOut className="h-4 w-4" />
                {t('signOut')}
              </Button>
            ) : (
              <Button
                href={configuration.paths.signIn}
                size="default"
                round
                className="w-full font-medium whitespace-nowrap"
              >
                {t('getStartedCta')}
              </Button>
            )}
          </div>
        </motion.div>
      ) : null}
    </nav>
  );
}

function mapApiNavigationToAppLinks(items: ApiNavigationItem[]): AppLink[] {
  const flattened: AppLink[] = [];

  items.forEach((item) => {
    if (item.type === 'divider') {
      return;
    }

    if (item.type === 'group') {
      item.children.forEach((child) => {
        flattened.push(mapApiNavigationLinkToAppLink(child));
      });

      return;
    }

    flattened.push(mapApiNavigationLinkToAppLink(item));
  });

  return limitAppLinks(flattened);
}

function mapApiNavigationLinkToAppLink(link: ApiNavigationLink): AppLink {
  return {
    label: link.label,
    href: ensureAbsolutePath(link.path),
    Icon: wrapIconComponent(createIconRenderer(link.icon)),
  };
}

function limitAppLinks(links: AppLink[]): AppLink[] {
  // 只显示主要的 Dashboard 导航项，过滤掉设置子页面和管理页面
  const mainLinks = links.filter(
    (link) =>
      !link.href.includes('/settings/') &&
      !link.href.includes('/manage')
  );

  // 限制显示数量（Dashboard, Offers, Tasks, Ads Center）
  return mainLinks.slice(0, 5);
}

function wrapIconComponent(
  icon?: ComponentType<{ className: string }>,
): ComponentType<{ className?: string }> | undefined {
  if (!icon) {
    return undefined;
  }

  const Wrapped: ComponentType<{ className?: string }> = ({ className = '' }) =>
    createElement(icon, { className });

  return Wrapped;
}


function isActive(pathname: string, href: string) {
  const target = ensureAbsolutePath(href);

  if (target === '/') {
    return pathname === '/';
  }

  return pathname.startsWith(target);
}

function ensureAbsolutePath(path: string) {
  if (!path) {
    return '/';
  }

  return path.startsWith('/') ? path : `/${path}`;
}
