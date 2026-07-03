'use client';

import Link from 'next/link';
import { getI18n } from 'react-i18next';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';

import SimpleDataTable, { type Column } from '~/core/ui/SimpleDataTable';
import { Avatar, AvatarFallback, AvatarImage } from '~/core/ui/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';

import IconButton from '~/core/ui/IconButton';
import Badge from '~/core/ui/Badge';
import If from '~/core/ui/If';

export type AdminUserRow = {
  id: string;
  email?: string;
  phone?: string;
  displayName?: string;
  photoUrl?: string;
  createdAt: string;
  lastSignInAt?: string;
  role?: string;
  isBanned?: boolean;
  tokenBalance?: number | null;
  planName?: string | null;
};

const columns: Array<Column<AdminUserRow>> = [
  {
    header: '',
    id: 'avatar',
    size: 10,
    cell: (user) => {
      const displayText =
        user.displayName ?? user.email ?? user.phone ?? user.id;

      return (
        <Tooltip>
          <TooltipTrigger>
            <Avatar>
              {user.photoUrl ? <AvatarImage src={user.photoUrl} /> : null}
              <AvatarFallback>{displayText[0]}</AvatarFallback>
            </Avatar>
          </TooltipTrigger>

          <TooltipContent>{displayText}</TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    header: 'ID',
    id: 'id',
    size: 30,
    cell: (user) => {
      const id = user.id;

      return (
        <Link className={'hover:underline'} href={`/admin/users/${id}`}>
          {id}
        </Link>
      );
    },
  },
  {
    header: 'Email',
    id: 'email',
    cell: (user) => {
      const email = user.email;

      return (
        <span title={email} className={'truncate max-w-full block'}>
          {email ?? '—'}
        </span>
      );
    },
  },
  {
    header: 'Name',
    size: 50,
    id: 'displayName',
    cell: (user) => {
      return user.displayName ?? '—';
    },
  },
  {
    header: 'Created at',
    id: 'createdAt',
    cell: (user) => {
      const date = new Date(user.createdAt);
      const i18n = getI18n();
      const language = i18n.language ?? 'en';
      const createdAtLabel = date.toLocaleDateString(language);

      return <span suppressHydrationWarning>{createdAtLabel}</span>;
    },
  },
  {
    header: 'Last sign in',
    id: 'lastSignInAt',
    cell: (user) => {
      const lastSignInAt = user.lastSignInAt;

      if (!lastSignInAt) {
        return <span>—</span>;
      }

      const date = new Date(lastSignInAt);
      return <span suppressHydrationWarning>{date.toLocaleString()}</span>;
    },
  },
  {
    header: 'Status',
    id: 'status',
    cell: (user) => {
      if (!user.isBanned) {
        return (
          <Badge size={'small'} className={'inline-flex'} color={'success'}>
            Active
          </Badge>
        );
      }

      return (
        <Badge size={'small'} className={'inline-flex'} color={'error'}>
          Banned
        </Badge>
      );
    },
  },
  {
    header: '',
    id: 'actions',
    cell: (user) => {
      const isBanned = user.isBanned ?? false;

      return (
        <div className={'flex justify-end'}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton>
                <span className="sr-only">Open menu</span>
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(user.id)}
              >
                Copy user ID
              </DropdownMenuItem>

              <If condition={!isBanned}>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/users/${user.id}/impersonate`}>
                    Impersonate User
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    className={
                      'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/5'
                    }
                    href={`/admin/users/${user.id}/ban`}
                  >
                    Ban User
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    className={
                      'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/5'
                    }
                    href={`/admin/users/${user.id}/delete`}
                  >
                    Delete User
                  </Link>
                </DropdownMenuItem>
              </If>

              <If condition={isBanned}>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/users/${user.id}/reactivate`}>
                    Reactivate User
                  </Link>
                </DropdownMenuItem>
              </If>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

function UsersTable({
  users,
  page,
  pageCount,
  perPage,
}: React.PropsWithChildren<{
  users: AdminUserRow[];
  pageCount: number;
  page: number;
  perPage: number;
}>) {
  return (
    <SimpleDataTable
      tableProps={{
        'data-cy': 'admin-users-table',
      } as React.HTMLAttributes<HTMLTableElement>}
      pageIndex={page - 1}
      pageSize={perPage}
      pageCount={pageCount}
      data={users}
      columns={columns}
    />
  );
}

export default UsersTable;

