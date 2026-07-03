'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsoleSystemAlerts } from '~/lib/admin/resources/system-alerts';
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  CircleStackIcon,
  CpuChipIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type AlertItem = {
  id: string;
  icon: ReactElement;
  title: string;
  description: string;
  severity: 'error' | 'warning';
};

const ERROR_RATE_THRESHOLD = 10;
const SLOW_QUERY_THRESHOLD_SECONDS = 1;
const MEMORY_USAGE_THRESHOLD = 80;

export default function SystemAlertsBanner() {
  const { data: alerts, isLoading } = useConsoleSystemAlerts();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { t } = useTranslation('admin');

  const alertItems = useMemo<AlertItem[]>(() => {
    if (!alerts) {
      return [];
    }

    const items: AlertItem[] = [];

    if (alerts.highErrorRate && !dismissed.has('errorRate')) {
      items.push({
        id: 'errorRate',
        icon: <ExclamationTriangleIcon className="h-5 w-5" />,
        title: t('systemAlerts.highErrorRate.title'),
        description: t('systemAlerts.highErrorRate.description', {
          value: alerts.errorRateValue.toFixed(1),
          threshold: ERROR_RATE_THRESHOLD,
        }),
        severity: 'error',
      });
    }

    if (alerts.serviceDown && !dismissed.has('serviceDown')) {
      items.push({
        id: 'serviceDown',
        icon: <ShieldExclamationIcon className="h-5 w-5" />,
        title: t('systemAlerts.serviceDown.title'),
        description: t('systemAlerts.serviceDown.description'),
        severity: 'error',
      });
    }

    if (alerts.databaseSlowQueries && !dismissed.has('dbSlow')) {
      items.push({
        id: 'dbSlow',
        icon: <CircleStackIcon className="h-5 w-5" />,
        title: t('systemAlerts.databaseSlowQueries.title'),
        description: t('systemAlerts.databaseSlowQueries.description', {
          count: alerts.slowQueryCount,
          threshold: SLOW_QUERY_THRESHOLD_SECONDS,
        }),
        severity: 'warning',
      });
    }

    if (alerts.highMemoryUsage && !dismissed.has('memory')) {
      items.push({
        id: 'memory',
        icon: <CpuChipIcon className="h-5 w-5" />,
        title: t('systemAlerts.highMemoryUsage.title'),
        description: t('systemAlerts.highMemoryUsage.description', {
          value: alerts.memoryUsagePercent.toFixed(1),
          threshold: MEMORY_USAGE_THRESHOLD,
        }),
        severity: 'warning',
      });
    }

    return items;
  }, [alerts, dismissed, t]);

  if (isLoading || alertItems.length === 0) {
    return null;
  }

  const dismissAlert = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {alertItems.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-4 rounded-lg border p-4 ${
            alert.severity === 'error'
              ? 'border-red-200 bg-red-50'
              : 'border-yellow-200 bg-yellow-50'
          }`}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              alert.severity === 'error'
                ? 'bg-red-100 text-red-600'
                : 'bg-yellow-100 text-yellow-600'
            }`}
          >
            {alert.icon}
          </div>
          <div className="flex-1">
            <h4
              className={`text-sm font-semibold ${
                alert.severity === 'error' ? 'text-red-900' : 'text-yellow-900'
              }`}
            >
              {alert.title}
            </h4>
            <p
              className={`mt-1 text-sm ${
                alert.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
              }`}
            >
              {alert.description}
            </p>
          </div>
          <button
            onClick={() => dismissAlert(alert.id)}
            className={`rounded-full p-1 transition-colors ${
              alert.severity === 'error'
                ? 'hover:bg-red-100'
                : 'hover:bg-yellow-100'
            }`}
            aria-label={t('systemAlerts.dismiss')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
