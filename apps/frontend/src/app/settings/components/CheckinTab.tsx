import { CheckCircleIcon } from '@heroicons/react/24/outline';
import Button from '~/core/ui/Button';
import { useCheckinStatus } from '~/lib/billing';
import { SectionCard } from './SectionCard';
import { StatGrid, type StatItem } from './StatGrid';
import { ListSection } from './ListSection';
import { LoadingPlaceholder } from './LoadingPlaceholder';
import Link from 'next/link';

const CALENDAR_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

type CalendarEntry = {
  checkedIn?: boolean;
} | null | undefined;

type CheckinTabProps = {
  status?: ReturnType<typeof useCheckinStatus>['data'];
  isLoading: boolean;
  onCheckin: () => void;
};

export function CheckinTab({ status, isLoading, onCheckin }: CheckinTabProps) {
  const streak = status?.currentStreak ?? status?.streak ?? 0;
  const hasCheckedIn = status?.hasCheckedInToday ?? status?.todayChecked ?? false;
  const nextReward = status?.nextReward ?? 0;

  const stats: StatItem[] = [
    {
      label: '连续签到',
      value: `${streak} 天`,
      highlight: true,
    },
    {
      label: '下次奖励',
      value: `${nextReward} Token`,
    },
    {
      label: '今日状态',
      value: hasCheckedIn ? '已完成' : '待签到',
      badge: hasCheckedIn ? '今日已签' : undefined,
    },
  ];

  const actionButton = (
    <Button
      size="small"
      variant="outline"
      onClick={onCheckin}
      disabled={!status || hasCheckedIn}
    >
      {hasCheckedIn ? '今日已签到' : '立即签到'}
    </Button>
  );

  return (
    <SectionCard
      title="每日签到"
      description="每日签到可获得 Token 奖励，连续签到 7/14/30 天可获得额外加成。"
      actions={status ? actionButton : undefined}
    >
      {isLoading && !status ? (
        <LoadingPlaceholder message="正在加载签到状态…" />
      ) : (
        <>
          <StatGrid items={stats} />
          <ListSection title="最近 7 天签到情况">
            <MiniCalendar calendar={status?.calendar} />
          </ListSection>

          {/* 查看详情按钮 */}
          <div className="flex justify-center pt-2">
            <Link href="/settings/checkin">
              <Button variant="outline" className="w-full">
                查看签到详情
              </Button>
            </Link>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function MiniCalendar({ calendar }: { calendar: CalendarEntry[] | undefined }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CALENDAR_LABELS.map((label, index) => {
        const checked = calendar?.[index]?.checkedIn;
        return (
          <div
            key={label}
            className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl border text-xs ${
              checked
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-border/60 bg-muted/20 text-muted-foreground'
            }`}
          >
            <span className="font-semibold">{label}</span>
            {checked ? (
              <CheckCircleIcon className="mt-1 h-4 w-4" />
            ) : (
              <span className="mt-1 text-[10px]">待签到</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
