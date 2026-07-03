import {
  useBillingTokenBalance,
  useTokenTransactions,
} from '~/lib/billing';
import { SectionCard } from './SectionCard';
import { StatGrid, type StatItem } from './StatGrid';
import { ListSection } from './ListSection';
import { SimpleList, type SimpleListItem } from './SimpleList';
import { LoadingPlaceholder } from './LoadingPlaceholder';
import Button from '~/core/ui/Button';
import Link from 'next/link';

const RECENT_TRANSACTION_LIMIT = 5;

function formatNumber(input: number) {
  return input.toLocaleString('zh-CN');
}

function formatDateTime(input: string | number | Date) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return typeof input === 'string' ? input : '';
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
}

type TokensTabProps = {
  balance: ReturnType<typeof useBillingTokenBalance>;
  transactions?: ReturnType<typeof useTokenTransactions>['data'];
};

export function TokensTab({ balance, transactions }: TokensTabProps) {
  const data = balance.data;
  const stats: StatItem[] = [
    {
      label: '可用余额',
      value: formatNumber(
        data?.totalBalance ?? data?.currentBalance ?? data?.balance ?? 0,
      ),
      highlight: true,
    },
    {
      label: '今日消耗',
      value: formatNumber(data?.todayConsumed ?? data?.totalConsumed ?? 0),
    },
    {
      label: '本月消耗',
      value: formatNumber(data?.thisMonthConsumed ?? data?.totalConsumed ?? 0),
    },
  ];

  const transactionItems: SimpleListItem[] = (transactions ?? [])
    .slice(0, RECENT_TRANSACTION_LIMIT)
    .map((txn) => ({
      id: txn.id,
      primary: txn.description || txn.type,
      secondary: txn.createdAt ? formatDateTime(txn.createdAt) : undefined,
      value: `${txn.amount > 0 ? '+' : ''}${txn.amount}`,
      tag:
        txn.amount >= 0
          ? { label: '获得', tone: 'success' }
          : { label: '消耗', tone: 'warn' },
    }));

  return (
    <SectionCard
      title="Token 余额"
      description="Token 用于 AI 评估、批量任务等能力。保持充足余额可以确保评估任务顺利完成。"
    >
      {balance.isLoading && !data ? (
        <LoadingPlaceholder message="正在获取 Token 余额…" />
      ) : (
        <StatGrid items={stats} />
      )}

      <ListSection title="最近交易">
        <SimpleList
          items={transactionItems}
          emptyText="暂无交易记录，启动 AI 落地页评估即可产生消耗明细。"
        />
      </ListSection>

      {/* 查看详情按钮 */}
      <div className="flex justify-center pt-2">
        <Link href="/settings/tokens">
          <Button variant="outline" className="w-full">
            查看详细数据
          </Button>
        </Link>
      </div>
    </SectionCard>
  );
}
