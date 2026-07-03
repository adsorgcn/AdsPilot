import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

import Button from '~/core/ui/Button';

import { STATUS_OPTIONS, TYPE_OPTIONS, ATTENTION_OPTIONS, type AttentionFilter } from '../hooks/task-filters';

type TaskManagementFiltersProps = {
  filters: {
    type: string;
    status: string;
    search: string;
  };
  attention: AttentionFilter;
  isLoading: boolean;
  hasTasks: boolean;
  onFiltersChange: (filters: { type: string; status: string; search: string }) => void;
  onAttentionChange: (attention: AttentionFilter) => void;
  onExport: () => void;
};

export function TaskManagementFilters({
  filters,
  attention,
  isLoading,
  hasTasks,
  onFiltersChange,
  onAttentionChange,
  onExport,
}: TaskManagementFiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
        <select
          value={filters.type}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              type: event.target.value,
            })
          }
          className="rounded-md border px-4 py-2 text-sm"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              status: event.target.value,
            })
          }
          className="rounded-md border px-4 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={attention}
          onChange={(event) => onAttentionChange(event.target.value as AttentionFilter)}
          className="rounded-md border px-4 py-2 text-sm"
        >
          {ATTENTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-2 md:flex-none">
        <input
          type="text"
          placeholder="按用户或任务 ID 搜索"
          value={filters.search}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              search: event.target.value,
            })
          }
          className="flex-1 rounded-md border px-4 py-2 text-sm"
        />

        <Button variant="outline" onClick={onExport} disabled={isLoading && !hasTasks}>
          <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
          导出 CSV
        </Button>
      </div>
    </div>
  );
}
