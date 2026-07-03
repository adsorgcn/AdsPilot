import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiGet, apiPost } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

export interface BulkOperation {
  id: string;
  action: 'sync' | 'pause' | 'resume' | 'disconnect' | 'evaluate';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  affectedItems: string[];
  results?: any[];
  errors?: string[];
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  createdAt: string;
  completedAt?: string;
  metadata?: Record<string, any>;
}

export interface BulkOperationRequest {
  action: BulkOperation['action'];
  itemIds: string[];
  metadata?: Record<string, any>;
  options?: {
    dryRun?: boolean;
    batchSize?: number;
    concurrency?: number;
  };
}

/**
 * 批量操作管理Hook
 *
 * 提供完整的批量操作功能，包括：
 * - 创建批量操作任务
 * - 监控操作进度
 * - 处理操作结果
 * - 错误处理和重试
 */
export function useBulkOperations() {
  const { t } = useTranslation('common');
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [activeOperation, setActiveOperation] = useState<BulkOperation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 创建新的批量操作
   */
  const createBulkOperation = useCallback(async (
    request: BulkOperationRequest
  ): Promise<BulkOperation | null> => {
    try {
      setIsLoading(true);

      const response = await apiPost<{
        operation: BulkOperation;
      }>(API_ENDPOINTS.ADSCENTER.BULK_ACTIONS, {
        action: request.action,
        item_ids: request.itemIds,
        metadata: request.metadata,
        options: request.options,
      });

      const operation = response.operation;

      // 添加到操作列表
      setOperations(prev => [...prev, operation]);

      // 如果不是试运行，设置为活跃操作
      if (!request.options?.dryRun) {
        setActiveOperation(operation);
      }

      toast.success(
        t('adsCenter.bulkOperations.created', 'Bulk operation created successfully'),
        {
          description: t('adsCenter.bulkOperations.createdDesc', '{{count}} items queued for {{action}}', {
            count: request.itemIds.length,
            action: request.action,
          }),
        }
      );

      return operation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      toast.error(
        t('adsCenter.bulkOperations.createFailed', 'Failed to create bulk operation'),
        {
          description: errorMessage,
        }
      );

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  /**
   * 同步多个广告账号
   */
  const bulkSyncAccounts = useCallback(async (
    accountIds: string[],
    options?: { dryRun?: boolean }
  ): Promise<BulkOperation | null> => {
    return createBulkOperation({
      action: 'sync',
      itemIds: accountIds,
      options,
      metadata: {
        source: 'accounts_list',
        initiated_by: 'user_action',
      },
    });
  }, [createBulkOperation]);

  /**
   * 批量评估账号
   */
  const bulkEvaluateAccounts = useCallback(async (
    accountIds: string[],
    options?: { dryRun?: boolean }
  ): Promise<BulkOperation | null> => {
    return createBulkOperation({
      action: 'evaluate',
      itemIds: accountIds,
      options,
      metadata: {
        source: 'accounts_list',
        evaluation_type: 'performance_analysis',
      },
    });
  }, [createBulkOperation]);

  /**
   * 获取操作状态
   */
  const getOperationStatus = useCallback(async (
    operationId: string
  ): Promise<BulkOperation | null> => {
    try {
      const response = await apiGet<{
        operation: BulkOperation;
      }>(API_ENDPOINTS.ADSCENTER.BULK_ACTIONS_(operationId));

      return response.operation;
    } catch (error) {
      console.error('Failed to get operation status:', error);
      return null;
    }
  }, []);

  /**
   * 刷新操作状态
   */
  const refreshOperationStatus = useCallback(async (operationId: string) => {
    const updatedOperation = await getOperationStatus(operationId);

    if (updatedOperation) {
      setOperations(prev =>
        prev.map(op =>
          op.id === operationId ? updatedOperation : op
        )
      );

      // 更新活跃操作
      if (activeOperation?.id === operationId) {
        setActiveOperation(updatedOperation);
      }
    }
  }, [activeOperation, getOperationStatus]);

  /**
   * 取消操作
   */
  const cancelOperation = useCallback(async (operationId: string): Promise<boolean> => {
    try {
      const response = await apiPost<{ success: boolean }>(
        `${API_ENDPOINTS.ADSCENTER.BULK_ACTIONS_(operationId)}/cancel`,
        {}
      );

      if (response.success) {
        setOperations(prev =>
          prev.map(op =>
            op.id === operationId
              ? { ...op, status: 'cancelled' as const }
              : op
          )
        );

        toast.success(
          t('adsCenter.bulkOperations.cancelled', 'Operation cancelled successfully')
        );

        return true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      toast.error(
        t('adsCenter.bulkOperations.cancelFailed', 'Failed to cancel operation'),
        {
          description: errorMessage,
        }
      );
    }

    return false;
  }, [t]);

  /**
   * 回滚操作
   */
  const rollbackOperation = useCallback(async (operationId: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      const response = await apiPost<{ success: boolean }>(
        `${API_ENDPOINTS.ADSCENTER.BULK_ACTIONS_(operationId)}/rollback`,
        {}
      );

      if (response.success) {
        setOperations(prev =>
          prev.map(op =>
            op.id === operationId
              ? { ...op, status: 'pending' as const } // 重置为待处理状态
              : op
          )
        );

        toast.success(
          t('adsCenter.bulkOperations.rollbackStarted', 'Rollback operation started')
        );

        return true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      toast.error(
        t('adsCenter.bulkOperations.rollbackFailed', 'Failed to rollback operation'),
        {
          description: errorMessage,
        }
      );
    } finally {
      setIsLoading(false);
    }

    return false;
  }, [t]);

  /**
   * 清理历史操作
   */
  const cleanupOperations = useCallback((olderThanDays: number = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    setOperations(prev =>
      prev.filter(op => new Date(op.createdAt) > cutoffDate)
    );
  }, []);

  /**
   * 获取操作报告
   */
  const getOperationReport = useCallback(async (operationId: string) => {
    try {
      const response = await apiGet<{
        report: {
          operation: BulkOperation;
          details: any[];
          summary: {
            total_processed: number;
            successful: number;
            failed: number;
            duration_seconds: number;
            errors: string[];
          };
        };
      }>(API_ENDPOINTS.ADSCENTER.BULK_ACTIONS__REPORT(operationId));

      return response.report;
    } catch (error) {
      console.error('Failed to get operation report:', error);
      return null;
    }
  }, []);

  // 自动刷新活跃操作状态
  useState(() => {
    let interval: NodeJS.Timeout;

    if (activeOperation && activeOperation.status === 'in_progress') {
      interval = setInterval(() => {
        refreshOperationStatus(activeOperation.id);
      }, 2000); // 每2秒刷新一次
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  });

  return {
    operations,
    activeOperation,
    isLoading,

    // Actions
    createBulkOperation,
    bulkSyncAccounts,
    bulkEvaluateAccounts,
    getOperationStatus,
    refreshOperationStatus,
    cancelOperation,
    rollbackOperation,
    getOperationReport,
    cleanupOperations,

    // State management
    setActiveOperation,
    setOperations,
  };
}

/**
 * 批量操作选择Hook
 */
export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);

  const selectedCount = selectedItems.size;
  const totalCount = items.length;

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const toggleAllSelection = useCallback(() => {
    if (isAllSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
    setIsAllSelected(!isAllSelected);
  }, [items, isAllSelected]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setIsAllSelected(false);
  }, []);

  const getSelectedItems = useCallback(() => {
    return items.filter(item => selectedItems.has(item.id));
  }, [items, selectedItems]);

  // 更新全选状态
  useState(() => {
    setIsAllSelected(selectedCount === totalCount && totalCount > 0);
  });

  return {
    selectedItems,
    selectedCount,
    isAllSelected,
    selectedItemsList: getSelectedItems(),

    // Actions
    toggleItemSelection,
    toggleAllSelection,
    clearSelection,
  };
}