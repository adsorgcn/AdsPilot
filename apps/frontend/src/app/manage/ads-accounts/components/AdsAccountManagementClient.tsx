'use client';

import If from '~/core/ui/If';

import { useAdsAccountManagement } from '../hooks/useAdsAccountManagement';
import { AdsAccountFilters } from './AdsAccountFilters';
import { AdsAccountPagination } from './AdsAccountPagination';
import AdsAccountTable from './AdsAccountTable';
import AdsAccountDetailSheet from './AdsAccountDetailSheet';

export default function AdsAccountManagementClient() {
  const state = useAdsAccountManagement();

  return (
    <div className="flex flex-col space-y-4">
      <If condition={!!state.errorMessage}>
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                {state.errorMessage}
              </div>
            </div>
          </div>
        </div>
      </If>

      <AdsAccountFilters
        filters={state.filters}
        onFiltersChange={state.setFilters}
        performanceFilter={state.performanceFilter}
        onPerformanceFilterChange={state.setPerformanceFilter}
        syncFilter={state.syncFilter}
        onSyncFilterChange={state.setSyncFilter}
        onExport={state.handleExportCsv}
        isLoading={state.loading}
        hasAccounts={state.accounts.length > 0}
      />

      <AdsAccountTable
        accounts={state.filteredAccounts}
        isLoading={state.loading}
        isRefreshing={state.isRefreshing}
        onSelect={state.setSelectedAccount}
        scrollKey={state.scrollKey}
      />

      <div className="text-xs text-muted-foreground">
        <span>
          共 {state.total} 个账号 · 当前筛选 {state.filteredAccounts.length} 个
          · 第 {state.page} / {Math.max(state.totalPages, 1)} 页
        </span>
      </div>

      <AdsAccountPagination
        page={state.page}
        totalPages={state.totalPages}
        pageSize={state.pageSize}
        loading={state.loading}
        onPageChange={state.setPage}
        onPageSizeChange={state.setPageSize}
        onResetFilters={state.handleResetFilters}
      />

      <AdsAccountDetailSheet
        account={state.selectedAccount}
        open={!!state.selectedAccount}
        onOpenChange={(open) => {
          if (!open) {
            state.setSelectedAccount(null);
          }
        }}
      />
    </div>
  );
}
