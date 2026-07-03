import { consoleApi } from '~/lib/api';
import type { ExportHistory, ExportStats } from '~/lib/api/types/console';

export async function fetchExportHistory(signal?: AbortSignal): Promise<{ history: ExportHistory[]; total: number }> {
  return consoleApi.getExportHistory({ signal });
}

export async function recordExport(params: {
  type: string;
  format: string;
  start_date?: string;
  end_date?: string;
  record_count: number;
}) {
  return consoleApi.recordExport(params);
}

export async function fetchExportStats(signal?: AbortSignal): Promise<ExportStats> {
  return consoleApi.getExportStats({ signal });
}
