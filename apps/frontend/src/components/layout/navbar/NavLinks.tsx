/**
 * Navigation Links Component
 * 渲染导航链接列表
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classNames from 'clsx';
import { useTranslation } from 'react-i18next';

import type { AppLink } from './useNavigation';

interface NavLinksProps {
  links: AppLink[];
  className?: string;
}

/**
 * 判断链接是否处于活动状态
 */
function isLinkActive(currentPath: string, linkPath: string): boolean {
  if (linkPath === '/') {
    return currentPath === '/';
  }
  return currentPath.startsWith(linkPath);
}

export function NavLinks({ links, className }: NavLinksProps) {
  const { t } = useTranslation('common');
  const pathname = usePathname();

  return (
    <div className={classNames('flex items-center gap-1', className)}>
      {links.map((link) => {
        const IconComponent = link.Icon;
        const active = isLinkActive(pathname, link.href);

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
            {active && (
              <span
                className={classNames(
                  'absolute bottom-0 left-1/2 -translate-x-1/2',
                  'h-0.5 w-6 bg-primary rounded-full',
                )}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
