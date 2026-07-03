import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  BarChart3,
  Bell,
  CheckSquare,
  CreditCard,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  Link,
  Megaphone,
  Package,
  Puzzle,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';

import clsx from 'clsx';

export type IconName =
  | 'dashboard'
  | 'offers'
  | 'ads'
  | 'tasks'
  | 'billing'
  | 'team'
  | 'settings'
  | 'profile'
  | 'automation'
  | 'reports'
  | 'notifications'
  | 'support'
  | 'security'
  | 'integrations'
  | 'global'
  | 'link';

type IconRegistry = Record<IconName, LucideIcon>;

const ICON_REGISTRY: IconRegistry = {
  dashboard: LayoutDashboard,
  offers: Package,
  ads: Megaphone,
  tasks: CheckSquare,
  billing: CreditCard,
  team: Users,
  settings: Settings2,
  profile: UserRound,
  automation: Sparkles,
  reports: BarChart3,
  notifications: Bell,
  support: LifeBuoy,
  security: ShieldCheck,
  integrations: Puzzle,
  global: Globe,
  link: Link,
};

const FALLBACK_ICON = AppWindow;

export function resolveIcon(name: IconName): LucideIcon {
  return ICON_REGISTRY[name] ?? FALLBACK_ICON;
}

export function listIconOptions(): Array<{ name: IconName; label: string }> {
  return Object.keys(ICON_REGISTRY).map((name) => ({
    name: name as IconName,
    label: ICON_TITLES[name as IconName],
  }));
}

const ICON_TITLES: Record<IconName, string> = {
  dashboard: 'Dashboard',
  offers: 'Offers',
  ads: 'Ads',
  tasks: 'Tasks',
  billing: 'Billing',
  team: 'Team',
  settings: 'Settings',
  profile: 'Profile',
  automation: 'Automation',
  reports: 'Reports',
  notifications: 'Notifications',
  support: 'Support',
  security: 'Security',
  integrations: 'Integrations',
  global: 'Global',
  link: 'Link',
};

type IconGlyphProps = {
  name: IconName;
  className?: string;
  'aria-hidden'?: boolean;
};

export function IconGlyph({
  name,
  className,
  'aria-hidden': ariaHidden = true,
}: IconGlyphProps) {
  const IconComponent = resolveIcon(name);

  return (
    <IconComponent
      aria-hidden={ariaHidden}
      focusable="false"
      className={clsx('h-5 w-5', className)}
    />
  );
}

export function createIconRenderer(name: IconName) {
  const IconComponent = resolveIcon(name);

  return function IconRenderer(props: { className: string }) {
    return (
      <IconComponent
        aria-hidden
        focusable="false"
        className={props.className}
      />
    );
  };
}
