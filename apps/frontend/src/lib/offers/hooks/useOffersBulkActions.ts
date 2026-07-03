import { useCallback, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { Offer } from '../types';
import { useBatchEvaluateOffers, useDeleteOffer } from '../hooks';

export interface UseOffersBulkActionsOptions {
  offers: Offer[];
  onMutate: () => void;
}

/**
 * Offers批量操作Hook
 * 集中管理选择、批量评估、批量删除等操作
 */
export function useOffersBulkActions({
  offers,
  onMutate,
}: UseOffersBulkActionsOptions) {
  const { t } = useTranslation('common');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();

  const batchEvaluate = useBatchEvaluateOffers();
  const deleteOffer = useDeleteOffer();

  // 切换选择
  const toggleSelection = useCallback((offerId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(offerId);
      } else {
        next.delete(offerId);
      }
      return next;
    });
  }, []);

  // 全选/取消全选
  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelected(new Set(offers.map((offer) => offer.id)));
      } else {
        setSelected(new Set());
      }
    },
    [offers],
  );

  // 批量评估
  const handleBulkEvaluate = useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error(t('offers.errors.noOffersSelected'));
      return;
    }

    startBulkTransition(async () => {
      setPendingActionIds(new Set(ids));

      try {
        await batchEvaluate(ids);
        toast.success(
          t('offers.success.batchEvaluateQueued', { count: ids.length }),
        );
        setSelected(new Set());
        setPendingActionIds(new Set());
        onMutate();
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : t('offers.errors.batchEvaluateFailed');
        toast.error(message);
        setPendingActionIds(new Set());
      }
    });
  }, [selected, batchEvaluate, onMutate, t]);

  // 批量删除
  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error(t('offers.errors.noOffersSelected'));
      return;
    }

    if (
      !window.confirm(
        t('offers.confirmations.bulkDelete', { count: ids.length }),
      )
    ) {
      return;
    }

    startBulkTransition(async () => {
      setPendingActionIds(new Set(ids));

      let successCount = 0;
      let failedCount = 0;

      for (const id of ids) {
        try {
          await deleteOffer(id);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete offer ${id}:`, error);
          failedCount++;
        }
      }

      setPendingActionIds(new Set());

      if (successCount > 0) {
        toast.success(
          t('offers.success.bulkDeleteCompleted', {
            success: successCount,
            total: ids.length,
          }),
        );
      }

      if (failedCount > 0) {
        toast.error(
          t('offers.errors.bulkDeletePartialFailed', {
            failed: failedCount,
          }),
        );
      }

      setSelected(new Set());
      onMutate();
    });
  }, [selected, deleteOffer, onMutate, t]);

  // 清除过期选择（当offers列表变化时）
  const cleanupSelection = useCallback(() => {
    const availableIds = new Set(offers.map((offer) => offer.id));
    setSelected((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (availableIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [offers]);

  return {
    selected,
    setSelected,
    pendingActionIds,
    setPendingActionIds,
    isBulkPending,
    toggleSelection,
    toggleSelectAll,
    handleBulkEvaluate,
    handleBulkDelete,
    cleanupSelection,
  };
}
