import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import { batchArchiveOffers } from '~/lib/api/console';
import { exportToCsv } from '~/lib/utils/csv-export';
import type { Offer } from '~/lib/api/types/console';

import {
  formatDateValue,
  formatDomainValue,
  formatNumericValue,
} from '../utils/formatters';

export type Filters = {
  status: string;
  search: string;
  minScore: string;
  maxScore: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
};

export const INITIAL_FILTERS: Filters = {
  status: '',
  search: '',
  minScore: '',
  maxScore: '',
  sortBy: 'created_at',
  sortOrder: 'desc',
};

/**
 * Offer管理页面状态和操作
 */
export function useOfferManagement(
  offers: Offer[],
  mutate: () => Promise<void>,
) {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const handleBatchArchive = useCallback(() => {
    if (selectedOffers.length === 0) {
      toast.error('请选择需要归档的 Offer');
      return;
    }
    setShowArchiveDialog(true);
  }, [selectedOffers.length]);

  const handleConfirmArchive = useCallback(
    async (values: Record<string, string>) => {
      try {
        await batchArchiveOffers({
          offerIds: selectedOffers,
          reason: values.reason,
        });
        toast.success(`已归档 ${selectedOffers.length} 个 Offer`);
        setSelectedOffers([]);
        await mutate();
      } catch (err) {
        toast.error(
          `归档失败：${err instanceof Error ? err.message : '未知错误'}`,
        );
        throw err;
      }
    },
    [selectedOffers, mutate],
  );

  const handleExportCsv = useCallback(() => {
    try {
      exportToCsv(
        offers,
        [
          { key: 'name', label: 'Offer Name' },
          {
            key: 'originalUrl',
            label: 'Domain',
            format: formatDomainValue,
          },
          { key: 'status', label: 'Status' },
          {
            key: 'siterankScore',
            label: 'Score',
            format: (value) => formatNumericValue(value, 1, 'N/A'),
          },
          {
            key: 'totalRevenue',
            label: 'Revenue',
            format: (value) => formatNumericValue(value, 2, '0.00'),
          },
          { key: 'createdAt', label: 'Created', format: formatDateValue },
        ],
        `offers-${new Date().toISOString().split('T')[0]}.csv`,
      );
      toast.success(`已导出 ${offers.length} 条记录`);
    } catch (err) {
      toast.error(
        `导出失败：${err instanceof Error ? err.message : '未知错误'}`,
      );
    }
  }, [offers]);

  const toggleSelection = useCallback((offerId: string, checked: boolean) => {
    setSelectedOffers((prev) =>
      checked
        ? Array.from(new Set([...prev, offerId]))
        : prev.filter((id) => id !== offerId),
    );
  }, []);

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedOffers(offers.map((offer) => offer.id));
      } else {
        setSelectedOffers([]);
      }
    },
    [offers],
  );

  return {
    filters,
    setFilters,
    selectedOffers,
    showArchiveDialog,
    setShowArchiveDialog,
    handleBatchArchive,
    handleConfirmArchive,
    handleExportCsv,
    toggleSelection,
    toggleSelectAll,
  };
}
