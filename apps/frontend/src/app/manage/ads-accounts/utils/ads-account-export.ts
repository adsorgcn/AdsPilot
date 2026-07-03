import { toast } from 'sonner';
import { exportToCsv } from '~/lib/utils/csv-export';
import type { AdsAccountAdmin } from '~/lib/api/types/console';

import {
  formatCurrencyValue,
  formatRoasValue,
  formatDateValue,
} from './formatters';

/**
 * 导出广告账号到CSV
 */
export function exportAdsAccountsToCsv(accounts: AdsAccountAdmin[]) {
  if (!accounts.length) {
    toast.info('No accounts to export');
    return;
  }

  try {
    exportToCsv(
      accounts,
      [
        { key: 'accountName', label: 'Account Name' },
        { key: 'accountId', label: 'Account ID' },
        { key: 'provider', label: 'Provider' },
        { key: 'status', label: 'Status' },
        {
          key: 'totalCost',
          label: 'Total Cost',
          format: formatCurrencyValue,
        },
        {
          key: 'totalRevenue',
          label: 'Total Revenue',
          format: formatCurrencyValue,
        },
        { key: 'roas', label: 'ROAS', format: formatRoasValue },
        { key: 'linkedOffersCount', label: 'Linked Offers' },
        { key: 'activeCampaignsCount', label: 'Active Campaigns' },
        { key: 'connectedAt', label: 'Connected', format: formatDateValue },
        {
          key: 'lastSyncedAt',
          label: 'Last Synced',
          format: formatDateValue,
        },
      ],
      `ads-accounts-${new Date().toISOString().split('T')[0]}.csv`,
    );
    toast.success(`Exported ${accounts.length} accounts to CSV`);
  } catch (err) {
    toast.error(
      `Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }
}
