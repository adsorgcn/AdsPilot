'use client';

import { ResourceEmptyState, ResourceErrorState } from '~/core/ui/ResourceState';
import InputDialog from '~/components/InputDialog';
import ConfirmDialog from '~/components/ConfirmDialog';

import TaskTable from './TaskTable';
import TaskDetailSheet from './TaskDetailSheet';
import { TaskManagementFilters } from './TaskManagementFilters';
import { TaskManagementStats } from './TaskManagementStats';
import { TaskManagementPagination } from './TaskManagementPagination';
import { useTaskManagement } from '../hooks/useTaskManagement';

export default function TaskManagementClient() {
  const {
    filters,
    attention,
    page,
    pageSize,
    detailTask,
    cancelDialogOpen,
    retryDialogOpen,
    pendingActionIds,
    tasks,
    total,
    totalPages,
    summary,
    displayedCount,
    scrollKey,
    loadingInitial,
    isLoading,
    isRefreshing,
    error,
    errorMessage,
    setFilters,
    setAttention,
    setPage,
    setPageSize,
    setDetailTask,
    setCancelDialogOpen,
    setRetryDialogOpen,
    handleExport,
    openCancelDialog,
    openRetryDialog,
    handleCancelTask,
    handleRetryTask,
    resetFilters,
    refetch,
  } = useTaskManagement();

  return (
    <div className="flex flex-col space-y-4">
      {errorMessage ? (
        <ResourceErrorState
          title="任务列表加载失败"
          description="无法获取任务列表，请稍后再试。"
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      <TaskManagementFilters
        filters={filters}
        attention={attention}
        isLoading={isLoading}
        hasTasks={tasks.length > 0}
        onFiltersChange={setFilters}
        onAttentionChange={setAttention}
        onExport={handleExport}
      />

      <TaskManagementStats
        total={total}
        displayedCount={displayedCount}
        summary={summary}
      />

      {!loadingInitial && !tasks.length ? (
        <ResourceEmptyState
          title="暂无任务"
          description="尝试调整筛选条件或稍后查看。"
        />
      ) : (
        <TaskTable
          tasks={tasks}
          isLoading={loadingInitial}
          isRefreshing={isRefreshing}
          onSelect={setDetailTask}
          onCancel={openCancelDialog}
          onRetry={openRetryDialog}
          pendingIds={pendingActionIds}
          scrollKey={scrollKey}
        />
      )}

      <TaskManagementPagination
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        isLoading={isLoading}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onReset={resetFilters}
      />

      <TaskDetailSheet
        task={detailTask}
        open={!!detailTask}
        onOpenChange={(open) => {
          if (!open) {
            setDetailTask(null);
          }
        }}
        onCancelRequest={openCancelDialog}
        onRetryRequest={openRetryDialog}
        pendingIds={pendingActionIds}
      />

      <InputDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="取消任务"
        description="请输入取消原因，该信息将记录在审计日志中。"
        confirmLabel="确认取消"
        fields={[
          {
            name: 'reason',
            label: '取消原因',
            placeholder: '请输入取消原因（至少 10 个字符）',
            required: true,
            minLength: 10,
          },
        ]}
        onConfirm={handleCancelTask}
      />

      <ConfirmDialog
        open={retryDialogOpen}
        onOpenChange={setRetryDialogOpen}
        confirmLabel="重试任务"
        title="确认重试该任务？"
        description="任务将立即重新排队并消耗额外计算资源。"
        onConfirm={handleRetryTask}
      />
    </div>
  );
}
