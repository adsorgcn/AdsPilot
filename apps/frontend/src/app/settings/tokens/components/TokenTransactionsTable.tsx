"use client";

import { useTranslation } from 'react-i18next';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import Spinner from '~/core/ui/Spinner';

import type { TokenTransaction } from '~/lib/billing';

type Props = {
  transactions: TokenTransaction[];
  loading?: boolean;
};

function TokenTransactionsTable({ transactions, loading }: Props) {
  const { t, i18n } = useTranslation('common');
  const locale = i18n.language;

  if (loading) {
    return (
      <div className={'flex min-h-[200px] items-center justify-center rounded-lg border border-border bg-background'}>
        <Spinner className={'h-6 w-6 text-primary'} />
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <div className={'flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground'}>
        {t('tokens.transactions.empty')}
      </div>
    );
  }

  return (
    <div className={'overflow-hidden rounded-lg border border-border bg-background'}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('tokens.transactions.header.time')}</TableHead>
            <TableHead>{t('tokens.transactions.header.type')}</TableHead>
            <TableHead>{t('tokens.transactions.header.amount')}</TableHead>
            <TableHead className={'hidden lg:table-cell'}>{t('tokens.transactions.header.description')}</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell className={'text-sm text-muted-foreground'}>
                {formatDatetime(transaction.createdAt, locale)}
              </TableCell>
              <TableCell className={'text-sm font-medium text-foreground uppercase tracking-wide'}>
                {transaction.type}
              </TableCell>
              <TableCell className={'text-sm text-foreground'}>
                {formatNumber(transaction.amount, locale)}
              </TableCell>
              <TableCell className={'hidden lg:table-cell text-sm text-muted-foreground'}>
                {transaction.description || t('tokens.transactions.noDescription')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default TokenTransactionsTable;

function formatNumber(value: number | undefined, locale: string) {
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

function formatDatetime(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
