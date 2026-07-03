'use client';

import { createElement } from 'react';
import type { ElementType } from 'react';
import Trans from '~/core/ui/Trans';
import { SidebarItem, SidebarDivider, SidebarGroup } from '~/core/ui/Sidebar';

import {
  createNavigationConfig,
  type NavigationConfigItem,
  type NavigationGroup,
  type NavigationItemLink,
} from '~/navigation.config';
import { useNavigationConfig as useNavigationConfigApi } from '~/lib/navigation/hooks';
import type {
  NavigationItem as ApiNavigationItem,
  NavigationLink as ApiNavigationLink,
} from '~/lib/navigation/types';
import useNavigationContext from '~/lib/navigation/use-navigation-context';
import { createIconRenderer } from '~/components/icons';
import useUserRole from '~/lib/user/hooks/use-user-role';

function AppSidebarNavigation() {
  const navigationContext = useNavigationContext();
  const { data: apiNavigation } = useNavigationConfigApi();
  const { role: userRole } = useUserRole();

  const fallbackConfig = createNavigationConfig({
    subscriptionTier: navigationContext.subscriptionTier,
    featureFlags: navigationContext.featureFlags,
    userRole,
  });

  const items = apiNavigation
    ? mapApiNavigationItems(apiNavigation.items)
    : fallbackConfig.items;

  return (
    <>
      {items.map((item, index) => {
        if ('divider' in item) {
          return <SidebarDivider key={index} />;
        }

        if ('children' in item) {
          return (
            <SidebarGroup
              key={item.label}
              label={<Trans i18nKey={item.label} defaults={item.label} />}
              collapsible={item.collapsible}
              collapsed={item.collapsed}
            >
              {item.children.map((child) => {
                return (
                  <SidebarItem
                    key={child.path}
                    end={child.end}
                    path={child.path}
                    Icon={wrapSidebarIcon(child.Icon)}
                  >
                    <Trans i18nKey={child.label} defaults={child.label} />
                  </SidebarItem>
                );
              })}
            </SidebarGroup>
          );
        }

        return (
        <SidebarItem
          key={item.path}
          end={item.end}
          path={item.path}
          Icon={wrapSidebarIcon(item.Icon)}
        >
          <Trans i18nKey={item.label} defaults={item.label} />
        </SidebarItem>
      );
    })}
    </>
  );
}

export default AppSidebarNavigation;

function mapApiNavigationItems(items: ApiNavigationItem[]): NavigationConfigItem[] {
  return items.map((item) => {
    if (item.type === 'divider') {
      return { divider: true };
    }

    if (item.type === 'group') {
      const group: NavigationGroup = {
        label: item.label,
        collapsible: item.collapsible,
        collapsed: item.collapsed,
        children: item.children.map(mapApiNavigationLink),
      };

      return group;
    }

    return mapApiNavigationLink(item);
  });
}

function mapApiNavigationLink(link: ApiNavigationLink): NavigationItemLink {
  return {
    label: link.label,
    path: link.path,
    Icon: createIconRenderer(link.icon),
    end: link.end,
  };
}

function wrapSidebarIcon(
  icon?: (props: { className: string }) => JSX.Element,
): ElementType {
  if (!icon) {
    return () => null;
  }

  const IconComponent = ({ className = '' }: { className?: string }) =>
    createElement(icon, { className });
  IconComponent.displayName = 'IconComponent';
  return IconComponent;
}
