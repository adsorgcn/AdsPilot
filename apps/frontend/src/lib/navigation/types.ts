import type { IconName } from '~/components/icons';

export type NavigationItemType = 'link' | 'group' | 'divider';

export interface NavigationLink {
  key: string;
  type: 'link';
  label: string;
  path: string;
  icon: IconName;
  end?: boolean;
}

export interface NavigationGroup {
  key: string;
  type: 'group';
  label: string;
  icon?: IconName;
  collapsible?: boolean;
  collapsed?: boolean;
  children: NavigationLink[];
}

export interface NavigationDivider {
  key: string;
  type: 'divider';
}

export type NavigationItem = NavigationLink | NavigationGroup | NavigationDivider;

export interface NavigationQuickAction {
  key: string;
  label: string;
  href: string;
  highlight?: boolean;
  disabled?: boolean;
  reason?: string;
}

export interface NavigationResponse {
  role: string;
  subscriptionTier: string;
  tokenBalance: number;
  monthlyTokenAllocation: number;
  items: NavigationItem[];
  quickActions: NavigationQuickAction[];
  generatedAt: string;
}
