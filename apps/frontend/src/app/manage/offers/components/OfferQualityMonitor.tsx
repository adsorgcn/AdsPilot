'use client';

import { useMemo } from 'react';
import {
  ResourceEmptyState,
  ResourceErrorState,
  ResourceListSkeleton,
} from '~/core/ui/ResourceState';
import {
  useConsoleOfferQualityMetrics,
  useConsoleFailureReasons,
  useConsoleProblemOffers,
} from '~/lib/admin/resources/offers';


export default function OfferQualityMonitor() {
  const {
    data: metrics,
    error: metricsError,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useConsoleOfferQualityMetrics();
  const {
    data: reasons,
    error: reasonsError,
    isLoading: reasonsLoading,
    refetch: refetchReasons,
  } = useConsoleFailureReasons({});
  const {
    data: problems,
    error: problemsError,
    isLoading: problemsLoading,
    refetch: refetchProblems,
  } = useConsoleProblemOffers({});

  const combinedError = metricsError ?? reasonsError ?? problemsError;
  const loading = metricsLoading || reasonsLoading || problemsLoading;

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-red-600';
    if (value < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return '↑';
    if (value < 0) return '↓';
    return '→';
  };

  const retryAll = () => {
    void Promise.allSettled([
      refetchMetrics(),
      refetchReasons(),
      refetchProblems(),
    ]);
  };

  // Extract data before any early returns to satisfy hooks rules
  const scoreDistribution = useMemo(
    () => metrics?.scoreDistribution ?? [],
    [metrics?.scoreDistribution],
  );
  const failureReasons = useMemo(
    () => reasons?.reasons ?? [],
    [reasons?.reasons],
  );
  const problemOffers = useMemo(
    () => problems?.offers ?? [],
    [problems?.offers],
  );
  const totalProblemOffers = problems?.total ?? problemOffers.length;
  const hasProblemOffers = problemOffers.length > 0;

  
  if (combinedError) {
    return (
      <ResourceErrorState
        title="质量监控加载失败"
        description="暂时无法获取 Offer 质量指标，请稍后重试。"
        error={combinedError}
        onRetry={retryAll}
      />
    );
  }

  if (loading && !metrics) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border bg-card p-6">
            <ResourceListSkeleton rows={2} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">Failure Rate</div>
          <div className={`text-3xl font-bold ${(metrics?.failureRate ?? 0) > 15 ? 'text-red-600' : 'text-green-600'}`}>
            {(metrics?.failureRate ?? 0).toFixed(1)}%
          </div>
          <div className={`mt-1 text-xs ${getTrendColor(metrics?.weekOverWeek ?? 0)}`}>
            {getTrendIcon(metrics?.weekOverWeek ?? 0)} {Math.abs(metrics?.weekOverWeek ?? 0).toFixed(1)}% WoW
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">Avg Siterank</div>
          <div className="text-3xl font-bold">{(metrics?.averageSiterank ?? 0).toFixed(1)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Median: {(metrics?.medianSiterank ?? 0).toFixed(1)}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">Conversion Rate</div>
          <div className="text-3xl font-bold text-blue-600">{(metrics?.conversionRate ?? 0).toFixed(1)}%</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {metrics?.offersWithRevenue ?? 0} / {metrics?.deployedOffers ?? 0} deployed
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm text-muted-foreground">Problem Offers</div>
          <div className="text-3xl font-bold text-orange-600">{problems?.total ?? 0}</div>
          <div className="mt-1 text-xs text-muted-foreground">Last 30 days</div>
        </div>
      </div>

      {/* Charts - 暂时简化以减少bundle */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Score Distribution - 简化版本 */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Score Distribution</h3>
          {scoreDistribution.length ? (
            <div className="space-y-2">
              {scoreDistribution.map((item: any) => (
                <div key={item.range} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <span className="text-sm">{item.range}</span>
                  <span className="text-sm font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <ResourceEmptyState
              title="暂无分布数据"
              description="当前统计区间内未收集到评分分布数据。"
            />
          )}
        </div>

        {/* Failure Reasons - 简化版本 */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Failure Reasons</h3>
          {failureReasons.length ? (
            <div className="space-y-2">
              {failureReasons.slice(0, 5).map((reason: any) => (
                <div key={reason.reason} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <span className="text-sm flex-1">{reason.reason}</span>
                  <span className="text-xs font-semibold px-2 py-1 bg-primary/10 rounded">
                    {reason.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <ResourceEmptyState
              title="暂无失败原因"
              description="最近周期内没有记录到失败原因。"
            />
          )}
        </div>
      </div>

      {/* Problem Offers Table */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Problem Offers</h3>
        {hasProblemOffers ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Offer
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Score
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Issue
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {problemOffers.slice(0, 10).map((offer: any) => (
                  <tr key={offer.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-sm text-foreground">{offer.name}</td>
                    <td className="px-4 py-2 text-sm text-foreground">
                      {offer.siterankScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          offer.flagged === 'failed_eval'
                            ? 'bg-red-100 text-red-800'
                            : offer.flagged === 'low_score'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {offer.flagged === 'failed_eval'
                          ? 'Failed'
                          : offer.flagged === 'low_score'
                            ? 'Low Score'
                            : 'No Revenue'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {offer.failureReason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ResourceEmptyState
            title="暂无问题 Offer"
            description="最近 30 天内没有检测到异常的 Offer。"
          />
        )}

        {totalProblemOffers && totalProblemOffers > problemOffers.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {problemOffers.length} / {totalProblemOffers} problem offers（最近 30 天）
          </p>
        ) : null}
      </div>
    </div>
  );
}
