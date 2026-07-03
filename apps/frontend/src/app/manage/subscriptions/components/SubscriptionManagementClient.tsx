'use client';

import { useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Button from '~/core/ui/Button';
import {
  ResourceEmptyState,
  ResourceErrorState,
  ResourceTableSkeleton,
} from '~/core/ui/ResourceState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import Badge from '~/core/ui/Badge';
import { useConsoleSubscriptions } from '~/lib/admin/resources/subscriptions';
import SubscriptionDetailDialog from './SubscriptionDetailDialog';

export default function SubscriptionManagementClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParam, setSearchParam] = useState<string | undefined>(undefined);
  const [planFilter, setPlanFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const {
    data,
    error,
    isLoading,
    refetch,
  } = useConsoleSubscriptions({
    page,
    pageSize,
    search: searchParam,
    plan: planFilter || undefined,
    status: statusFilter || undefined,
  });

  const subscriptions = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [],
  );

  const handleSearch = () => {
    const query = searchQuery.trim();
    setSearchParam(query.length ? query : undefined);
    setPage(1);
  };

  const handleReset = () => {
    setSearchQuery('');
    setSearchParam(undefined);
    setPlanFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'trialing':
        return 'info';
      case 'canceled':
        return 'error';
      case 'inactive':
        return 'normal';
      default:
        return 'normal';
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'elite':
        return 'normal';
      case 'pro':
        return 'info';
      case 'starter':
        return 'normal';
      default:
        return 'normal';
    }
  };

  if (error) {
    return (
      <ResourceErrorState
        title={'Subscription List Load Failed'}
        description={'Unable to get subscription list, please try again later.'}
        error={error}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <input
            type="text"
            placeholder="Search by user email or name..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSearch();
              }
            }}
            className="flex-1 rounded-md border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Plans</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="canceled">Canceled</option>
            <option value="inactive">Inactive</option>
          </select>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSearch} disabled={isLoading}>
              <MagnifyingGlassIcon className="h-4 w-4" />
              Search
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={isLoading}>
              Reset
            </Button>
          </div>
        </div>

        {/* Table */}
        {isLoading && !subscriptions.length ? (
          <ResourceTableSkeleton rows={pageSize} columns={6} />
        ) : subscriptions.length === 0 ? (
          <ResourceEmptyState
            title="No subscriptions found"
            description={searchParam || planFilter || statusFilter
              ? "No subscriptions match your search criteria."
              : "No subscriptions in the system yet."}
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period End</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{subscription.userEmail || 'N/A'}</span>
                          {subscription.userName && (
                            <span className="text-xs text-muted-foreground">
                              {subscription.userName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color={getPlanBadgeColor(subscription.planName) as any}>
                          {subscription.planName.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge color={getStatusBadgeColor(subscription.status) as any}>
                          {subscription.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {subscription.currentPeriodEnd
                          ? dateFormatter.format(new Date(subscription.currentPeriodEnd))
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {dateFormatter.format(new Date(subscription.createdAt))}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSubscriptionId(subscription.id)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} subscriptions
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2 px-3 text-sm">
                    Page {page} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isLoading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedSubscriptionId && (
        <SubscriptionDetailDialog
          subscriptionId={selectedSubscriptionId}
          open={!!selectedSubscriptionId}
          onClose={() => setSelectedSubscriptionId(null)}
          onUpdate={() => refetch()}
        />
      )}
    </>
  );
}
