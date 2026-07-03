'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Filter,
  Download,
  Sparkles,
  Search,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Star,
  Link2,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

import { DashboardPageLayout } from '~/core/ui/PageLayout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '~/components/ui/GlassCard';
import { GradientButton } from '~/components/ui/GradientButton';
import { MetricCard } from '~/components/ui/MetricCard';
import { ProgressRing } from '~/components/ui/ProgressRing';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';
import { useOffersPageState } from '~/app/(app)/offers/hooks/useOffersPageState';
import { EvaluationCardModal } from './EvaluationCardModal';

// Phase 2 & 3 Components
import { AIFeatureBanner } from './AIFeatureBanner';
import { BatchActionsToolbar } from './BatchActionsToolbar';
import { PageTransition } from '~/components/ui/PageTransition';
import { SkeletonTable, SkeletonMetricCard } from '~/components/ui/SkeletonLoader';
import { EmptySearchState, EmptyDataState } from '~/components/ui/EmptyState';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '~/components/ui/KeyboardShortcuts';

// Phase 4 & 5 Components - Ready for integration
// import { MobileTableView } from '~/components/mobile/MobileTableView';
// import { PullToRefresh } from '~/components/mobile/PullToRefresh';
// import { SwipeableCard } from '~/components/mobile/SwipeableCard';
// import { VirtualList } from '~/components/performance/VirtualList';
// import { useIsMobile } from '~/hooks/useMediaQuery';
// import { TrashIcon } from '@heroicons/react/24/outline';

