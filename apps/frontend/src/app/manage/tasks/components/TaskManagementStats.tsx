type TaskManagementStatsProps = {
  total: number;
  displayedCount: number;
  summary: {
    running: number;
    pending: number;
    failed: number;
  };
};

export function TaskManagementStats({ total, displayedCount, summary }: TaskManagementStatsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span>总任务 {total}</span>
      <span>当前筛选 {displayedCount}</span>
      <span className="rounded-md border border-border px-2 py-1">
        进行中 {summary.running}
      </span>
      <span className="rounded-md border border-border px-2 py-1">
        待处理 {summary.pending}
      </span>
      <span className="rounded-md border border-border px-2 py-1 text-red-600">
        失败 {summary.failed}
      </span>
    </div>
  );
}
