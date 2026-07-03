import { useEffect, useMemo, useState, useCallback } from 'react';

import { useConsoleTaskList } from '~/lib/admin/resources/tasks';
import type { Task } from '~/lib/api/types/console';
import { useDebounce } from '~/hooks/useDebounce';

import { matchesAttention, type AttentionFilter } from './task-filters';
import { useTaskActions } from './useTaskActions';
import { exportTasksToCsv } from '../utils/task-export';

export function useTaskManagement() {
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
  });
  const [attention, setAttention] = useState<AttentionFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const debouncedSearch = useDebounce(filters.search, 300);

  const query = useMemo(
    () => ({
      type: filters.type || undefined,
      status: filters.status || undefined,
      userId: debouncedSearch || undefined,
      sortBy: 'created_at' as const,
      sortOrder: 'desc' as const,
      page,
      limit: pageSize,
    }),
    [filters.type, filters.status, debouncedSearch, page, pageSize],
  );

  const { data, error, isLoading, refetch } =
    useConsoleTaskList(query);

  const tasks = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? tasks.length;
  const totalPages = data?.totalPages ?? 1;

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters.type, filters.status, debouncedSearch, attention]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  // Adjust page if out of bounds
  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  // Auto-update detail task when data refreshes
  useEffect(() => {
    if (!detailTask) {
      return;
    }
    const latest = tasks.find((task: Task) => task.id === detailTask.id);
    if (latest && latest !== detailTask) {
      setDetailTask(latest);
    }
  }, [tasks, detailTask]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task: Task) => matchesAttention(task, attention));
  }, [tasks, attention]);

  const summary = useMemo(() => {
    const failed = tasks.filter((task: Task) => task.status === 'failed').length;
    const running = tasks.filter((task: Task) => task.status === 'running').length;
    const pending = tasks.filter((task: Task) => task.status === 'pending').length;
    return { failed, running, pending };
  }, [tasks]);

  const loadingInitial = isLoading && !data;
  const isRefreshing = isLoading && !!data;
  const displayedCount = filteredTasks.length;

  const scrollKey = useMemo(
    () =>
      [
        page,
        pageSize,
        filters.type,
        filters.status,
        debouncedSearch,
        attention,
      ].join('|'),
    [page, pageSize, filters.type, filters.status, debouncedSearch, attention],
  );

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : 'Failed to load tasks'
    : null;

  const handleExport = useCallback(() => {
    const exportSource = filteredTasks.length ? filteredTasks : tasks;
    exportTasksToCsv(exportSource);
  }, [filteredTasks, tasks]);

  const resetFilters = useCallback(() => {
    setFilters({ type: '', status: '', search: '' });
    setAttention('all');
  }, []);

  // Use task actions hook
  const actions = useTaskActions(refetch);

  return {
    // State
    filters,
    attention,
    page,
    pageSize,
    detailTask,

    // Data
    tasks: filteredTasks,
    total,
    totalPages,
    summary,
    displayedCount,
    scrollKey,

    // Loading states
    loadingInitial,
    isLoading,
    isRefreshing,
    error,
    errorMessage,

    // Setters
    setFilters,
    setAttention,
    setPage,
    setPageSize,
    setDetailTask,

    // Actions
    handleExport,
    resetFilters,
    refetch,

    // Task actions (from useTaskActions)
    ...actions,
  };
}
