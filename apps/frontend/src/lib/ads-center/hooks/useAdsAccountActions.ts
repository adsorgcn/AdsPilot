import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import {
  useGetOAuthUrl,
  useSyncAccount,
  useSyncAllAccounts,
  useDisconnectAccount,
} from '../hooks';

export interface UseAdsAccountActionsOptions {
  /** Callback to refresh accounts list */
  onMutate: () => void;

  /** Callback to refresh detail view */
  onMutateDetail?: () => void;

  /** Currently selected account ID */
  detailId?: string | null;

  /** Callback to clear detail selection */
  onClearDetail?: () => void;
}

/**
 * Hook for managing ad account actions
 * Handles connect, sync, disconnect operations with loading states
 */
export function useAdsAccountActions({
  onMutate,
  onMutateDetail,
  detailId,
  onClearDetail,
}: UseAdsAccountActionsOptions) {
  const { t } = useTranslation('common');

  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [syncingAll, setSyncingAll] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const getOAuthUrl = useGetOAuthUrl();
  const syncAccount = useSyncAccount();
  const syncAllAccounts = useSyncAllAccounts();
  const disconnectAccount = useDisconnectAccount();

  /**
   * Connect new ad account via OAuth
   */
  const handleConnect = useCallback(async () => {
    try {
      setConnecting(true);
      const url = await getOAuthUrl();
      if (url) {
        window.location.href = url;
      } else {
        toast.error(t('adsCenter.oauthUrlNotFound'));
      }
    } catch (error) {
      console.error(error);
      toast.error(t('adsCenter.oauthFailed'));
    } finally {
      setConnecting(false);
    }
  }, [getOAuthUrl, t]);

  /**
   * Sync all connected accounts
   */
  const handleSyncAll = useCallback(async () => {
    try {
      setSyncingAll(true);
      const result = await syncAllAccounts();
      toast.success(
        t('adsCenter.syncTaskSubmitted', { count: result.syncedCount ?? 0 }),
      );
      await onMutate();
      if (detailId && onMutateDetail) {
        await onMutateDetail();
      }
    } catch (error) {
      console.error(error);
      toast.error(t('adsCenter.syncFailed'));
    } finally {
      setSyncingAll(false);
    }
  }, [syncAllAccounts, onMutate, onMutateDetail, detailId, t]);

  /**
   * Sync specific account
   */
  const handleSyncAccount = useCallback(
    async (accountId: string) => {
      setPendingIds((prev) => new Set(prev).add(accountId));

      try {
        await syncAccount(accountId);
        toast.success(t('adsCenter.syncTaskQueued'));
        await onMutate();
        if (detailId === accountId && onMutateDetail) {
          await onMutateDetail();
        }
      } catch (error) {
        console.error(error);
        toast.error(t('adsCenter.syncFailed'));
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(accountId);
          return next;
        });
      }
    },
    [syncAccount, onMutate, onMutateDetail, detailId, t],
  );

  /**
   * Disconnect account with confirmation
   */
  const handleDisconnect = useCallback(
    async (accountId: string) => {
      if (!window.confirm(t('adsCenter.confirmDisconnect'))) {
        return;
      }

      setPendingIds((prev) => new Set(prev).add(accountId));

      try {
        await disconnectAccount(accountId);
        toast.success(t('adsCenter.disconnectSuccess'));
        await onMutate();
        if (detailId === accountId && onClearDetail) {
          onClearDetail();
        }
      } catch (error) {
        console.error(error);
        toast.error(t('adsCenter.disconnectFailed'));
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(accountId);
          return next;
        });
      }
    },
    [disconnectAccount, onMutate, detailId, onClearDetail, t],
  );

  return {
    // States
    pendingIds,
    syncingAll,
    connecting,

    // Actions
    handleConnect,
    handleSyncAll,
    handleSyncAccount,
    handleDisconnect,
  };
}
