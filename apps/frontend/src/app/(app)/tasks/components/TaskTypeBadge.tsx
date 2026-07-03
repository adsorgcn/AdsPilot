'use client';

import { useTranslation } from 'react-i18next';

import Badge from '~/core/ui/Badge';

import type { TaskType } from '~/lib/tasks';

const TYPE_COLOR: Record<TaskType, React.ComponentProps<typeof Badge>['color']> = {
  evaluation: 'info',
  click_task: 'info',
  deployment: 'success',
  sync: 'info',
  other: 'normal',
};

type Props = {
  type: TaskType;
};

function TaskTypeBadge({ type }: Props) {
  const { t } = useTranslation('common');
  const color = TYPE_COLOR[type] ?? TYPE_COLOR.other;

  return (
    <Badge color={color} size={'small'}>
      {t(`tasks.type.${type}`)}
    </Badge>
  );
}

export default TaskTypeBadge;
