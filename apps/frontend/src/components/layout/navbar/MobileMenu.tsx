/**
 * Mobile Menu Component
 * 移动端菜单
 */

import Link from 'next/link';
import { X } from 'lucide-react';
import classNames from 'clsx';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

import type { AppLink } from './useNavigation';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  links: AppLink[];
  isAuthenticated: boolean;
  pathname: string;
}

function isLinkActive(currentPath: string, linkPath: string): boolean {
  if (linkPath === '/') {
    return currentPath === '/';
  }
  return currentPath.startsWith(linkPath);
}

export function MobileMenu({
  isOpen,
  onClose,
  links,
  isAuthenticated,
  pathname,
}: MobileMenuProps) {
  const { t } = useTranslation('common');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          />

          {/* 菜单面板 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={classNames(
              'fixed right-0 top-0 z-50 h-full w-72',
              'bg-background border-l border-border shadow-2xl',
              'md:hidden',
            )}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="font-semibold text-lg">{t('menu')}</span>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label={t('close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 导航链接 */}
            <nav className="flex flex-col gap-1 p-4">
              {links.map((link) => {
                const IconComponent = link.Icon;
                const active = isLinkActive(pathname, link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className={classNames(
                      'flex items-center gap-3 px-4 py-3 rounded-lg',
                      'text-base font-medium',
                      'transition-colors duration-200',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {IconComponent && <IconComponent className="h-5 w-5" />}
                    <span>{t(link.label)}</span>
                  </Link>
                );
              })}
            </nav>

            {/* 底部操作 */}
            {!isAuthenticated && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background">
                <div className="flex flex-col gap-2">
                  <Link href="/auth" className="w-full">
                    <button className="w-full px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
                      {t('signIn')}
                    </button>
                  </Link>
                  <Link href="/auth" className="w-full">
                    <button className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                      {t('signUp')}
                    </button>
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
