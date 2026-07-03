import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import Button from '~/core/ui/Button';

interface AdsAccountFiltersProps {
  filters: {
    status: string;
    provider: string;
    search: string;
  };
  onFiltersChange: (filters: {
    status: string;
    provider: string;
    search: string;
  }) => void;
  performanceFilter: 'all' | 'high-roas' | 'low-roas' | 'high-spend';
  onPerformanceFilterChange: (
    filter: 'all' | 'high-roas' | 'low-roas' | 'high-spend',
  ) => void;
  syncFilter: 'all' | 'fresh' | 'stale' | 'never';
  onSyncFilterChange: (filter: 'all' | 'fresh' | 'stale' | 'never') => void;
  onExport: () => void;
  isLoading: boolean;
  hasAccounts: boolean;
}

export function AdsAccountFilters({
  filters,
  onFiltersChange,
  performanceFilter,
  onPerformanceFilterChange,
  syncFilter,
  onSyncFilterChange,
  onExport,
  isLoading,
  hasAccounts,
}: AdsAccountFiltersProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
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
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="suspended">Suspended</option>
          <option value="disconnected">Disconnected</option>
        </select>

        <select
          value={filters.provider}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              provider: event.target.value,
            })
          }
          className="rounded-md border px-4 py-2 text-sm"
        >
          <option value="">All Providers</option>
          <option value="google">Google Ads</option>
          <option value="meta">Meta Ads</option>
          <option value="tt">TikTok Ads</option>
        </select>

        <input
          type="text"
          placeholder="Search by user / account..."
          value={filters.search}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              search: event.target.value,
            })
          }
          className="rounded-md border px-4 py-2 text-sm"
        />
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-2 md:flex-none">
        <select
          value={performanceFilter}
          onChange={(event) =>
            onPerformanceFilterChange(
              event.target.value as typeof performanceFilter,
            )
          }
          className="rounded-md border px-4 py-2 text-sm"
        >
          <option value="all">All Performance</option>
          <option value="high-roas">ROAS ≥ 2</option>
          <option value="low-roas">ROAS &lt; 1</option>
          <option value="high-spend">Spend ≥ $1000</option>
        </select>

        <select
          value={syncFilter}
          onChange={(event) =>
            onSyncFilterChange(event.target.value as typeof syncFilter)
          }
          className="rounded-md border px-4 py-2 text-sm"
        >
          <option value="all">All Sync Status</option>
          <option value="fresh">Updated &lt;= 24h</option>
          <option value="stale">Stale &gt; 24h</option>
          <option value="never">Never Synced</option>
        </select>

        <Button
          variant="outline"
          onClick={onExport}
          disabled={isLoading || !hasAccounts}
        >
          <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </div>
  );
}
