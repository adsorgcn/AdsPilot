import { useState, useCallback, useEffect } from 'react';
import type { Offer } from '~/lib/offers';
import {
  useOffers,
  useOffersFilters,
  useOffersBulkActions,
  useOfferActions,
} from '~/lib/offers';
import { useUserSubscription } from '~/lib/billing/hooks';

import { useOffersSyncStatus } from './useOffersSyncStatus';

export function useOffersPageState() {
  // Dialog states
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  // Use filters hook
  const filters = useOffersFilters();

  // Fetch offers data from server
  const {
    items,
    total,
    page: currentPage,
    limit: serverLimit,
    totalPages,
    isLoading,
    isValidating,
    error,
    refetch,
  } = useOffers({
    status: filters.status === 'all' ? undefined : filters.status,
    search: filters.debouncedSearchTerm || undefined,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder,
    page,
    limit: pageSize,
  });

  // Get subscription info
  const {
    tier,
    isElite,
    canUseAI,
    isLoading: subscriptionLoading,
  } = useUserSubscription();

  // Use sync status hook
  const { syncStatusMap, tasksLoading } = useOffersSyncStatus();

  // Apply filters hook (client-side filtering)
  const filteredOffers = filters.applyFilters(items);

  // Use bulk actions hook
  const bulkActions = useOffersBulkActions({
    offers: filteredOffers,
    onMutate: refetch,
  });

  // Use individual actions hook
  const offerActions = useOfferActions({
    onMutate: refetch,
    onOptimisticMutate: refetch,
    canUseAI,
    subscriptionLoading,
    onAddPendingActionId: (id: string) => bulkActions.setPendingActionIds(
      (prev: Set<string>) => new Set(prev).add(id)
    ),
    onRemovePendingActionId: (id: string) => bulkActions.setPendingActionIds(
      (prev: Set<string>) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }
    ),
  });

  // Auto-cleanup selection when items change
  useEffect(() => {
    bulkActions.cleanupSelection();
  }, [bulkActions]);

  // Pagination effects
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [
    filters.status,
    filters.evaluationFilter,
    filters.timeRange,
    filters.sortField,
    filters.sortOrder,
    filters.showFavoritesOnly,
    filters.debouncedSearchTerm,
    pageSize,
  ]);

  // Computed values
  const totalCount = total;
  const filteredCount = filteredOffers.length;
  const isInitialLoading = isLoading && totalCount === 0;
  const hasOffers = totalCount > 0;
  const hasFilteredOffers = filteredCount > 0;
  const isRefreshing = !isInitialLoading && (isValidating || tasksLoading);
  const effectiveLimit = serverLimit ?? pageSize;
  const currentPageNumber = currentPage ?? page;
  const totalPagesNumber = totalPages > 0 ? totalPages : 1;
  const selectedCount = bulkActions.selected.size;
  const showBulkBar = selectedCount > 0;

  // Handlers
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const handleSortOrderToggle = useCallback(() => {
    filters.setSortOrder((previous: 'asc' | 'desc') => (previous === 'desc' ? 'asc' : 'desc'));
  }, [filters]);

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (!checked) {
        bulkActions.setSelected(new Set());
        return;
      }

      const next = new Set(filteredOffers.map((offer: Offer) => offer.id));
      bulkActions.setSelected(next);
    },
    [filteredOffers, bulkActions],
  );

  return {
    // Dialog states
    detailId,
    setDetailId,
    isCreateOpen,
    setCreateOpen,

    // Pagination
    page,
    setPage,
    pageSize,
    handlePageSizeChange,

    // Data
    filteredOffers,
    totalCount,
    filteredCount,
    currentPageNumber,
    totalPagesNumber,
    effectiveLimit,
    syncStatusMap,

    // Loading states
    isInitialLoading,
    isLoading,
    isRefreshing,
    error,

    // Flags
    hasOffers,
    hasFilteredOffers,
    showBulkBar,
    isElite,
    canUseAI,
    tier,

    // Actions
    filters,
    bulkActions,
    offerActions,
    selectedCount,
    refetch,

    // Handlers
    handleSortOrderToggle,
    toggleAll,
  };
}
