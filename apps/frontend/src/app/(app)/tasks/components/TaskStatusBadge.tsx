'use client';

import { useTranslation } from 'react-i18next';

import Badge from '~/core/ui/Badge';

import type { TaskStatus } from '~/lib/tasks';

const STATUS_COLOR: Record<TaskStatus, React.ComponentProps<typeof Badge>['color']> = {
  pending: 'info',
  running: 'info',
  completed: 'success',
  failed: 'error',
  cancelled: 'normal',
};

type Props = {
  status: TaskStatus;
};

function TaskStatusBadge({ status }: Props) {
  const { t } = useTranslation('common');
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.pending;

  return (
    <Badge color={color} size={'small'}>
      {t(`tasks.status.${status}`)}
    </Badge>
  );
}

export default TaskStatusBadge;
