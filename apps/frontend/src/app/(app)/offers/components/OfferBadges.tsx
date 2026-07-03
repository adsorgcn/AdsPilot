import { type ComponentProps } from 'react';

import Badge from '~/core/ui/Badge';
import type { OfferSyncResult, OfferSyncStatus, OfferSyncSeverity } from '~/lib/tasks/offer-sync';

export function renderScoreBadge(score?: number) {
  if (typeof score !== 'number') {
    return <span className="text-muted-foreground">--</span>;
  }

  return (
    <Badge size="small" color={getScoreVariant(score)}>
      {score}
    </Badge>
  );
}

function getScoreVariant(score: number): ComponentProps<typeof Badge>['color'] {
  if (score >= 80) {
    return 'success';
  }
  if (score >= 60) {
    return 'info';
  }
  if (score >= 40) {
    return 'warn';
  }
  return 'error';
}

export function renderSyncBadge(result: OfferSyncResult | undefined, t: (key: string) => string) {
  const labelMap: Record<OfferSyncStatus, string> = {
    idle: t('offers.sync.idle'),
    evaluation_running: t('offers.sync.evaluationRunning'),
    evaluation_failed: t('offers.sync.evaluationFailed'),
    sync_running: t('offers.sync.syncRunning'),
    sync_pending: t('offers.sync.syncPending'),
    sync_failed: t('offers.sync.syncFailed'),
    sync_outdated: t('offers.sync.syncOutdated'),
    synced: t('offers.sync.synced'),
  };

  if (!result) {
    return (
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <Badge size="small" color="normal">
          {t('offers.sync.idle')}
        </Badge>
      </div>
    );
  }

  const colorMap: Record<OfferSyncSeverity, ComponentProps<typeof Badge>['color']> = {
    success: 'success',
    warn: 'warn',
    error: 'error',
    info: 'info',
  };

  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <Badge size="small" color={colorMap[result.severity]}>
        {labelMap[result.status] ?? result.title}
      </Badge>
      <span className="hidden xl:block truncate max-w-[220px]">{result.description}</span>
    </div>
  );
}
