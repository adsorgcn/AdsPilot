/**
 * Mobile Bottom Navigation Constants
 * 移动端底部导航常量
 */

import { LayoutDashboard, Package, Megaphone, User } from 'lucide-react';
import configuration from '~/configuration';
import type { MobileItem } from './types';

export const DEFAULT_NAV_ITEMS: MobileItem[] = [
  {
    key: 'dashboard',
    labelKey: 'mobileNav.dashboard',
    href: configuration.paths.appHome,
    icon: LayoutDashboard,
  },
  {
    key: 'offers',
    labelKey: 'mobileNav.offers',
    href: `${configuration.paths.appHome}/offers`,
    icon: Package,
  },
  {
    key: 'ads',
    labelKey: 'mobileNav.ads',
    href: `${configuration.paths.appHome}/adscenter`,
    icon: Megaphone,
  },
  {
    key: 'me',
    labelKey: 'mobileNav.me',
    href: '/settings',
    icon: User,
    match: (pathname) => pathname.startsWith('/settings'),
  },
];
