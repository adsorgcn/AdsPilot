interface AdsAccountPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onResetFilters: () => void;
}

export function AdsAccountPagination({
  page,
  totalPages,
  pageSize,
  loading,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
}: AdsAccountPaginationProps) {
  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          className="rounded-md border border-border px-2 py-1 hover:bg-muted"
          onClick={onResetFilters}
        >
          重置筛选
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={loading || page <= 1}
        >
          上一页
        </button>
        <span className="text-xs text-muted-foreground">
          第 {page} / {Math.max(totalPages, 1)} 页
        </span>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50"
          onClick={() =>
            onPageChange(
              Math.min(totalPages > 0 ? totalPages : page + 1, page + 1),
            )
          }
          disabled={loading || (totalPages > 0 && page >= totalPages)}
        >
          下一页
        </button>

        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-md border px-2 py-1 text-xs"
        >
          {[20, 25, 50, 100].map((option) => (
            <option key={option} value={option}>
              每页 {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
