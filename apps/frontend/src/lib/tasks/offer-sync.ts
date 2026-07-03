import type { Task } from '~/lib/tasks';

export type OfferSyncStatus =
  | 'idle'
  | 'evaluation_running'
  | 'evaluation_failed'
  | 'sync_running'
  | 'sync_pending'
  | 'sync_failed'
  | 'sync_outdated'
  | 'synced';

export type OfferSyncSeverity = 'success' | 'warn' | 'error' | 'info';

export interface OfferSyncResult {
  offerId: string;
  offerUrl?: string;
  adsAccountId?: string;
  status: OfferSyncStatus;
  severity: OfferSyncSeverity;
  title: string;
  description: string;
  evaluationTask?: Task;
  syncTask?: Task;
  link?: {
    label: string;
    href: string;
  };
}

export interface OfferSyncInsightItem {
  id: string;
  offerId: string;
  adsAccountId?: string;
  severity: OfferSyncSeverity;
  title: string;
  description: string;
  offerUrl?: string;
  link?: {
    label: string;
    href: string;
  };
}

export interface OfferSyncInsights {
  alerts: OfferSyncInsightItem[];
  successes: OfferSyncInsightItem[];
}

type TaskMap = Map<string, Task>;

const OFFER_TASK_TYPES = new Set(['evaluation', 'deployment']);
const SYNC_TASK_TYPES = new Set(['sync']);

export function buildOfferSyncMap(tasks: Task[]): Map<string, OfferSyncResult> {
  const evaluationMap = groupLatest(tasks.filter((task) => OFFER_TASK_TYPES.has(task.type) && task.offerId), (task) =>
    task.offerId ? task.offerId : task.id,
  );

  const syncMap = groupLatest(tasks.filter((task) => SYNC_TASK_TYPES.has(task.type) && task.adsAccountId), (task) =>
    task.adsAccountId ? task.adsAccountId : task.id,
  );

  const result = new Map<string, OfferSyncResult>();

  evaluationMap.forEach((evaluationTask, offerId) => {
    const syncResult = computeSyncStatus(evaluationTask, syncMap);
    result.set(offerId, syncResult);
  });

  return result;
}

