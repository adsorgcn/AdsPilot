import {
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import Button from '~/core/ui/Button';
import { SectionCard } from './SectionCard';
import { StatGrid, type StatItem } from './StatGrid';

const SETTINGS_LINK = '/dashboard/settings/profile';

const PROFILE_FIELDS: Array<{ label: string; key: string }> = [
  { label: '姓名', key: 'displayName' },
  { label: '公司/组织', key: 'company' },
  { label: '角色', key: 'role' },
];

type ProfileTabProps = {
  profile: Record<string, string>;
  email: string;
};

export function ProfileTab({ profile, email }: ProfileTabProps) {
  const stats: StatItem[] = [
    { label: '邮箱', value: email || '—' },
    ...PROFILE_FIELDS.map((field) => ({
      label: field.label,
      value: profile[field.key] || '—',
    })),
  ];

  return (
    <SectionCard
      title="账号概览"
      description="查看基础信息并跳转至设置页面更新个人资料、密码与多因素认证。"
      actions={
        <>
          <Button
            href={SETTINGS_LINK}
            size="small"
            variant="outline"
            className="flex items-center gap-2"
          >
            前往设置
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </Button>
          <Button
            href="/privacy"
            size="small"
            variant="ghost"
            className="flex items-center gap-2"
          >
            隐私政策
            <BookOpenIcon className="h-4 w-4" />
          </Button>
        </>
      }
    >
      <StatGrid items={stats} columns={2} />
    </SectionCard>
  );
}
