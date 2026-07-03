/**
 * Mobile Bottom Navigation Component
 * 移动端底部导航栏 - 仅负责组装
 */

'use client';

import { useMobileNavigation } from './useMobileNavigation';
import { MobileNavItem } from './MobileNavItem';

export default function MobileBottomNav() {
  const { t, pathname, isAppRoute, items } = useMobileNavigation();

  if (!isAppRoute) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-sticky border-t border-border bg-background/95 backdrop-blur-brand md:hidden"
      role="navigation"
      aria-label={t('mobileNav.ariaLabel')}
    >
      <div className="grid grid-cols-4">
        {items.map((item) => (
          <MobileNavItem key={item.key} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
