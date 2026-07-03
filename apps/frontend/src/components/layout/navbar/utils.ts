/**
 * Navbar Utilities
 */

import type { ComponentType } from 'react';
import { createIconRenderer } from '~/components/icons';
import type {
  NavigationItem as ApiNavigationItem,
  NavigationLink as ApiNavigationLink,
} from '~/lib/navigation/types';
import type { AppLink } from './types';

/**
 * 检查路径是否激活
 */
export function isActive(currentPath: string, linkPath: string): boolean {
  if (linkPath === '/') {
    return currentPath === '/';
  }
  return currentPath.startsWith(linkPath);
}

/**
 * 确保路径是绝对路径
 */
export function ensureAbsolutePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * 包装图标组件
 */
export function wrapIconComponent(
  Icon?: ComponentType<{ className?: string }> | string,
): ComponentType<{ className?: string }> | undefined {
  if (!Icon) {
    return undefined;
  }

  if (typeof Icon === 'string') {
    const Renderer = createIconRenderer(Icon as import('~/components/icons').IconName);
    return (props: { className?: string }) => Renderer({ className: props.className ?? '' });
  }

  return Icon;
}

/**
 * 限制应用链接数量(最多显示5个)
 */
export function limitAppLinks(links: AppLink[]): AppLink[] {
  return links.slice(0, 5);
}

/**
 * 映射API导航到应用链接
 */
export function mapApiNavigationToAppLinks(items: ApiNavigationItem[]): AppLink[] {
  const links: AppLink[] = [];

  for (const item of items) {
    if (item.type === 'link') {
      const link = item as ApiNavigationLink;
      links.push({
        label: link.label,
        href: ensureAbsolutePath(link.path),
        Icon: wrapIconComponent(link.icon),
      });
    }
  }

  return limitAppLinks(links);
}
