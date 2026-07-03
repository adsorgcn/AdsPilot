import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Button from '~/core/ui/Button';

interface OfferEvaluationErrorProps {
  message?: string;
  onRetry?: () => void;
}

/**
 * @name OfferEvaluationError
 * @description Error state for evaluation results with retry button
 *
 * Ref: frontend-package-offer-evaluation.md - Task A2-5
 */
export function OfferEvaluationError({
  message,
  onRetry,
}: OfferEvaluationErrorProps) {
  const { t } = useTranslation('common');
  const errorMessage = message || t('offers.evaluate.errorMessage');

  return (
    <div
      className={
        'flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/50 p-8 text-center dark:border-red-900/30 dark:bg-red-950/20'
      }
    >
      <ExclamationTriangleIcon
        className={'mb-3 h-12 w-12 text-red-600 dark:text-red-500'}
      />

      <h3 className={'mb-2 text-base font-semibold text-foreground'}>
        {t('offers.evaluate.errorTitle')}
      </h3>

      <p className={'mb-4 max-w-md text-sm text-muted-foreground'}>
        {errorMessage}
      </p>

      {onRetry && (
        <Button
          size={'sm'}
          variant={'outline'}
          onClick={onRetry}
          className={'gap-2'}
        >
          <ArrowPathIcon className={'h-4 w-4'} />
          {t('retry')}
        </Button>
      )}
    </div>
  );
}

export default OfferEvaluationError;
