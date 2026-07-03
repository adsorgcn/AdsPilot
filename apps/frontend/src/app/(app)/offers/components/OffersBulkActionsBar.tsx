import { useTranslation } from 'react-i18next';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import Spinner from '~/core/ui/Spinner';

export interface OffersBulkActionsBarProps {
  /** Number of selected offers */
  selectedCount: number;

  /** Whether bulk actions are currently pending */
  isBulkPending: boolean;

  /** Handler for bulk evaluate action */
  onBulkEvaluate: () => void;

  /** Handler for bulk delete action */
  onBulkDelete: () => void;

  /** Handler for clearing selection */
  onClearSelection: () => void;
}

/**
 * Bulk actions bar component for offers page
 * Shows action buttons when offers are selected
 */
export function OffersBulkActionsBar({
  selectedCount,
  isBulkPending,
  onBulkEvaluate,
  onBulkDelete,
  onClearSelection,
}: OffersBulkActionsBarProps) {
  const { t } = useTranslation('common');

  // Don't render if nothing is selected
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={
        'flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3'
      }
    >
      <Badge size={'small'} color={'info'}>
        {t('offers.ui.selectedOffers', { count: selectedCount })}
      </Badge>

      <div className={'ml-auto flex flex-wrap items-center gap-2'}>
        <Button
          size={'sm'}
          variant={'outline'}
          onClick={onBulkEvaluate}
          disabled={isBulkPending}
        >
          {isBulkPending ? (
            <Spinner className={'h-4 w-4'} />
          ) : (
            t('offers.ui.bulkEvaluate')
          )}
        </Button>

        <Button
          size={'sm'}
          variant={'outline'}
          onClick={onBulkDelete}
          disabled={isBulkPending}
        >
          {isBulkPending ? (
            <Spinner className={'h-4 w-4'} />
          ) : (
            t('offers.ui.bulkDelete')
          )}
        </Button>

        <Button
          size={'sm'}
          variant={'ghost'}
          onClick={onClearSelection}
          disabled={isBulkPending}
        >
          {t('offers.ui.clearSelection')}
        </Button>
      </div>
    </div>
  );
}
