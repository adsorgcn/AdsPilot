/**
 * Offer Sync Utils
 * Offer同步工具函数
 */

import type { Task } from '~/lib/tasks';
import type { TaskMap, OfferSyncInsightItem } from './types';

export const OFFER_TASK_TYPES = new Set(['evaluation', 'deployment']);
export const SYNC_TASK_TYPES = new Set(['sync']);

export function getTimestamp(value?: string): number {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function truncate(text: string): string {
  if (text.length <= 96) {
    return text;
  }
  return `${text.slice(0, 93)}...`;
}

export function groupLatest(
  tasks: Task[],
  keySelector: (task: Task) => string,
): TaskMap {
  const map = new Map<string, Task>();

  tasks.forEach((task) => {
    const key = keySelector(task);
    if (!key) {
      return;
    }

    const previous = map.get(key);
    const prevTime = previous
      ? getTimestamp(previous.updatedAt ?? previous.createdAt)
      : -Infinity;
    const currentTime = getTimestamp(task.updatedAt ?? task.createdAt);

    if (currentTime >= prevTime) {
      map.set(key, task);
    }
  });

  return map;
}

export function findLatestTaskForInsight(
  insight: OfferSyncInsightItem,
  tasks: Task[],
): Task | null {
  if (!insight.offerId) {
    return null;
  }
  return (
    tasks
      .filter(
        (task) =>
          task.offerId === insight.offerId ||
          task.adsAccountId === insight.adsAccountId,
      )
      .sort(
        (a, b) =>
          getTimestamp(b.updatedAt ?? b.createdAt) -
          getTimestamp(a.updatedAt ?? a.createdAt),
      )[0] ?? null
  );
}
