import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import Button from '~/core/ui/Button';
import { useUserSubscription } from '~/lib/billing';
import { SectionCard } from './SectionCard';
import { StatGrid, type StatItem } from './StatGrid';

type Maybe<T> = T | null | undefined;

const SUBSCRIPTION_LINK = '/dashboard/settings/subscription';

type SubscriptionTabProps = {
  subscriptionTier: string;
  data: Maybe<ReturnType<typeof useUserSubscription>['data']>;
};

export function SubscriptionTab({
  subscriptionTier,
  data,
}: SubscriptionTabProps) {
  const statusKey = (data?.status ?? 'trial').toLowerCase();
  const plan = subscriptionTier?.toUpperCase() || 'TRIAL';
  const currentPeriodEnd = data?.currentPeriodEnd
    ? new Date(data.currentPeriodEnd).toLocaleDateString()
    : '—';

  const statusLabelMap: Record<string, string> = {
    trial: '试用中',
    active: '正常',
    past_due: '待续费',
    canceled: '已取消',
    incomplete: '待支付',
  };

  const statusLabel = statusLabelMap[statusKey] ?? statusKey.toUpperCase();
  const stats: StatItem[] = [
    { label: '当前套餐', value: plan },
    { label: '订阅状态', value: statusLabel, badge: statusLabel },
    { label: '有效期至', value: currentPeriodEnd },
  ];

  return (
    <SectionCard
      title="订阅计划"
      description="查看当前套餐与续费时间，升级到 Pro / Elite 解锁更多 AI 协同能力。"
      actions={
        <>
          <Button
            href="/pricing"
            size="small"
            variant="outline"
            className="flex items-center gap-2"
          >
            查看套餐
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </Button>
          <Button
            href={SUBSCRIPTION_LINK}
            size="small"
            variant="ghost"
            className="flex items-center gap-2"
          >
            管理订阅
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </Button>
        </>
      }
    >
      <StatGrid items={stats} />
    </SectionCard>
  );
}
