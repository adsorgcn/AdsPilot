'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Trash2, 
  Download, 
  X, 
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { GlassCard } from '~/components/ui/GlassCard';
import { GradientButton } from '~/components/ui/GradientButton';
import Button from '~/core/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '~/core/ui/Dialog';
import { cn } from '~/core/generic/shadcn-utils';

export interface BatchActionsToolbarProps {
  /**
   * Number of selected items
   */
  selectedCount: number;
  /**
   * Whether to show the toolbar
   */
  visible: boolean;
  /**
   * Whether batch evaluation is in progress
   */
  isEvaluating?: boolean;
  /**
   * Whether batch delete is in progress
   */
  isDeleting?: boolean;
  /**
   * Callback when evaluate action is clicked
   */
  onEvaluate?: () => void;
  /**
   * Callback when delete action is clicked
   */
  onDelete?: () => void;
  /**
   * Callback when export action is clicked
   */
  onExport?: () => void;
  /**
   * Callback when clear selection is clicked
   */
  onClearSelection?: () => void;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * BatchActionsToolbar - Fixed toolbar for batch operations on selected offers
 * 
 * Appears with slide-in animation when items are selected.
 * Provides quick access to batch evaluate, delete, and export actions.
 */
export function BatchActionsToolbar({
  selectedCount,
  visible,
  isEvaluating = false,
  isDeleting = false,
  onEvaluate,
  onDelete,
  onExport,
  onClearSelection,
  className,
}: BatchActionsToolbarProps) {
  const { t } = useTranslation('common');
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete?.();
  };

  return (
    <>
      <AnimatePresence>
        {visible && selectedCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed bottom-6 left-1/2 z-50 -translate-x-1/2',
              'w-full max-w-2xl px-4',
              className
            )}
          >
            <GlassCard 
              variant="gradient"
              className="shadow-2xl border-2 border-primary/20"
            >
              <div className="p-4">
                <div className="flex items-center justify-between gap-4">
                  {/* Left section - Selection info */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {t('offers.batchActions.selected', '{{count}} offer selected', {
                          count: selectedCount,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('offers.batchActions.subtitle', 'Choose an action below')}
                      </p>
                    </div>
                  </div>

                  {/* Right section - Actions */}
                  <div className="flex items-center gap-2">
                    {/* Evaluate button */}
                    {onEvaluate && (
                      <GradientButton
                        variant="primary"
                        size="sm"
                        onClick={onEvaluate}
                        disabled={isEvaluating || isDeleting}
                        className="group"
                      >
                        <Sparkles className={cn(
                          'h-4 w-4',
                          isEvaluating && 'animate-spin'
                        )} />
                        {isEvaluating
                          ? t('offers.batchActions.evaluating', 'Evaluating...')
                          : t('offers.batchActions.evaluate', 'Evaluate')}
                      </GradientButton>
                    )}

                    {/* Export button */}
                    {onExport && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onExport}
                        disabled={isEvaluating || isDeleting}
                      >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">
                          {t('offers.batchActions.export', 'Export')}
                        </span>
                      </Button>
                    )}

                    {/* Delete button */}
                    {onDelete && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteClick}
                        disabled={isEvaluating || isDeleting}
                      >
                        <Trash2 className={cn(
                          'h-4 w-4',
                          isDeleting && 'animate-pulse'
                        )} />
                        <span className="hidden sm:inline">
                          {isDeleting
                            ? t('offers.batchActions.deleting', 'Deleting...')
                            : t('offers.batchActions.delete', 'Delete')}
                        </span>
                      </Button>
                    )}

                    {/* Clear selection button */}
                    {onClearSelection && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearSelection}
                        disabled={isEvaluating || isDeleting}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">
                          {t('offers.batchActions.clearSelection', 'Clear selection')}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <DialogHeader>
                <DialogTitle>
                  {t('offers.batchActions.deleteConfirm.title', 'Delete {{count}} offer?', {
                    count: selectedCount,
                  })}
                </DialogTitle>
                <DialogDescription>
                  {t('offers.batchActions.deleteConfirm.description', 
                    'This action cannot be undone. The selected offers and their evaluation data will be permanently deleted.'
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={handleDeleteConfirm}
                >
                  {t('offers.batchActions.deleteConfirm.confirm', 'Delete')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}