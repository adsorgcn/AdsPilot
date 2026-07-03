import { useTranslation } from 'react-i18next';
import Button from '~/core/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';

const PAGE_SIZE_OPTIONS = [20, 30, 50, 100];

interface OffersPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function OffersPagination({
  page,
  totalPages,
  pageSize,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: OffersPaginationProps) {
  const { t } = useTranslation('common');

  return (
    <div className={'flex flex-wrap items-center justify-between gap-4 text-sm'}>
      <div className={'flex items-center gap-2'}>
        <span>{t('offers.ui.itemsPerPage')}</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger className={'w-24'}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>{t('offers.ui.items')}</span>
      </div>

      <div className={'flex items-center gap-2'}>
        <Button
          size={'sm'}
          variant={'outline'}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={isLoading || page <= 1}
        >
          {t('offers.ui.previousPage')}
        </Button>

        <span>
          {t('offers.ui.pageOfTotal', { page, totalPages })}
        </span>

        <Button
          size={'sm'}
          variant={'outline'}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={isLoading || page >= totalPages}
        >
          {t('offers.ui.nextPage')}
        </Button>
      </div>
    </div>
  );
}
