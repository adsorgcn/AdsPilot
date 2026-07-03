import { consoleApi } from '~/lib/api';
import type { InsightsResponse } from '~/lib/api/types/console';

export async function fetchInsights(signal?: AbortSignal): Promise<InsightsResponse> {
  return consoleApi.getInsights({ signal });
}
