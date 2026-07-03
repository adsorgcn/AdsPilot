import { useTranslation } from 'react-i18next';

import Tile from '~/core/ui/Tile';

import type { TokenBalance } from '~/lib/tasks';

type Props = {
  balance?: TokenBalance;
  loading?: boolean;
};

function TokenSummary({ balance, loading }: Props) {
  const { t } = useTranslation('common');

  const items = [
    {
      label: t('tasks.tokenSummary.currentBalance'),
      value: formatNumber(balance?.totalBalance ?? balance?.currentBalance ?? 0),
      helper: t('tasks.tokenSummary.tokenUnit'),
    },
    {
      label: t('tasks.tokenSummary.todayConsumed'),
      value: formatNumber(balance?.todayConsumed ?? balance?.totalConsumed ?? 0),
      helper: t('tasks.tokenSummary.tokenUnit'),
    },
    {
      label: t('tasks.tokenSummary.monthConsumed'),
      value: formatNumber(balance?.thisMonthConsumed ?? balance?.totalConsumed ?? 0),
      helper: t('tasks.tokenSummary.tokenUnit'),
    },
    {
      label: t('tasks.tokenSummary.pendingTasks'),
      value: formatNumber(balance?.pendingTasksCount ?? 0),
      helper: t('tasks.tokenSummary.tasksUnit'),
    },
  ];

  return (
    <div className={'grid gap-4 md:grid-cols-2 xl:grid-cols-4'}>
      {items.map((item) => (
        <Tile key={item.label}>
          <Tile.Heading>{item.label}</Tile.Heading>
          <Tile.Body>
            <Tile.Figure>
              {loading ? '—' : item.value}
            </Tile.Figure>
            <span className={'text-xs text-muted-foreground'}>{item.helper}</span>
          </Tile.Body>
        </Tile>
      ))}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export default TokenSummary;
