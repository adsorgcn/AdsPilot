'use client';

import Link from 'next/link';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import classNames from 'clsx';

export type BreadcrumbItem = {
  label: string;
  href?: string;
  Icon?: React.ComponentType<{ className?: string }>;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export default function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={classNames(
        'flex items-center gap-1.5 text-sm text-muted-foreground',
        className
      )}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const IconComponent = item.Icon;

        return (
          <div key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRightIcon className="h-4 w-4 flex-shrink-0" />
            )}

            {item.href && !isLast ? (
              <Link
                href={item.href}
                className={classNames(
                  'flex items-center gap-1.5 transition-colors hover:text-foreground',
                  index === 0 && 'font-medium'
                )}
              >
                {IconComponent && <IconComponent className="h-4 w-4" />}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span
                className={classNames(
                  'flex items-center gap-1.5',
                  isLast ? 'font-medium text-foreground' : '',
                  index === 0 && 'font-medium'
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {IconComponent && <IconComponent className="h-4 w-4" />}
                <span>{item.label}</span>
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// 便捷函数：生成 Dashboard 面包屑
export function createDashboardBreadcrumbs(
  items: Array<{ label: string; href?: string }>
): BreadcrumbItem[] {
  return [
    {
      label: 'Dashboard',
      href: '/dashboard',
      Icon: HomeIcon,
    },
    ...items,
  ];
}

// 便捷函数：生成 Admin 面包屑
export function createAdminBreadcrumbs(
  items: Array<{ label: string; href?: string }>
): BreadcrumbItem[] {
  return [
    {
      label: 'Admin',
      href: '/manage',
      Icon: HomeIcon,
    },
    ...items,
  ];
}
