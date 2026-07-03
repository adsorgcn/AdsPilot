'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/Card';
import { Button } from '~/core/ui/Button';
import { Badge } from '~/core/ui/Badge';
import Progress from '~/core/ui/Progress';
import { Alert, AlertDescription } from '~/core/ui/Alert';
import {
  Play,
  X,
  RotateCcw,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  List,
} from 'lucide-react';
import { useBulkOperations, useBulkSelection, type BulkOperation } from '~/lib/ads-center/hooks/useBulkOperations';
import type { AdsAccount } from '~/lib/ads-center/types';

interface BulkOperationsPanelProps {
  accounts: AdsAccount[];
  onOperationsUpdated?: () => void;
}

/**
 * 批量操作面板组件
 *
 * 提供完整的批量操作UI，包括：
 * - 操作选择和执行
 * - 实时进度监控
 * - 历史记录查看
 * - 错误处理和回滚
 */
export function BulkOperationsPanel({
  accounts,
  onOperationsUpdated,
}: BulkOperationsPanelProps) {
  const { t } = useTranslation('common');
  const {
    operations,
    activeOperation,
    isLoading,
    bulkSyncAccounts,
    bulkEvaluateAccounts,
    cancelOperation,
    rollbackOperation,
    getOperationReport,
  } = useBulkOperations();

  const {
    selectedCount,
    isAllSelected,
    selectedItemsList,
    toggleAllSelection,
    clearSelection,
  } = useBulkSelection(accounts);

  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'sync' | 'evaluate' | 'other'>('sync');

  // 执行批量同步
  const handleBulkSync = async () => {
    const selectedIds = selectedItemsList.map(item => item.id);
    const operation = await bulkSyncAccounts(selectedIds);

    if (operation) {
      clearSelection();
      onOperationsUpdated?.();
    }
  };

  // 执行批量评估
  const handleBulkEvaluate = async () => {
    const selectedIds = selectedItemsList.map(item => item.id);
    const operation = await bulkEvaluateAccounts(selectedIds);

    if (operation) {
      clearSelection();
      onOperationsUpdated?.();
    }
  };

  // 获取操作状态Badge
  const getOperationStatusBadge = (status: BulkOperation['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {t('adsCenter.bulkOperations.status.pending', 'Pending')}
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('adsCenter.bulkOperations.status.inProgress', 'In Progress')}
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('adsCenter.bulkOperations.status.completed', 'Completed')}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t('adsCenter.bulkOperations.status.failed', 'Failed')}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary" className="gap-1">
            <X className="h-3 w-3" />
            {t('adsCenter.bulkOperations.status.cancelled', 'Cancelled')}
          </Badge>
        );
      default:
        return null;
    }
  };

  // 格式化持续时间
  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();

    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="space-y-6">
      {/* 操作选择区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            {t('adsCenter.bulkOperations.title', 'Bulk Operations')}
            {selectedCount > 0 && (
              <Badge variant="secondary">
                {selectedCount} {t('adsCenter.bulkOperations.selected', 'selected')}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 全选控制 */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleAllSelection}
                disabled={accounts.length === 0}
                className="h-4 w-4"
              />
              <span className="text-sm">
                {t('adsCenter.bulkOperations.selectAll', 'Select all accounts')}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedCount} / {accounts.length}
            </div>
          </div>

          {/* 操作类型选择 */}
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            <Button
              variant={activeTab === 'sync' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('sync')}
            >
              {t('adsCenter.bulkOperations.tabs.sync', 'Sync')}
            </Button>
            <Button
              variant={activeTab === 'evaluate' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('evaluate')}
            >
              {t('adsCenter.bulkOperations.tabs.evaluate', 'Evaluate')}
            </Button>
            <Button
              variant={activeTab === 'other' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('other')}
            >
              {t('adsCenter.bulkOperations.tabs.other', 'Other')}
            </Button>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            {activeTab === 'sync' && (
              <Button
                onClick={handleBulkSync}
                disabled={selectedCount === 0 || isLoading}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {t('adsCenter.bulkOperations.actions.sync', 'Sync Selected')}
              </Button>
            )}

            {activeTab === 'evaluate' && (
              <Button
                onClick={handleBulkEvaluate}
                disabled={selectedCount === 0 || isLoading}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                {t('adsCenter.bulkOperations.actions.evaluate', 'Evaluate Selected')}
              </Button>
            )}

            {selectedCount > 0 && (
              <Button
                variant="outline"
                onClick={clearSelection}
              >
                {t('adsCenter.bulkOperations.actions.clearSelection', 'Clear Selection')}
              </Button>
            )}
          </div>

          {/* 当前操作状态 */}
          {activeOperation && (
            <Alert className="border-blue-200 bg-blue-50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription className="text-blue-800">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>
                      {t('adsCenter.bulkOperations.activeOperation', 'Active Operation')}:
                    </strong>{' '}
                    {activeOperation.action} ({activeOperation.affectedItems.length} items)
                  </div>
                  <div className="flex items-center gap-2">
                    {getOperationStatusBadge(activeOperation.status)}
                  </div>
                </div>
                {activeOperation.progress && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>
                        {activeOperation.progress.current} / {activeOperation.progress.total}
                      </span>
                      <span>{activeOperation.progress.percentage}%</span>
                    </div>
                    <Progress value={activeOperation.progress.percentage} className="h-2" />
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 操作历史 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('adsCenter.bulkOperations.history', 'Operation History')}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory
                ? t('common.hide', 'Hide')
                : t('common.show', 'Show')}
            </Button>
          </CardTitle>
        </CardHeader>

        {showHistory && (
          <CardContent>
            {operations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">
                  {t('adsCenter.bulkOperations.noHistory', 'No operation history')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {operations.map((operation) => (
                  <div
                    key={operation.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">
                          {operation.action}
                        </span>
                        {getOperationStatusBadge(operation.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {operation.affectedItems.length} items •{' '}
                        {formatDuration(operation.createdAt, operation.completedAt)}
                      </div>
                      {operation.errors && operation.errors.length > 0 && (
                        <div className="text-sm text-red-600">
                          {operation.errors.length}{' '}
                          {t('adsCenter.bulkOperations.errors', 'errors')}
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1">
                      {operation.status === 'in_progress' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelOperation(operation.id)}
                          className="gap-1"
                        >
                          <X className="h-3 w-3" />
                          {t('common.cancel', 'Cancel')}
                        </Button>
                      )}

                      {operation.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rollbackOperation(operation.id)}
                          className="gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {t('common.rollback', 'Rollback')}
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => getOperationReport(operation.id)}
                        className="gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        {t('common.report', 'Report')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}