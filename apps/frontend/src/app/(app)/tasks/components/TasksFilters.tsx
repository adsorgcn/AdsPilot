import { useTranslation } from 'react-i18next';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';

import type { StatusFilter } from '../hooks/useTasksPageState';

interface TasksFiltersProps {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  statusOptions: Array<{ value: string; label: string }>;
  taskCount: number;
}

export default function TasksFilters({
  status,
  onStatusChange,
  statusOptions,
  taskCount,
}: TasksFiltersProps) {
  const { t } = useTranslation('common');

  return (
    <div className={'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3'}>
      <div className={'flex items-center gap-3'}>
        <span className={'text-sm text-muted-foreground'}>{t('tasks.statusFilter')}</span>

        <Select
          value={status}
          onValueChange={(value) => onStatusChange(value as StatusFilter)}
        >
          <SelectTrigger className={'w-40'}>
            <SelectValue placeholder={t('tasks.selectStatus')} />
          </SelectTrigger>

          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className={'text-xs text-muted-foreground'}>
        {t('tasks.taskCount', { count: taskCount })}
      </span>
    </div>
  );
}