export function EnhancedOffersPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [offerToEvaluate, setOfferToEvaluate] = useState<any>(null);
  const [selectedOffers, setSelectedOffers] = useState<Set<string>>(new Set());
  const [isBatchEvaluating, setIsBatchEvaluating] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const {
    canUseAI,
    canCreateOffers,
  } = useEnhancedSubscription();

  const {
    filteredOffers,
    isLoading,
  } = useOffersPageState();

  // const isMobile = useIsMobile(); // Ready for mobile integration

  // Manual refresh function
  const mutate = async () => {
    // TODO: Implement refresh logic
    await new Promise(resolve => setTimeout(resolve, 500));
    window.location.reload();
  };

  // Filter by search query
  const searchFilteredOffers = useMemo(() => {
    if (!searchQuery) return filteredOffers;
    const query = searchQuery.toLowerCase();
    return filteredOffers.filter(offer => 
      offer.url?.toLowerCase().includes(query) ||
      offer.name?.toLowerCase().includes(query)
    );
  }, [filteredOffers, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = searchFilteredOffers.length;
    const evaluated = searchFilteredOffers.filter(o => o.latestEvaluation?.status === 'completed').length;
    const pending = searchFilteredOffers.filter(o => !o.latestEvaluation || o.latestEvaluation.status === 'pending').length;
    const avgScore = searchFilteredOffers
      .filter(o => o.latestEvaluation?.aiRecommendationScore)
      .reduce((acc, o) => acc + (o.latestEvaluation?.aiRecommendationScore || 0), 0) / evaluated || 0;

    return { total, evaluated, pending, avgScore };
  }, [searchFilteredOffers]);

  // Selection handlers
  const handleToggleSelection = (offerId: string) => {
    setSelectedOffers(prev => {
      const next = new Set(prev);
      if (next.has(offerId)) {
        next.delete(offerId);
      } else {
        next.add(offerId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedOffers.size === searchFilteredOffers.length) {
      setSelectedOffers(new Set());
    } else {
      setSelectedOffers(new Set(searchFilteredOffers.map(o => o.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedOffers(new Set());
  };

  // Batch actions
  const handleBatchEvaluate = async () => {
    if (selectedOffers.size === 0) return;
    setIsBatchEvaluating(true);
    try {
      // TODO: Implement batch evaluation API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      mutate();
      setSelectedOffers(new Set());
    } finally {
      setIsBatchEvaluating(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedOffers.size === 0) return;
    setIsBatchDeleting(true);
    try {
      // TODO: Implement batch delete API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      mutate();
      setSelectedOffers(new Set());
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleBatchExport = () => {
    // TODO: Implement export functionality
    console.log('Exporting', selectedOffers.size, 'offers');
  };

  const handleEvaluate = (offer: any) => {
    setOfferToEvaluate(offer);
    setIsEvaluationModalOpen(true);
  };

  const handleEvaluationComplete = () => {
    mutate();
    setIsEvaluationModalOpen(false);
    setOfferToEvaluate(null);
  };

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    {
      key: 'cmd+k',
      description: t('shortcuts.search', 'Search offers'),
      action: () => document.querySelector<HTMLInputElement>('input[type="text"]')?.focus(),
      category: 'Navigation',
    },
    {
      key: 'cmd+n',
      description: t('shortcuts.createOffer', 'Create new offer'),
      action: () => router.push('/offers?action=create'),
      category: 'Actions',
    },
    {
      key: 'cmd+e',
      description: t('shortcuts.evaluateSelected', 'Evaluate selected offers'),
      action: () => {
        if (selectedOffers.size > 0) {
          handleBatchEvaluate();
        }
      },
      category: 'Actions',
    },
    {
      key: 'cmd+a',
      description: t('shortcuts.selectAll', 'Select all offers'),
      action: () => handleSelectAll(),
      category: 'Selection',
    },
    {
      key: 'esc',
      description: t('shortcuts.clearSelection', 'Clear selection'),
      action: () => handleClearSelection(),
      category: 'Selection',
    },
  ], [t, router, selectedOffers.size]);

  const { showHelp, setShowHelp } = useKeyboardShortcuts(shortcuts);

  return (
    <PageTransition variant="fade">
      <DashboardPageLayout
        header={{
          title: t('offers.title', 'Offer Management'),
          description: t('offers.description', 'Manage and evaluate your affiliate offers'),
          actions: (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => mutate()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <GradientButton
                size="sm"
                onClick={() => router.push('/offers?action=create')}
                disabled={!canCreateOffers}
              >
                <Plus className="h-4 w-4" />
                {t('offers.createOffer', 'Add Offer')}
              </GradientButton>
            </div>
          ),
        }}
      >
        <div className="space-y-6">
          {/* AI Features Banner */}
          <AIFeatureBanner
            tokenBalance={0}
            subscriptionTier={'trial'}
            canUseAI={canUseAI}
            selectedCount={selectedOffers.size}
            onEvaluate={handleBatchEvaluate}
            onUpgrade={() => router.push('/settings/subscription')}
          />

          {/* Statistics Cards */}
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <SkeletonMetricCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title={t('offers.stats.total', 'Total Offers')}
                value={stats.total}
                icon={<BarChart3 className="h-6 w-6 text-blue-600" />}
              />
              <MetricCard
                title={t('offers.stats.evaluated', 'Evaluated')}
                value={stats.evaluated}
                subtitle={`${Math.round((stats.evaluated / stats.total) * 100) || 0}% ${t('offers.stats.complete', 'complete')}`}
                icon={<TrendingUp className="h-6 w-6 text-green-600" />}
                variant="success"
              />
              <MetricCard
                title={t('offers.stats.pending', 'Pending')}
                value={stats.pending}
                subtitle={t('offers.stats.awaitingEval', 'Awaiting evaluation')}
                icon={<Star className="h-6 w-6 text-yellow-600" />}
                variant="warning"
              />
              <MetricCard
                title={t('offers.stats.avgScore', 'Avg Score')}
                value={stats.avgScore > 0 ? stats.avgScore.toFixed(1) : 'N/A'}
                icon={<Sparkles className="h-6 w-6 text-purple-600" />}
                variant="primary"
              />
            </div>
          )}

          {/* Filters and Search */}
          <GlassCard>
            <GlassCardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={t('offers.searchPlaceholder', 'Search offers...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline">
                    <Filter className="h-4 w-4" />
                    {t('offers.filter', 'Filter')}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleBatchExport}
                    disabled={selectedOffers.size === 0}
                  >
                    <Download className="h-4 w-4" />
                    {t('offers.export', 'Export')}
                  </Button>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Offers Table */}
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center justify-between">
                <span>{t('offers.list', 'Offers List')}</span>
                <div className="flex items-center gap-2">
                  {selectedOffers.size > 0 && (
                    <Badge variant="default" className="bg-blue-100 text-blue-700">
                      {selectedOffers.size} {t('offers.selected', 'selected')}
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {searchFilteredOffers.length} {t('offers.items', 'items')}
                  </Badge>
                </div>
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              {isLoading ? (
                <SkeletonTable rows={5} columns={7} />
              ) : searchFilteredOffers.length === 0 ? (
                searchQuery ? (
                  <EmptySearchState
                    searchQuery={searchQuery}
                    onClear={() => setSearchQuery('')}
                  />
                ) : (
                  <EmptyDataState
                    title={t('offers.noOffers', 'No offers yet')}
                    description={t('offers.noOffersDesc', 'Get started by creating your first offer')}
                    actionLabel={t('offers.createOffer', 'Create Offer')}
                    onAction={() => router.push('/offers?action=create')}
                  />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedOffers.size === searchFilteredOffers.length && searchFilteredOffers.length > 0}
                            onChange={handleSelectAll}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          {t('offers.table.url', 'URL')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          {t('offers.table.country', 'Country')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          {t('offers.table.brand', 'Brand')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          {t('offers.table.score', 'Score')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          {t('offers.table.status', 'Status')}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          {t('offers.table.adsAccount', 'Ads Account')}
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                          {t('offers.table.actions', 'Actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchFilteredOffers.map((offer) => (
                        <tr
                          key={offer.id}
                          className="border-b border-gray-100 transition-colors hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedOffers.has(offer.id)}
                              onChange={() => handleToggleSelection(offer.id)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-xs truncate text-sm font-medium">
                              {offer.url}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">US</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm">{offer.name || '-'}</span>
                          </td>
                          <td className="px-4 py-3">
                            {offer.latestEvaluation?.aiRecommendationScore ? (
                              <div className="flex items-center gap-2">
                                <ProgressRing
                                  value={offer.latestEvaluation.aiRecommendationScore}
                                  max={100}
                                  size="sm"
                                  showValue={false}
                                />
                                <span className="text-sm font-semibold">
                                  {offer.latestEvaluation.aiRecommendationScore}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                offer.latestEvaluation?.status === 'completed'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {offer.latestEvaluation?.status || 'pending'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="ghost">
                              <Link2 className="h-4 w-4" />
                            </Button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEvaluate(offer)}
                              >
                                <Sparkles className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  // TODO: Implement view details
                                  console.log('View offer', offer.id);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </div>
      </DashboardPageLayout>

      {/* Batch Actions Toolbar */}
      <BatchActionsToolbar
        selectedCount={selectedOffers.size}
        visible={selectedOffers.size > 0}
        isEvaluating={isBatchEvaluating}
        isDeleting={isBatchDeleting}
        onEvaluate={handleBatchEvaluate}
        onDelete={handleBatchDelete}
        onExport={handleBatchExport}
        onClearSelection={handleClearSelection}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        shortcuts={shortcuts}
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* Evaluation Modal */}
      {offerToEvaluate && (
        <EvaluationCardModal
          open={isEvaluationModalOpen}
          onOpenChange={setIsEvaluationModalOpen}
          offerId={offerToEvaluate.id}
          offerUrl={offerToEvaluate.url}
          onComplete={handleEvaluationComplete}
        />
      )}
    </PageTransition>
  );
}