export function buildOfferSyncInsights(tasks: Task[]): OfferSyncInsights {
  const offerMap = buildOfferSyncMap(tasks);

  const alerts: OfferSyncInsightItem[] = [];
  const successes: OfferSyncInsightItem[] = [];

  offerMap.forEach((item) => {
    const insight: OfferSyncInsightItem = {
      id: `${item.offerId}-${item.status}`,
      offerId: item.offerId,
      adsAccountId: item.adsAccountId,
      severity: item.severity,
      title: item.title,
      description: item.description,
      offerUrl: item.offerUrl,
      link: item.link,
    };

    if (!insight.link && item.offerUrl) {
      insight.link = {
        label: '查看 Offer',
        href: item.offerUrl,
      };
    }

    if (item.severity === 'success') {
      successes.push(insight);
    } else {
      alerts.push(insight);
    }
  });

  // Sort alerts by severity priority (error > warn > info) and recency
  const severityPriority: Record<OfferSyncSeverity, number> = {
    error: 0,
    warn: 1,
    info: 2,
    success: 3,
  };

  const sortByUpdated = (a: OfferSyncInsightItem, b: OfferSyncInsightItem) => {
    const taskA = findLatestTaskForInsight(a, tasks);
    const taskB = findLatestTaskForInsight(b, tasks);
    const timeA = taskA ? new Date(taskA.updatedAt ?? taskA.createdAt).getTime() : 0;
    const timeB = taskB ? new Date(taskB.updatedAt ?? taskB.createdAt).getTime() : 0;
    return timeB - timeA;
  };

  alerts.sort((a, b) => {
    const severityDiff = severityPriority[a.severity] - severityPriority[b.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return sortByUpdated(a, b);
  });

  successes.sort(sortByUpdated);

  return { alerts, successes };
}

function computeSyncStatus(evaluationTask: Task, syncMap: TaskMap): OfferSyncResult {
  const offerId = evaluationTask.offerId ?? evaluationTask.id;
  const offerUrl = evaluationTask.offerUrl;
  const adsAccountId = evaluationTask.adsAccountId;
  const evaluationStatus = evaluationTask.status;

  const base: OfferSyncResult = {
    offerId,
    offerUrl,
    adsAccountId,
    evaluationTask,
    status: 'idle',
    severity: 'info',
    title: '无最新评估任务',
    description: '该 Offer 尚未执行评估任务。',
  };

  if (evaluationStatus === 'failed') {
    return {
      ...base,
      status: 'evaluation_failed',
      severity: 'error',
      title: '评估失败',
      description: evaluationTask.error
        ? truncate(evaluationTask.error)
        : '评估任务失败，请检查任务日志后重试。',
      link: {
        label: '查看任务',
        href: '/tasks',
      },
    };
  }

  if (evaluationStatus === 'running' || evaluationStatus === 'pending') {
    return {
      ...base,
      status: 'evaluation_running',
      severity: 'info',
      title: evaluationStatus === 'running' ? '评估进行中' : '评估排队中',
      description: '评估任务尚未完成，完成后将触发广告数据同步。',
      link: {
        label: '查看任务',
        href: '/tasks',
      },
    };
  }

  if (evaluationStatus !== 'completed') {
    return base;
  }

  // Evaluation completed
  if (!adsAccountId) {
    return {
      ...base,
      status: 'synced',
      severity: 'success',
      title: '评估完成',
      description: '评估任务已完成，可查看评估结果并执行后续操作。',
      link: {
        label: '查看任务',
        href: '/tasks',
      },
    };
  }

  const syncTask = syncMap.get(adsAccountId);
  if (!syncTask) {
    return {
      ...base,
      status: 'sync_pending',
      severity: 'warn',
      title: '等待广告同步',
      description: '评估已完成，但对应广告账号尚未同步，建议立即执行同步任务。',
      link: adsAccountId
        ? {
            label: '前往 Ads Center',
            href: `/adscenter?account=${adsAccountId}`,
          }
        : undefined,
    };
  }

  const evaluationTime = getTimestamp(evaluationTask.completedAt ?? evaluationTask.updatedAt);
  const syncTime = getTimestamp(syncTask.completedAt ?? syncTask.updatedAt);

  if (syncTask.status === 'failed') {
    return {
      ...base,
      status: 'sync_failed',
      severity: 'error',
      title: '广告同步失败',
      description: syncTask.error
        ? truncate(syncTask.error)
        : '同步任务失败，请在 Ads Center 中检查账号连接。',
      syncTask,
      link: adsAccountId
        ? {
            label: '处理同步失败',
            href: `/adscenter?account=${adsAccountId}`,
          }
        : {
            label: '查看任务',
            href: '/tasks',
          },
    };
  }

  if (syncTask.status === 'running' || syncTask.status === 'pending') {
    return {
      ...base,
      status: 'sync_running',
      severity: 'info',
      title: '广告同步进行中',
      description: '广告账号同步任务正在执行，完成后会更新最新表现数据。',
      syncTask,
      link: adsAccountId
        ? {
            label: '查看同步进度',
            href: `/adscenter?account=${adsAccountId}`,
          }
        : {
            label: '查看任务',
            href: '/tasks',
          },
    };
  }

  if (syncTask.status === 'completed') {
    if (syncTime >= evaluationTime) {
      return {
        ...base,
        status: 'synced',
        severity: 'success',
        title: '评估结果已同步',
        description: '最新评估结果已同步至广告账号，可在 Ads Center 中查看表现。',
        syncTask,
        link: adsAccountId
          ? {
              label: '查看 Ads Center',
              href: `/adscenter?account=${adsAccountId}`,
            }
          : {
              label: '查看任务',
              href: '/tasks',
            },
      };
    }

    return {
      ...base,
      status: 'sync_outdated',
      severity: 'warn',
      title: '同步数据滞后',
      description: '广告账号同步早于最近一次评估，建议再次触发同步以更新数据。',
      syncTask,
      link: adsAccountId
        ? {
            label: '立即同步',
            href: `/adscenter?account=${adsAccountId}`,
          }
        : {
            label: '查看任务',
            href: '/tasks',
          },
    };
  }

  return {
    ...base,
    status: 'idle',
    severity: 'info',
    title: '任务状态未知',
    description: '同步任务状态未知，请检查任务详情。',
    syncTask,
    link: {
      label: '查看任务',
      href: '/tasks',
    },
  };
}

function groupLatest(tasks: Task[], keySelector: (task: Task) => string): TaskMap {
  const map = new Map<string, Task>();

  tasks.forEach((task) => {
    const key = keySelector(task);
    if (!key) {
      return;
    }

    const previous = map.get(key);
    const prevTime = previous ? getTimestamp(previous.updatedAt ?? previous.createdAt) : -Infinity;
    const currentTime = getTimestamp(task.updatedAt ?? task.createdAt);

    if (currentTime >= prevTime) {
      map.set(key, task);
    }
  });

  return map;
}

function getTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function truncate(text: string) {
  if (text.length <= 96) {
    return text;
  }
  return `${text.slice(0, 93)}...`;
}

function findLatestTaskForInsight(insight: OfferSyncInsightItem, tasks: Task[]) {
  if (!insight.offerId) {
    return null;
  }
  return tasks
    .filter((task) => task.offerId === insight.offerId || task.adsAccountId === insight.adsAccountId)
    .sort((a, b) => getTimestamp(b.updatedAt ?? b.createdAt) - getTimestamp(a.updatedAt ?? a.createdAt))[0];
}
