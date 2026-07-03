/**
 * Export Client
 * 处理数据导出相关的所有API操作
 */

import BaseApiClient from '../../core/BaseApiClient';
import type { ExportHistory, ExportStats } from '../../types/console';

const CONSOLE_API_BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_API_URL ||
  'https://console-yt54xvsg5q-an.a.run.app/api/v1/console';

export class ExportClient extends BaseApiClient {
  constructor() {
    super(CONSOLE_API_BASE_URL);
  }

  /**
   * 获取导出历史记录
   */
  async getExportHistory(options?: { signal?: AbortSignal }): Promise<{ history: ExportHistory[]; total: number }> {
    return this.get('/exports/history', { signal: options?.signal });
  }

  /**
   * 记录导出操作
   */
  async recordExport(params: {
    type: string;
    format: string;
    start_date?: string;
    end_date?: string;
    record_count: number;
  }): Promise<{ success: boolean; export_id: string }> {
    return this.post('/exports/record', params);
  }

  /**
   * 获取导出统计信息
   */
  async getExportStats(options?: { signal?: AbortSignal }): Promise<ExportStats> {
    return this.get<ExportStats>('/exports/stats', { signal: options?.signal });
  }
}

export const exportClient = new ExportClient();
