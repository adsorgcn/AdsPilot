'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import classNames from 'clsx';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import TextField from '~/core/ui/TextField';

interface TableToolbarProps {
  searchValue?: string;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
  activeFilters?: Array<{
    key: string;
    label: string;
    onRemove?: () => void;
  }>;
  onResetFilters?: () => void;
}

export default function TableToolbar({
  searchValue = '',
  searchPlaceholder,
  onSearch,
  actions,
  filters,
  className,
  activeFilters,
  onResetFilters,
}: TableToolbarProps) {
  const { t } = useTranslation('common');
  const [value, setValue] = useState(searchValue);
  const searchInputPlaceholder =
    searchPlaceholder ?? t('table.searchPlaceholder');

  useEffect(() => {
    setValue(searchValue);
  }, [searchValue]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSearch?.(value);
    },
    [onSearch, value],
  );

  return (
    <div
      className={classNames(
        'flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form
          onSubmit={handleSubmit}
          className="relative flex w-full max-w-md items-center"
        >
          <TextField.Input
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setValue(event.currentTarget.value)
            }
            placeholder={searchInputPlaceholder}
            className="h-10 rounded-full pl-4 pr-3 text-sm"
            aria-label={t('table.searchAriaLabel')}
          />
        </form>

        {actions ? (
          <div className="flex w-full justify-end gap-2 md:w-auto">
            {actions}
          </div>
        ) : null}
      </div>
      {filters ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{filters}</div>
      ) : null}

      {activeFilters && activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted"
              onClick={filter.onRemove}
              disabled={!filter.onRemove}
            >
              <span>{filter.label}</span>
              {filter.onRemove ? <XMarkIcon className="h-3 w-3" /> : null}
            </button>
          ))}

          {onResetFilters ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={onResetFilters}
            >
              {t('table.resetFilters')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
