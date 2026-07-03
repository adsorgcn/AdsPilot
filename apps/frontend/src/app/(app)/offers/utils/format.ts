const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function formatRelativeTime(
  value: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (!value) {
    return t('offers.detail.na');
  }

  try {
    const date = new Date(value);
    const now = Date.now();
    const diff = now - date.getTime();

    if (diff < HOUR_IN_MS) {
      const minutes = Math.floor(diff / (60 * 1000));
      return t('offers.detail.minutesAgo', { minutes });
    }

    if (diff < DAY_IN_MS) {
      const hours = Math.floor(diff / HOUR_IN_MS);
      return t('offers.detail.hoursAgo', { hours });
    }

    if (diff < 7 * DAY_IN_MS) {
      const days = Math.floor(diff / DAY_IN_MS);
      return t('offers.detail.daysAgo', { days });
    }

    return formatDate(value);
  } catch {
    return formatDate(value);
  }
}

export function formatDate(value?: string) {
  if (!value) {
    return '--';
  }

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '--';
  }
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function formatEvaluationStatus(status: string, t: (key: string) => string) {
  const statusMap: Record<string, string> = {
    pending: t('offers.evaluation.status.pending'),
    running: t('offers.evaluation.status.running'),
    completed: t('offers.evaluation.status.completed'),
    failed: t('offers.evaluation.status.failed'),
  };

  return statusMap[status] ?? status;
}
