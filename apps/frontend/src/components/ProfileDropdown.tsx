'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import classNames from 'clsx';
import { useTranslation } from 'react-i18next';

import {
  ArrowLeftOnRectangleIcon,
  BuildingLibraryIcon,
  QuestionMarkCircleIcon,
  EllipsisVerticalIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '~/core/ui/Dropdown';
import Trans from '~/core/ui/Trans';

import ProfileAvatar from '~/components/ProfileAvatar';
import type UserSession from '~/core/session/types/user-session';

import If from '~/core/ui/If';
import GlobalRole from '~/core/session/types/global-role';
import useUser from '~/core/hooks/use-user';

const ProfileDropdown: React.FCC<{
  userSession: Maybe<UserSession>;
  signOutRequested: () => unknown;
  displayName?: boolean;
  className?: string;
}> = ({ userSession, signOutRequested, displayName, className }) => {
  const { t } = useTranslation('common');
  const { data: user } = useUser();

  const signedInAsLabel = useMemo(() => {
    const email = userSession?.auth?.user.email || undefined;
    const phone = userSession?.auth?.user.phone || undefined;

    return email ?? phone;
  }, [userSession]);

  const userDisplayName = userSession?.data?.displayName;

  const isSuperAdmin = useMemo(() => {
    return user?.app_metadata.role === GlobalRole.SuperAdmin;
  }, [user]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('profileDropdown.ariaLabel')}
        data-cy={'profile-dropdown-trigger'}
        className={classNames(
          'flex cursor-pointer focus:outline-none group items-center',
          className,
          {
            ['items-center space-x-2.5 rounded-lg border border-gray-100' +
            ' dark:border-dark-900 p-2 transition-colors' +
            ' hover:bg-gray-50 dark:hover:bg-dark-800/40']: displayName,
          },
        )}
      >
        <ProfileAvatar user={userSession} />

        <If condition={displayName}>
          <div className={'flex flex-col text-left w-full truncate'}>
            <span className={'text-sm truncate'}>{userDisplayName}</span>

            <span
              className={'text-xs text-gray-500 dark:text-gray-400 truncate'}
            >
              {signedInAsLabel}
            </span>
          </div>

          <EllipsisVerticalIcon
            className={'h-8 hidden text-gray-500 group-hover:flex'}
          />
        </If>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={'!min-w-[15rem]'}
        collisionPadding={{ right: 20, left: 20 }}
        sideOffset={20}
      >
        <DropdownMenuItem className={'!h-10 rounded-none'}>
          <div
            className={'flex flex-col justify-start truncate text-left text-xs'}
          >
            <div className={'text-gray-500'}>
              <Trans i18nKey={'common:signedInAs'} />
            </div>

            <div>
              <span className={'block truncate'}>{signedInAsLabel}</span>
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            className={'flex h-full w-full items-center space-x-2'}
            href={'/settings'}
          >
            <UserCircleIcon className={'h-5'} />
            <span>
              <Trans i18nKey={'common:userCenter'} />
            </span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            className={'flex h-full w-full items-center space-x-2'}
            href={'/docs'}
          >
            <QuestionMarkCircleIcon className={'h-5'} />

            <span>
              <Trans i18nKey={'common:documentation'} />
            </span>
          </Link>
        </DropdownMenuItem>

        <If condition={isSuperAdmin}>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link
              className={'flex h-full w-full items-center space-x-2'}
              href={'/manage'}
            >
              <BuildingLibraryIcon className={'h-5'} />
              <span>
                <Trans i18nKey={'common:adminPanel'} />
              </span>
            </Link>
          </DropdownMenuItem>
        </If>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          role={'button'}
          className={'cursor-pointer'}
          onClick={signOutRequested}
        >
          <span className={'flex w-full items-center space-x-2'}>
            <ArrowLeftOnRectangleIcon className={'h-5'} />

            <span>
              <Trans i18nKey={'auth:signOut'} />
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;
