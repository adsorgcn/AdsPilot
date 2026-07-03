/**
 * Mobile Nav Item Component
 * 移动端导航项组件
 */

import Link from 'next/link';
import classNames from 'clsx';

import type { MobileItem } from './types';
import { ensureAbsolutePath } from './utils';

interface MobileNavItemProps {
  item: MobileItem;
  pathname: string;
}

export function MobileNavItem({ item, pathname }: MobileNavItemProps) {
  const href = ensureAbsolutePath(item.href);
  const active =
    item.match?.(pathname, href) ??
    (pathname === href || pathname.startsWith(`${href}/`));

  const Icon = item.icon;

  return (
    <Link
      key={item.key}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={classNames(
        'flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition',
        active
          ? 'text-primary-600 dark:text-primary-300'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon
        className={classNames('h-5 w-5', {
          'text-primary-600 dark:text-primary-300': active,
        })}
      />
      <span>{item.label}</span>
    </Link>
  );
}
