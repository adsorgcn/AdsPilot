import { useTranslation } from 'react-i18next';
import { type ChangeEvent } from 'react';
import Button from '~/core/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import { TextFieldInput } from '~/core/ui/TextField';
import Badge from '~/core/ui/Badge';
import Spinner from '~/core/ui/Spinner';

import type {
  StatusFilter,
  EvaluationFilter,
  TimeRangeFilter,
  SortField,
  SortOrder,
} from '~/lib/offers/hooks/useOffersFilters';

export interface OffersFiltersProps {
  // Filter values
  status: StatusFilter;
  evaluationFilter: EvaluationFilter;
  timeRange: TimeRangeFilter;
  searchTerm: string;
  sortField: SortField;
  sortOrder: SortOrder;
  showFavoritesOnly: boolean;

  // Handlers
  onStatusChange: (status: StatusFilter) => void;
  onEvaluationFilterChange: (filter: EvaluationFilter) => void;
  onTimeRangeChange: (range: TimeRangeFilter) => void;
  onSearchChange: (search: string) => void;
  onSortFieldChange: (field: SortField) => void;
  onSortOrderToggle: () => void;
  onShowFavoritesToggle: () => void;
  onReset: () => void;
  onRefresh: () => void;

  // Display info
  totalCount: number;
  filteredCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  selectedCount: number;
  isRefreshing?: boolean;
}

export function OffersFilters({
  status,
  evaluationFilter,
  timeRange,
  searchTerm,
  sortField,
  sortOrder,
  showFavoritesOnly,
  onStatusChange,
  onEvaluationFilterChange,
  onTimeRangeChange,
  onSearchChange,
  onSortFieldChange,
  onSortOrderToggle,
  onShowFavoritesToggle,
  onReset,
  onRefresh,
  totalCount,
  filteredCount,
  currentPage,
  totalPages,
  pageSize,
  selectedCount,
  isRefreshing = false,
}: OffersFiltersProps) {
  const { t } = useTranslation('common');

  const STATUS_OPTIONS = [
    { value: 'all' as const, label: t('offers.filters.statusAll') },
    { value: 'pending_evaluation' as const, label: t('offers.status.pending_evaluation') },
    { value: 'evaluating' as const, label: t('offers.status.evaluating') },
    { value: 'ready_to_deploy' as const, label: t('offers.status.ready_to_deploy') },
    { value: 'deployed' as const, label: t('offers.status.deployed') },
    { value: 'archived' as const, label: t('offers.status.archived') },
    { value: 'evaluation_failed' as const, label: t('offers.status.evaluation_failed') },
  ];

  const EVALUATION_OPTIONS = [
    { value: 'all' as const, label: t('offers.filters.evaluationAll') },
    { value: 'ai' as const, label: t('offers.filters.aiEvaluation') },
    { value: 'basic' as const, label: t('offers.filters.basicEvaluation') },
  ];

  const TIME_RANGE_OPTIONS = [
    { value: 'all' as const, label: t('offers.filters.timeRangeAll') },
    { value: '7d' as const, label: t('offers.filters.last7Days') },
    { value: '30d' as const, label: t('offers.filters.last30Days') },
  ];

  const SORT_FIELD_OPTIONS = [
    { value: 'updatedAt' as const, label: t('offers.filters.sortByUpdated') },
    { value: 'healthScore' as const, label: t('offers.filters.sortByHealthScore') },
  ];

  return (
    <div className={'flex flex-col gap-4'}>
      {/* First row: Status, Evaluation, Time Range, Favorites */}
      <div className={'flex flex-wrap items-center gap-3'}>
        <Select
          value={status}
          onValueChange={(value) => onStatusChange(value as StatusFilter)}
        >
          <SelectTrigger className={'w-44'}>
            <SelectValue placeholder={t('offers.ui.selectStatus')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={evaluationFilter}
          onValueChange={(value) =>
            onEvaluationFilterChange(value as EvaluationFilter)
          }
        >
          <SelectTrigger className={'w-44'}>
            <SelectValue placeholder={t('offers.ui.evaluationType')} />
          </SelectTrigger>
          <SelectContent>
            {EVALUATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={timeRange}
          onValueChange={(value) =>
            onTimeRangeChange(value as TimeRangeFilter)
          }
        >
          <SelectTrigger className={'w-40'}>
            <SelectValue placeholder={t('offers.ui.timeRange')} />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size={'sm'}
          variant={showFavoritesOnly ? 'default' : 'outline'}
          onClick={onShowFavoritesToggle}
        >
          {t('offers.ui.favoritesOnly')}
        </Button>
      </div>

      {/* Second row: Search, Sort, Actions */}
      <div className={'flex w-full flex-wrap items-center gap-3 lg:w-auto'}>
        <div className={'w-full min-w-[220px] flex-1 lg:w-72'}>
          <TextFieldInput
            value={searchTerm}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onSearchChange(event.currentTarget.value)
            }
            placeholder={t('offers.ui.searchPlaceholder')}
            aria-label={t('offers.ui.searchAriaLabel')}
          />
        </div>

        <Select
          value={sortField}
          onValueChange={(value) =>
            onSortFieldChange(value as SortField)
          }
        >
          <SelectTrigger className={'w-40'}>
            <SelectValue placeholder={t('offers.ui.sortRule')} />
          </SelectTrigger>
          <SelectContent>
            {SORT_FIELD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size={'sm'}
          variant={'outline'}
          onClick={onSortOrderToggle}
        >
          {sortOrder === 'desc' ? t('offers.ui.descending') : t('offers.ui.ascending')}
        </Button>

        <Button
          size={'sm'}
          variant={'outline'}
          onClick={onRefresh}
        >
          {t('offers.ui.refresh')}
        </Button>

        <Button
          size={'sm'}
          variant={'ghost'}
          onClick={onReset}
        >
          {t('offers.ui.resetFilters')}
        </Button>
      </div>

      {/* Third row: Stats and info */}
      <div className={'flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'}>
        <div className={'flex flex-wrap items-center gap-2'}>
          <span>
            {t('offers.ui.totalOffers', { totalCount, filteredCount })}
          </span>
          <span>
            {t('offers.ui.pageInfo', { currentPage, totalPages, limit: pageSize })}
          </span>
          {isRefreshing ? (
            <Spinner className={'h-4 w-4 text-muted-foreground'} />
          ) : null}
        </div>

        {selectedCount > 0 ? (
          <Badge size={'small'} color={'info'}>
            {t('offers.ui.selectedCount', { count: selectedCount })}
          </Badge>
        ) : (
          <span>{t('offers.ui.bulkOperationsSupport')}</span>
        )}
      </div>
    </div>
  );
}
