"use client";

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Badge from '~/core/ui/Badge';
import { ResourceListSkeleton, ResourceEmptyState } from '~/core/ui/ResourceState';

import type { Task } from '~/lib/tasks';
import { buildOfferSyncInsights } from '~/lib/tasks/offer-sync';

type TaskOfferAdsInsightsProps = {
  tasks: Task[];
  isLoading: boolean;
};

export default function TaskOfferAdsInsights({ tasks, isLoading }: TaskOfferAdsInsightsProps) {
  const { t } = useTranslation('common');
  const { alerts, successes } = useMemo(() => buildOfferSyncInsights(tasks), [tasks]);

  if (isLoading && !tasks.length) {
    return <ResourceListSkeleton rows={3} />;
  }

  if (!tasks.length) {
    return (
      <ResourceEmptyState
        title={t('tasks.offerAds.noTasksTitle')}
        description={t('tasks.offerAds.noTasksDescription')}
      />
    );
  }

  const hasInsights = alerts.length > 0 || successes.length > 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {t('tasks.offerAds.title')}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t('tasks.offerAds.subtitle')}
        </span>
      </div>

      {!hasInsights ? (
        <ResourceEmptyState
          title={t('tasks.offerAds.allGoodTitle')}
          description={t('tasks.offerAds.allGoodDescription')}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {alerts.map((item) => (
            <InsightCard key={item.id} item={item} t={t} />
          ))}
          {successes.map((item) => (
            <InsightCard key={item.id} item={item} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({
  item,
  t,
}: {
  item: ReturnType<typeof buildOfferSyncInsights>['alerts'][number];
  t: (key: string) => string;
}) {
  const toneToBadge: Record<typeof item.severity, 'success' | 'warn' | 'error' | 'info'> = {
    success: 'success',
    warn: 'warn',
    error: 'error',
    info: 'info',
  };

  return (
    <div className="flex h-full flex-col justify-between rounded-lg border border-border bg-background p-4 shadow-sm">
      <div className="space-y-2">
        <Badge size="small" color={toneToBadge[item.severity]}>
          {toneLabel(item.severity, t)}
        </Badge>
        <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </div>

      {item.link ? (
        <a
          href={item.link.href}
          className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
        >
          {item.link.label}
        </a>
      ) : null}
    </div>
  );
}

function toneLabel(tone: 'success' | 'warn' | 'error' | 'info', t: (key: string) => string) {
  switch (tone) {
    case 'success':
      return t('tasks.offerAds.severitySuccess');
    case 'warn':
      return t('tasks.offerAds.severityWarn');
    case 'error':
      return t('tasks.offerAds.severityError');
    case 'info':
    default:
      return t('tasks.offerAds.severityInfo');
  }
}
