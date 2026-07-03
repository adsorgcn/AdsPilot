/**
 * Navbar Component
 * 主导航栏组件 - 仅负责组装子组件
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import classNames from 'clsx';

import configuration from '~/configuration';
import { useNavigation } from './useNavigation';
import { NavLinks } from './NavLinks';
import { UserActions } from './UserActions';
import { MobileMenu } from './MobileMenu';

export default function Navbar() {
  const {
    t,
    pathname,
    session,
    isAuthenticated,
    currentLinks,
    mobileOpen,
    setMobileOpen,
  } = useNavigation();

  return (
    <>
      <nav
        className={classNames(
          'sticky top-0 z-50',
          'h-14',
          'border-b border-border/40',
          'bg-background/60 backdrop-blur-xl backdrop-saturate-150',
          'supports-[backdrop-filter]:bg-background/60',
          'shadow-[0_1px_0_0_rgba(0,0,0,0.03)]',
          'dark:shadow-[0_1px_0_0_rgba(255,255,255,0.03)]',
          'transition-all duration-300',
        )}
        role="navigation"
        aria-label={t('mainNavigation')}
      >
        <div className="layout-container flex h-full items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/assets/images/favicon/logo.png"
              alt={configuration.site.siteName}
              width={1954}
              height={116}
              sizes="(max-width: 768px) 112px, 128px"
              className={classNames(
                'h-auto w-28 sm:w-32',
                'transition-transform duration-200',
                'group-hover:scale-105',
              )}
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <NavLinks links={currentLinks} className="hidden md:flex" />

          {/* User Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <UserActions isAuthenticated={isAuthenticated} session={session} />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={classNames(
                'md:hidden p-2 rounded-lg',
                'text-foreground/70 hover:text-foreground hover:bg-muted',
                'transition-colors duration-200',
              )}
              aria-label={t('menu')}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        links={currentLinks}
        isAuthenticated={isAuthenticated}
        pathname={pathname}
      />
    </>
  );
}
