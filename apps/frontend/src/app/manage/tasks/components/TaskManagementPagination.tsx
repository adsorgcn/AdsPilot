type TaskManagementPaginationProps = {
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onReset: () => void;
};

export function TaskManagementPagination({
  page,
  pageSize,
  totalPages,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onReset,
}: TaskManagementPaginationProps) {
  return (
    <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1 hover:bg-muted"
          onClick={onReset}
        >
          重置筛选
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={isLoading || page <= 1}
        >
          上一页
        </button>
        <span>
          第 {page} / {Math.max(totalPages, 1)} 页
        </span>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1 disabled:opacity-50"
          onClick={() =>
            onPageChange(
              totalPages > 0 ? Math.min(totalPages, page + 1) : page + 1,
            )
          }
          disabled={isLoading || (totalPages > 0 && page >= totalPages)}
        >
          下一页
        </button>

        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-md border px-2 py-1"
        >
          {[30, 50, 100, 200].map((option) => (
            <option key={option} value={option}>
              每页 {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
