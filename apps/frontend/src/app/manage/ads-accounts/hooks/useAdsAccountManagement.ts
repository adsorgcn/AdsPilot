import { useMemo, useState, useEffect, useCallback } from 'react';

import type { AdsAccountAdmin } from '~/lib/api/types/console';
import { useConsoleAdsAccounts } from '~/lib/admin/resources/ads-accounts';
import { useDebounce } from '~/hooks/useDebounce';

import { exportAdsAccountsToCsv } from '../utils/ads-account-export';
import {
  useAdsAccountFiltering,
  type PerformanceFilter,
  type SyncFilter,
} from './useAdsAccountFiltering';

export function useAdsAccountManagement() {
  const [filters, setFilters] = useState({
    status: '',
    provider: '',
    search: '',
  });
  const [performanceFilter, setPerformanceFilter] =
    useState<PerformanceFilter>('all');
  const [syncFilter, setSyncFilter] = useState<SyncFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedAccount, setSelectedAccount] =
    useState<AdsAccountAdmin | null>(null);

  const debouncedSearch = useDebounce(filters.search, 300);

  const query = useMemo(
    () => ({
      status: filters.status || undefined,
      provider: filters.provider || undefined,
      userId: debouncedSearch || undefined,
      sortBy: 'created_at' as const,
      sortOrder: 'desc' as const,
      limit: pageSize,
      page,
    }),
    [filters.status, filters.provider, debouncedSearch, page, pageSize],
  );

  const { data, error, isLoading, isFetching } =
    useConsoleAdsAccounts(query);

  const accounts = useMemo<AdsAccountAdmin[]>(
    () => data?.items ?? [],
    [data?.items],
  );

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [
    filters.status,
    filters.provider,
    debouncedSearch,
    performanceFilter,
    syncFilter,
  ]);

  // Reset to page 1 when page size changes
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  // Adjust page if out of bounds
  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  // 使用过滤hook
  const filteredAccounts = useAdsAccountFiltering(
    accounts,
    performanceFilter,
    syncFilter,
  );

  const loading = isLoading && !data;
  const isRefreshing = isFetching && !!data;

  const scrollKey = useMemo(
    () =>
      [
        page,
        pageSize,
        filters.status,
        filters.provider,
        debouncedSearch,
        performanceFilter,
        syncFilter,
      ].join('|'),
    [
      page,
      pageSize,
      filters.status,
      filters.provider,
      debouncedSearch,
      performanceFilter,
      syncFilter,
    ],
  );

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : 'Failed to load accounts'
    : null;

  const handleExportCsv = useCallback(() => {
    const exportSource = filteredAccounts.length
      ? filteredAccounts
      : accounts;
    exportAdsAccountsToCsv(exportSource);
  }, [filteredAccounts, accounts]);

  const handleResetFilters = useCallback(() => {
    setFilters({ status: '', provider: '', search: '' });
    setPerformanceFilter('all');
    setSyncFilter('all');
  }, []);

  return {
    filters,
    setFilters,
    performanceFilter,
    setPerformanceFilter,
    syncFilter,
    setSyncFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    selectedAccount,
    setSelectedAccount,
    accounts,
    filteredAccounts,
    total,
    totalPages,
    loading,
    isRefreshing,
    scrollKey,
    errorMessage,
    handleExportCsv,
    handleResetFilters,
  };
}
