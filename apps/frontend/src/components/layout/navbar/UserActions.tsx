/**
 * User Actions Component
 * 用户操作区域(通知、语言切换、暗色模式、用户菜单)
 */

import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import Button from '~/core/ui/Button';
import DarkModeToggle from '~/components/DarkModeToggle';
import ProfileDropdown from '~/components/ProfileDropdown';
import LanguageSwitcher from '~/components/LanguageSwitcher';
import NotificationsPopover from '~/components/NotificationsPopover';

interface UserActionsProps {
  isAuthenticated: boolean;
  session: any;
}

export function UserActions({ isAuthenticated, session }: UserActionsProps) {
  const { t } = useTranslation('common');

  const handleSignOut = () => {
    window.location.href = '/auth/sign-out';
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <LanguageSwitcher variant="icon" />
        <DarkModeToggle />
        <Link href="/auth">
          <Button size="sm" variant="outline">
            {t('signIn')}
          </Button>
        </Link>
        <Link href="/auth">
          <Button size="sm">{t('signUp')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <NotificationsPopover />
      <LanguageSwitcher variant="icon" />
      <DarkModeToggle />
      <ProfileDropdown userSession={session} signOutRequested={handleSignOut} />
    </div>
  );
}
