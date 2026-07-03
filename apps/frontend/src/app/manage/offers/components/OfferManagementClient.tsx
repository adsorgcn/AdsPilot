'use client';

import { useMemo } from 'react';
import { ArchiveBoxIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import Button from '~/core/ui/Button';
import TableToolbar from '~/core/ui/TableToolbar';
import {
  ResourceEmptyState,
  ResourceErrorState,
  ResourceTableSkeleton,
} from '~/core/ui/ResourceState';
import { useConsoleOffers } from '~/lib/admin/resources/offers';
import InputDialog from '~/components/InputDialog';

import {
  useOfferManagement,
  INITIAL_FILTERS,
} from '../hooks/useOfferManagement';
import { OfferFilters } from './OfferFilters';
import { OfferTableRow } from './OfferTableRow';

export default function OfferManagementClient() {
  const management = useOfferManagement([], async () => {});

  const { data, error, isLoading, refetch } = useConsoleOffers({
    status: management.filters.status || undefined,
    search: management.filters.search || undefined,
    minScore: management.filters.minScore
      ? Number(management.filters.minScore)
      : undefined,
    maxScore: management.filters.maxScore
      ? Number(management.filters.maxScore)
      : undefined,
    sortBy: management.filters.sortBy || undefined,
    sortOrder: management.filters.sortOrder,
  });

  const offers = useMemo(() => data?.items ?? [], [data?.items]);
  const totalItems = data?.total ?? offers.length;

  // Re-initialize management with actual offers and refetch
  const state = useOfferManagement(offers, async () => {
    await refetch();
  });

  const tableRows = useMemo(() => {
    if (isLoading && offers.length === 0) {
      return <ResourceTableSkeleton rows={6} columns={6} />;
    }

    if (offers.length === 0) {
      return (
        <tr>
          <td colSpan={6}>
            <ResourceEmptyState
              title="暂无符合条件的 Offer"
              description="调整筛选条件或清除关键字以查看更多结果。"
              primaryAction={{
                label: '清除筛选',
                variant: 'outline',
                onClick: () => state.setFilters(INITIAL_FILTERS),
              }}
              secondaryAction={{
                label: '刷新列表',
                variant: 'ghost',
                onClick: () => {
                  void refetch();
                },
              }}
            />
          </td>
        </tr>
      );
    }

    return offers.map((offer: any) => (
      <OfferTableRow
        key={offer.id}
        offer={offer}
        checked={state.selectedOffers.includes(offer.id)}
        onToggle={state.toggleSelection}
      />
    ));
  }, [
    isLoading,
    offers,
    refetch,
    state,
  ]);

  if (error) {
    return (
      <ResourceErrorState
        title="Offer 列表加载失败"
        description="无法获取 Offer 列表，请稍后重试。"
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      <TableToolbar
        searchValue={state.filters.search}
        searchPlaceholder="搜索名称或域名…"
        onSearch={(value) =>
          state.setFilters((prev) => ({
            ...prev,
            search: value,
          }))
        }
        actions={
          <Button
            variant="outline"
            onClick={state.handleExportCsv}
            disabled={isLoading || offers.length === 0}
            className="flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            导出 CSV
          </Button>
        }
        filters={
          <OfferFilters filters={state.filters} onChange={state.setFilters} />
        }
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="min-w-full divide-y divide-border/80">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                  checked={
                    offers.length > 0 &&
                    state.selectedOffers.length === offers.length
                  }
                  onChange={(event) =>
                    state.toggleSelectAll(event.target.checked)
                  }
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Offer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Score
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Revenue
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80 bg-card">
            {tableRows}
          </tbody>
        </table>

        {offers.length > 0 ? (
          <div className="flex flex-col gap-2 border-t bg-muted/40 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              已选择 {state.selectedOffers.length} / {offers.length} · 当前条件共{' '}
              {totalItems} 条
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={state.selectedOffers.length === 0}
              onClick={state.handleBatchArchive}
              className="flex items-center gap-2"
            >
              <ArchiveBoxIcon className="h-4 w-4" />
              批量归档
            </Button>
          </div>
        ) : null}
      </div>

      <InputDialog
        open={state.showArchiveDialog}
        onOpenChange={state.setShowArchiveDialog}
        title="批量归档 Offer"
        description={`即将归档 ${state.selectedOffers.length} 个 Offer，请填写归档原因。`}
        fields={[
          {
            name: 'reason',
            label: '归档原因',
            type: 'text',
            placeholder: '例如：内容违规、低质量、客户要求等',
            required: true,
            defaultValue: '',
          },
        ]}
        confirmLabel="确认归档"
        onConfirm={state.handleConfirmArchive}
      />
    </div>
  );
}
