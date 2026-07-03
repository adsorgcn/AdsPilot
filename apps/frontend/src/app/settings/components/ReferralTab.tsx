import Button from '~/core/ui/Button';
import { useReferralSummary } from '~/lib/billing';
import { SectionCard } from './SectionCard';
import { StatGrid, type StatItem } from './StatGrid';
import { ListSection } from './ListSection';
import { SimpleList, type SimpleListItem } from './SimpleList';
import { LoadingPlaceholder } from './LoadingPlaceholder';
import Link from 'next/link';

function formatDateTime(input: string | number | Date) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return typeof input === 'string' ? input : '';
  }

  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
}

function buildReferralLink(code: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.autoads.dev';
  return `${base}/auth?ref=${code}`;
}

type ReferralTabProps = {
  summary?: ReturnType<typeof useReferralSummary>['data'];
  isLoading: boolean;
  onCopy: () => void;
  onRefresh: () => void;
};

export function ReferralTab({
  summary,
  isLoading,
  onCopy,
  onRefresh,
}: ReferralTabProps) {
  if (isLoading && !summary) {
    return (
      <SectionCard title="邀请奖励">
        <LoadingPlaceholder message="正在加载邀请信息…" />
      </SectionCard>
    );
  }

  if (!summary) {
    return (
      <SectionCard title="邀请奖励">
        <p className="text-sm text-muted-foreground">暂无法获取邀请信息。</p>
      </SectionCard>
    );
  }

  const referralLink = buildReferralLink(summary.referralCode);
  const stats: StatItem[] = [
    { label: '成功邀请', value: summary.successfulInvites.toString() },
    { label: '累计奖励天数', value: `${summary.totalRewardsDays} 天` },
    { label: '待确认邀请', value: summary.pendingInvites.toString() },
  ];

  const recordItems: SimpleListItem[] = summary.records.map((record) => ({
    id: record.id,
    primary: record.refereeName || '未命名用户',
    secondary: formatDateTime(record.createdAt),
    tag:
      record.status === 'completed'
        ? { label: '已完成', tone: 'success' }
        : { label: '待确认', tone: 'warn' },
  }));

  return (
    <SectionCard
      title="邀请奖励"
      description="邀请新用户开通 Google-Monetize，可额外获得 Token 或套餐天数奖励。"
    >
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold">专属邀请码：{summary.referralCode}</p>
        <p className="mt-1 break-all text-xs text-blue-700">{referralLink}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="small" variant="outline" onClick={onCopy}>
            复制邀请链接
          </Button>
          <Button size="small" variant="ghost" onClick={onRefresh}>
            重新生成
          </Button>
        </div>
      </div>

      <StatGrid items={stats} />

      <ListSection title="邀请记录">
        <SimpleList
          items={recordItems}
          emptyText="还没有邀请记录，邀请好友即可额外获得套餐奖励。"
        />
      </ListSection>

      {/* 查看详情按钮 */}
      <div className="flex justify-center pt-2">
        <Link href="/settings/referral">
          <Button variant="outline" className="w-full">
            查看邀请详情
          </Button>
        </Link>
      </div>
    </SectionCard>
  );
}
