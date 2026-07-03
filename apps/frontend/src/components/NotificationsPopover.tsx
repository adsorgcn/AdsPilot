'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BellIcon } from '@heroicons/react/24/outline';

import Button from '~/core/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '~/core/ui/Popover';
import Spinner from '~/core/ui/Spinner';
import { useNotifications } from '~/lib/notifications';

export default function NotificationsPopover() {
  const { t, i18n } = useTranslation('common');
  const { data, isLoading, error, refetch } = useNotifications();
  const notifications = data?.items ?? [];
  const hasImportant = notifications.some((item) =>
    ['ALERT', 'ERROR', 'RISK', 'WARN', 'WARNING'].includes(
      (item.type ?? '').toUpperCase(),
    ),
  );
  const notificationFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [i18n.language],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative rounded-full"
          aria-label={t('dashboardTopbar.notificationsButtonAria')}
        >
          <BellIcon
            className={`h-5 w-5 ${hasImportant ? 'text-error-500' : 'text-muted-foreground'}`}
          />
          {notifications.length > 0 ? (
            <span className="absolute right-1 top-1 inline-flex h-2 w-2 rounded-full bg-error-500" />
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium text-foreground">
            {t('dashboardTopbar.notificationsTitle')}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-auto px-2 py-1 text-xs"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {t('dashboardTopbar.notificationsRefresh')}
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto px-3 py-2 text-sm">
          {error ? (
            <div className="py-6 text-center text-sm text-error-600">
              {t('dashboardTopbar.notificationsError')}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-5 w-5 text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {t('dashboardTopbar.notificationsEmpty')}
            </div>
          ) : (
            <ul className="space-y-3">
              {notifications.map((notification) => {
                const accent = getNotificationAccent(notification.type);

                return (
                  <li
                    key={notification.id}
                    className={`rounded-lg border p-3 text-left ${accent}`}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {notification.title}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                      {notification.message}
                    </p>
                    <span className="mt-2 block text-right text-[11px] text-muted-foreground">
                      {formatNotificationTime(
                        notification.createdAt,
                        notificationFormatter,
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getNotificationAccent(type?: string) {
  const normalized = (type ?? '').toLowerCase();

  if (['alert', 'error', 'risk', 'warn', 'warning'].includes(normalized)) {
    return 'border-error-200 bg-error-50 dark:border-error-400/40 dark:bg-error-500/10';
  }

  if (normalized === 'info') {
    return 'border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10';
  }

  return 'border-border bg-card';
}

function formatNotificationTime(value: string, formatter: Intl.DateTimeFormat) {
  try {
    return formatter.format(new Date(value));
  } catch {
    return value;
  }
}
