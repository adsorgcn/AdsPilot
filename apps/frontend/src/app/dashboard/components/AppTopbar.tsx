'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, type ChangeEvent } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';

import useUserSubscription from '~/core/hooks/use-user-subscription';
import useQuickActions from '~/lib/navigation/use-quick-actions';

export default function AppTopbar() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const { t } = useTranslation('common');

  const basePath = '/dashboard';

  const quickActions = useQuickActions(basePath);
  const searchPlaceholder = t('dashboardTopbar.searchPlaceholder');
  const searchAriaLabel = t('dashboardTopbar.searchAriaLabel');

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!keyword.trim()) {
        return;
      }

      router.push(`${basePath}/offers?search=${encodeURIComponent(keyword)}`);
    },
    [keyword, basePath, router],
  );

  return (
    <div className="border-b border-border bg-background">
      <div className="layout-container flex flex-col gap-4 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-1 items-center gap-3">
          <form
            onSubmit={handleSubmit}
            className="relative flex w-full max-w-lg items-center"
          >
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <TextField.Input
              value={keyword}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setKeyword(event.currentTarget.value)
              }
              className="h-10 rounded-full pl-9 pr-4 text-sm"
              placeholder={searchPlaceholder}
              aria-label={searchAriaLabel}
            />
          </form>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 md:flex-nowrap">
          {quickActions.map((action) => (
            <Button
              key={action.href}
              size="sm"
              variant={action.highlight ? 'default' : 'outline'}
              className="gap-1"
              disabled={action.disabled}
              title={action.reason}
              onClick={() => {
                if (!action.disabled) {
                  router.push(action.href);
                }
              }}
            >
              <PlusIcon className="h-4 w-4" />
              {action.label}
            </Button>
          ))}

          <div className="hidden sm:flex">
            <TokenBalanceChip />
          </div>
        </div>
      </div>
    </div>
  );
}

function TokenBalanceChip() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useUserSubscription();

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
        <BoltIcon className="h-4 w-4 text-muted-foreground animate-pulse" />
        <span>{t('dashboardTopbar.tokenLabel')}</span>
        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const {
    currentTokenBalance = 0,
    monthlyTokenAllocation = 0,
    tier,
    isElite,
  } = data;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
      <BoltIcon className={`h-4 w-4 ${isElite ? 'text-primary' : 'text-muted-foreground'}`} />
      <span className="font-medium text-foreground">{currentTokenBalance.toLocaleString()}</span>
      <span className="text-muted-foreground">/ {monthlyTokenAllocation.toLocaleString()}</span>
      <span className="hidden text-muted-foreground sm:inline-flex">
        {tier.toUpperCase()}
      </span>
    </div>
  );
}
