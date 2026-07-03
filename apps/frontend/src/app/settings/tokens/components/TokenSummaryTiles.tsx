"use client";

import { useTranslation } from 'react-i18next';

import Tile from '~/core/ui/Tile';

import type { TokenBalance } from '~/lib/billing';

type Props = {
  balance?: TokenBalance;
  loading?: boolean;
};

function TokenSummaryTiles({ balance, loading }: Props) {
  const { t, i18n } = useTranslation('common');
  const locale = i18n.language;

  const items = [
    {
      label: t('tokens.summary.availableBalance'),
      value: formatNumber(balance?.totalBalance ?? balance?.currentBalance, locale),
      helper: t('tokens.summary.tokenUnit'),
    },
    {
      label: t('tokens.summary.todayConsumption'),
      value: formatNumber(balance?.todayConsumed ?? balance?.totalConsumed, locale),
      helper: t('tokens.summary.tokenUnit'),
    },
    {
      label: t('tokens.summary.monthConsumption'),
      value: formatNumber(balance?.thisMonthConsumed ?? balance?.totalConsumed, locale),
      helper: t('tokens.summary.tokenUnit'),
    },
    {
      label: t('tokens.summary.pendingEstimate'),
      value: formatNumber(balance?.estimatedCostForPending, locale),
      helper: t('tokens.summary.pendingTasks', {
        count: balance?.pendingTasksCount ?? 0,
        formattedCount: formatNumber(balance?.pendingTasksCount, locale),
      }),
    },
  ];

  return (
    <div className={'grid gap-4 md:grid-cols-2 xl:grid-cols-4'} data-testid="token-summary-tiles">
      {items.map((item, index) => (
        <Tile key={item.label} data-testid={`token-tile-${index}`}>
          <Tile.Heading>{item.label}</Tile.Heading>
          <Tile.Body>
            <Tile.Figure data-testid={`token-value-${index}`}>{loading ? '—' : item.value}</Tile.Figure>
            <span className={'text-xs text-muted-foreground'}>{item.helper}</span>
          </Tile.Body>
        </Tile>
      ))}
    </div>
  );
}

export default TokenSummaryTiles;

function formatNumber(value: number | undefined, locale: string, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale, options).format(value ?? 0);
}
