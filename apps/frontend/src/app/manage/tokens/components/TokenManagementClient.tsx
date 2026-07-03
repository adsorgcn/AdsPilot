'use client';

import { useMemo, useState } from 'react';
import { MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import Button from '~/core/ui/Button';
import {
  ResourceEmptyState,
  ResourceErrorState,
  ResourceTableSkeleton,
} from '~/core/ui/ResourceState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import { useConsoleTokenBalances } from '~/lib/admin/resources/tokens';

export default function TokenManagementClient() {
  const { t, i18n } = useTranslation('admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParam, setSearchParam] = useState<string | undefined>(undefined);

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useConsoleTokenBalances({
    page: 1,
    pageSize: 20,
    search: searchParam,
  });

  const balances = data?.items ?? [];
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [i18n.language],
  );

  const handleSearch = () => {
    const query = searchQuery.trim();
    setSearchParam(query.length ? query : undefined);
  };

  if (error) {
    return (
      <ResourceErrorState
        title={t('tokens.management.errorTitle')}
        description={t('tokens.management.errorDescription')}
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <input
          type="text"
          placeholder={t('tokens.management.searchPlaceholder')}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSearch();
            }
          }}
          className="flex-1 rounded-md border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery('');
              setSearchParam(undefined);
            }}
            disabled={isLoading && !balances.length}
          >
            {t('tokens.management.reset')}
          </Button>

          <Button
            onClick={() => {
              handleSearch();
            }}
            disabled={isLoading && !balances.length}
          >
            {isLoading && !balances.length
              ? t('tokens.management.searching')
              : t('tokens.management.search')}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tokens.management.table.user')}</TableHead>
              <TableHead>{t('tokens.management.table.email')}</TableHead>
              <TableHead>{t('tokens.management.table.balance')}</TableHead>
              <TableHead>{t('tokens.management.table.lastTransaction')}</TableHead>
              <TableHead className="text-right">{t('tokens.management.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && !balances.length ? (
              <ResourceTableSkeleton rows={5} columns={5} />
            ) : balances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <ResourceEmptyState
                    title={t('tokens.management.emptyTitle')}
                    description={t('tokens.management.emptyDescription')}
                    secondaryAction={{
                      label: t('tokens.management.emptyRefresh'),
                      variant: 'outline',
                      onClick: () => {
                        void refetch();
                      },
                    }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              balances.map((item: any) => (
                <TableRow key={item.userId} className="align-middle">
                  <TableCell className="text-sm font-medium text-foreground">
                    {item.userId}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.userEmail ?? '--'}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-foreground">
                    {t('tokens.management.table.balanceValue', {
                      amount: numberFormatter.format(item.balance),
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.lastTransaction
                      ? dateTimeFormatter.format(new Date(item.lastTransaction))
                      : t('tokens.management.table.noTransaction')}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost">
                        <PlusIcon className="mr-2 h-4 w-4" />
                        {t('tokens.management.actions.topUp')}
                      </Button>
                      <Button size="sm" variant="ghost">
                        <MinusIcon className="mr-2 h-4 w-4" />
                        {t('tokens.management.actions.deduct')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
