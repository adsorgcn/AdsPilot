/**
 * Offer Sync Types
 * Offer同步状态类型定义
 */

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

export type TaskMap = Map<string, Task>;
