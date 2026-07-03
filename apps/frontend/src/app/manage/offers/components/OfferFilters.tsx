import type { Filters } from '../hooks/useOfferManagement';

interface OfferFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function OfferFilters({ filters, onChange }: OfferFiltersProps) {
  return (
    <>
      <select
        value={filters.status}
        onChange={(event) =>
          onChange({ ...filters, status: event.target.value })
        }
        className="rounded-md border px-4 py-2 text-sm"
      >
        <option value="">All Status</option>
        <option value="pending_evaluation">Pending Evaluation</option>
        <option value="deployable">Deployable</option>
        <option value="deployed">Deployed</option>
        <option value="archived">Archived</option>
      </select>

      <input
        type="number"
        placeholder="Min Score"
        value={filters.minScore}
        onChange={(event) =>
          onChange({ ...filters, minScore: event.target.value })
        }
        className="rounded-md border px-4 py-2 text-sm"
      />

      <input
        type="number"
        placeholder="Max Score"
        value={filters.maxScore}
        onChange={(event) =>
          onChange({ ...filters, maxScore: event.target.value })
        }
        className="rounded-md border px-4 py-2 text-sm"
      />

      <select
        value={filters.sortBy}
        onChange={(event) =>
          onChange({ ...filters, sortBy: event.target.value })
        }
        className="rounded-md border px-4 py-2 text-sm"
      >
        <option value="created_at">Created At</option>
        <option value="siterank_score">Score</option>
        <option value="total_revenue">Revenue</option>
        <option value="updated_at">Updated At</option>
      </select>

      <select
        value={filters.sortOrder}
        onChange={(event) =>
          onChange({
            ...filters,
            sortOrder: event.target.value as Filters['sortOrder'],
          })
        }
        className="rounded-md border px-4 py-2 text-sm"
      >
        <option value="desc">Desc</option>
        <option value="asc">Asc</option>
      </select>
    </>
  );
}
