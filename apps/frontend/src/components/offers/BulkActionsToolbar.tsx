'use client';

import { useTranslation } from 'react-i18next';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import {
  CheckSquare,
  Archive,
  Trash2,
  Target,
  X,
  RefreshCw,
} from 'lucide-react';

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkEvaluate?: () => void;
  onBulkArchive?: () => void;
  onBulkDelete?: () => void;
  canUseAI?: boolean;
  isProcessing?: boolean;
}

/**
 * Bulk operations toolbar for offers table
 * Design reference: design.md lines 1908-1923
 */
export function BulkActionsToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkEvaluate,
  onBulkArchive,
  onBulkDelete,
  canUseAI = false,
  isProcessing = false,
}: BulkActionsToolbarProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-10 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Selection Info */}
        <div className="flex items-center gap-3">
          <Badge variant="default" className="bg-blue-600">
            {selectedCount} {t('offers.bulkActions.selected', 'selected')}
          </Badge>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
              className="h-8 text-blue-700 hover:text-blue-800 hover:bg-blue-100"
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              {selectedCount === totalCount
                ? t('offers.bulkActions.deselectAll', 'Deselect All')
                : t('offers.bulkActions.selectAll', `Select All (${totalCount})`)}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeselectAll}
              className="h-8 text-blue-700 hover:text-blue-800 hover:bg-blue-100"
            >
              <X className="h-4 w-4 mr-1" />
              {t('offers.bulkActions.clear', 'Clear')}
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex items-center gap-2">
          {canUseAI && onBulkEvaluate && (
            <Button
              variant="default"
              size="sm"
              onClick={onBulkEvaluate}
              disabled={isProcessing}
              className="gap-1 bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Target className="h-4 w-4" />
              )}
              {t('offers.bulkActions.evaluate', 'Batch Evaluate')}
            </Button>
          )}

          {onBulkArchive && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkArchive}
              disabled={isProcessing}
              className="gap-1"
            >
              <Archive className="h-4 w-4" />
              {t('offers.bulkActions.archive', 'Archive')}
            </Button>
          )}

          {onBulkDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              disabled={isProcessing}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" />
              {t('offers.bulkActions.delete', 'Delete')}
            </Button>
          )}
        </div>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="mt-3 flex items-center gap-2 text-sm text-blue-700">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>{t('offers.bulkActions.processing', 'Processing batch operation...')}</span>
        </div>
      )}
    </div>
  );
}
