import { useCallback } from 'react';
import { toast } from 'sonner';

import { useCreateOffer, useDeleteOffer, useToggleOfferFavorite, useUpdateOfferStatus } from './useOfferActions';
import { useEvaluateOffer } from './useOfferEvaluation';

export interface UseOfferActionsOptions {
  onMutate?: () => void;
  onOptimisticMutate?: () => void;
  canUseAI?: boolean;
  subscriptionLoading?: boolean;
  onAddPendingActionId?: (id: string) => void;
  onRemovePendingActionId?: (id: string) => void;
}

/**
 * Composite hook for offer actions
 * Combines create, delete, favorite, status, and evaluation actions
 */
export function useOfferActions(options: UseOfferActionsOptions = {}) {
  const {
    onMutate,
    onOptimisticMutate,
    canUseAI = false,
    subscriptionLoading = false,
    onAddPendingActionId,
    onRemovePendingActionId,
  } = options;

  const createOffer = useCreateOffer();
  const deleteOffer = useDeleteOffer();
  const toggleFavorite = useToggleOfferFavorite();
  const updateStatus = useUpdateOfferStatus();
  const evaluateOffer = useEvaluateOffer();

  const handleCreate = useCallback(
    async (payload: { url: string; country?: string }) => {
      try {
        await createOffer(payload);
        toast.success('Offer created successfully');
        onMutate?.();
      } catch (error) {
        console.error('Failed to create offer:', error);
        toast.error('Failed to create offer');
        throw error;
      }
    },
    [createOffer, onMutate],
  );

  const handleDelete = useCallback(
    (offer: { id: string }) => {
      const id = offer.id;
      onAddPendingActionId?.(id);
      deleteOffer(id)
        .then(() => {
          toast.success('Offer deleted successfully');
          onMutate?.();
        })
        .catch((error) => {
          console.error('Failed to delete offer:', error);
          toast.error('Failed to delete offer');
        })
        .finally(() => {
          onRemovePendingActionId?.(id);
        });
    },
    [deleteOffer, onMutate, onAddPendingActionId, onRemovePendingActionId],
  );

  const handleToggleFavorite = useCallback(
    (offer: { id: string }, favorite: boolean) => {
      const id = offer.id;
      // Optimistic update
      onOptimisticMutate?.();
      toggleFavorite(id, favorite)
        .then(() => {
          onMutate?.();
        })
        .catch((error) => {
          console.error('Failed to toggle favorite:', error);
          toast.error('Failed to update favorite status');
          // Revert on error
          onMutate?.();
        });
    },
    [toggleFavorite, onMutate, onOptimisticMutate],
  );

  const handleUpdateStatus = useCallback(
    (offer: { id: string }, status: 'deployed' | 'archived') => {
      const id = offer.id;
      onAddPendingActionId?.(id);
      updateStatus(id, status)
        .then(() => {
          toast.success(`Offer ${status} successfully`);
          onMutate?.();
        })
        .catch((error) => {
          console.error('Failed to update status:', error);
          toast.error('Failed to update status');
        })
        .finally(() => {
          onRemovePendingActionId?.(id);
        });
    },
    [updateStatus, onMutate, onAddPendingActionId, onRemovePendingActionId],
  );

  const handleEvaluate = useCallback(
    (offer: { id: string }) => {
      if (subscriptionLoading) {
        toast.info('Loading subscription info...');
        return;
      }

      if (!canUseAI) {
        toast.error('AI evaluation requires Elite subscription');
        return;
      }

      const id = offer.id;
      onAddPendingActionId?.(id);
      toast.info('Starting evaluation...');
      evaluateOffer(id)
        .then(() => {
          toast.success('Evaluation started');
          onMutate?.();
        })
        .catch((error) => {
          console.error('Failed to evaluate offer:', error);
          toast.error('Failed to start evaluation');
        })
        .finally(() => {
          onRemovePendingActionId?.(id);
        });
    },
    [evaluateOffer, canUseAI, subscriptionLoading, onMutate, onAddPendingActionId, onRemovePendingActionId],
  );

  return {
    handleCreate,
    handleDelete,
    handleToggleFavorite,
    handleUpdateStatus,
    handleEvaluate,
  };
}
