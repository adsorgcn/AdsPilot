'use client';

import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/core/ui/Dialog';
import { Button } from '~/core/ui/Button';

interface ConfigHistoryDialogProps {
  planTier: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigHistoryDialog({ planTier, isOpen, onClose }: ConfigHistoryDialogProps) {
  const { t } = useTranslation();

  if (!planTier) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t('manage.subscriptionPlans.configHistory')} - {planTier}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              {t('manage.subscriptionPlans.historyDialogPlaceholder')}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>{t('common.close')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
