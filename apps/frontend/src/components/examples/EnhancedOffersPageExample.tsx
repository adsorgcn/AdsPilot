'use client';

/**
 * EnhancedOffersPageExample - Complete example of Phase 2 & 3 components integration
 * 
 * This file demonstrates how to integrate all the new components into the Offers page.
 * Copy and adapt this code to your actual OffersPage component.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Plus, Sparkles } from 'lucide-react';

// Phase 2 Components
import { AIFeatureBanner } from '~/components/offers/AIFeatureBanner';
import { BatchActionsToolbar } from '~/components/offers/BatchActionsToolbar';
import { EvaluationCardModal } from '~/components/offers/EvaluationCardModal';

// Phase 3 Components
import { PageTransition, SlideIn, Stagger, StaggerItem } from '~/components/ui/PageTransition';
import { SkeletonTable, SkeletonMetricCard } from '~/components/ui/SkeletonLoader';
import { EmptyDataState, EmptySearchState } from '~/components/ui/EmptyState';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '~/components/ui/KeyboardShortcuts';
import { LoadingOverlay } from '~/components/ui/LoadingOverlay';

// Existing Components
import { DashboardPageLayout } from '~/core/ui/PageLayout';
import { GlassCard } from '~/components/ui/GlassCard';
import { GradientButton } from '~/components/ui/GradientButton';
import { MetricCard } from '~/components/ui/MetricCard';

// Hooks
// import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';

export function EnhancedOffersPageExample() {
  const { t } = useTranslation('common');
  const router = useRouter();

  // State
  const [selectedOffers, setSelectedOffers] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  // Subscription data (currently using mock data for demo)
  // const { subscription } = useEnhancedSubscription();
  
  // Mock token balance and tier (replace with actual data when available)
  const tokenBalance = 1000;
  const subscriptionTier = 'pro' as 'trial' | 'pro' | 'max' | 'elite';
  const canUseAI = true;

  // Mock data (replace with actual data fetching)
  const offers = React.useMemo(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 1000);
    return [
      { id: '1', name: 'Nike Offer', status: 'active', score: 8.5 },
      { id: '2', name: 'Adidas Offer', status: 'pending', score: null },
      { id: '3', name: 'Puma Offer', status: 'active', score: 7.2 },
    ];
  }, []);

  const filteredOffers = React.useMemo(() => {
    if (!searchQuery) return offers;
    return offers.filter(o => 
      o.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [offers, searchQuery]);

  // Statistics
  const stats = React.useMemo(() => ({
    total: offers.length,
    evaluated: offers.filter(o => o.score !== null).length,
    pending: offers.filter(o => o.score === null).length,
    avgScore: offers.reduce((acc, o) => acc + (o.score || 0), 0) / offers.filter(o => o.score).length || 0,
  }), [offers]);

  // Keyboard shortcuts
  const shortcuts = React.useMemo(() => [
    {
      key: 'cmd+k',
      description: t('shortcuts.search', 'Search offers'),
      action: () => {
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        searchInput?.focus();
      },
      category: 'Navigation',
    },
    {
      key: 'cmd+n',
      description: t('shortcuts.newOffer', 'Create new offer'),
      action: () => router.push('/offers?action=create'),
      category: 'Actions',
    },
    {
      key: 'cmd+e',
      description: t('shortcuts.evaluate', 'Evaluate selected offers'),
      action: () => {
        if (selectedOffers.length > 0) {
          handleBatchEvaluate();
        }
      },
      category: 'Actions',
    },
    {
      key: 'cmd+a',
      description: t('shortcuts.selectAll', 'Select all offers'),
      action: () => setSelectedOffers(offers.map(o => o.id)),
      category: 'Selection',
    },
    {
      key: 'esc',
      description: t('shortcuts.clearSelection', 'Clear selection'),
      action: () => setSelectedOffers([]),
      category: 'Selection',
    },
  ], [offers, selectedOffers, router, t]);

  const { showHelp, setShowHelp } = useKeyboardShortcuts(shortcuts);

  // Handlers
  const handleBatchEvaluate = async () => {
    setIsEvaluating(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsEvaluating(false);
    setSelectedOffers([]);
  };

  const handleBatchDelete = async () => {
    setIsDeleting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsDeleting(false);
    setSelectedOffers([]);
  };

  const handleBatchExport = () => {
    // Export logic
    console.log('Exporting offers:', selectedOffers);
  };

  const handleUpgrade = () => {
    router.push('/settings/billing');
  };

  return (
    <PageTransition variant="fade">
      <DashboardPageLayout
        header={{
          title: t('offers.title', 'Offer Management'),
          description: t('offers.description', 'Manage and evaluate your affiliate offers'),
          actions: (
            <GradientButton
              size="sm"
              onClick={() => router.push('/offers?action=create')}
            >
              <Plus className="h-4 w-4" />
              {t('offers.createOffer', 'Add Offer')}
            </GradientButton>
          ),
        }}
      >
        <div className="space-y-6">
          {/* AI Feature Banner */}
          <SlideIn direction="down">
            <AIFeatureBanner
              tokenBalance={tokenBalance}
              subscriptionTier={subscriptionTier}
              canUseAI={canUseAI}
              selectedCount={selectedOffers.length}
              onEvaluate={handleBatchEvaluate}
              onUpgrade={handleUpgrade}
            />
          </SlideIn>

          {/* Statistics Cards */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <SkeletonMetricCard key={i} />
              ))}
            </div>
          ) : (
            <Stagger>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StaggerItem>
                  <MetricCard
                    title={t('offers.stats.total', 'Total Offers')}
                    value={stats.total}
                    icon={<Sparkles className="h-5 w-5" />}
                  />
                </StaggerItem>
                <StaggerItem>
                  <MetricCard
                    title={t('offers.stats.evaluated', 'Evaluated')}
                    value={stats.evaluated}
                    trend="up"
                    trendValue="+12%"
                  />
                </StaggerItem>
                <StaggerItem>
                  <MetricCard
                    title={t('offers.stats.pending', 'Pending')}
                    value={stats.pending}
                  />
                </StaggerItem>
                <StaggerItem>
                  <MetricCard
                    title={t('offers.stats.avgScore', 'Avg Score')}
                    value={stats.avgScore.toFixed(1)}
                  />
                </StaggerItem>
              </div>
            </Stagger>
          )}

          {/* Offers Table */}
          <GlassCard>
            {isLoading ? (
              <div className="p-6">
                <SkeletonTable rows={5} columns={5} />
              </div>
            ) : filteredOffers.length === 0 ? (
              searchQuery ? (
                <EmptySearchState
                  searchQuery={searchQuery}
                  onClear={() => setSearchQuery('')}
                />
              ) : (
                <EmptyDataState
                  title={t('offers.empty.title', 'No offers yet')}
                  description={t('offers.empty.description', 'Get started by creating your first offer')}
                  actionLabel={t('offers.empty.action', 'Create Offer')}
                  onAction={() => router.push('/offers?action=create')}
                />
              )
            ) : (
              <div className="p-6">
                {/* Table content here */}
                <p className="text-sm text-muted-foreground">
                  {filteredOffers.length} offers found
                </p>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Batch Actions Toolbar */}
        <BatchActionsToolbar
          selectedCount={selectedOffers.length}
          visible={selectedOffers.length > 0}
          isEvaluating={isEvaluating}
          isDeleting={isDeleting}
          onEvaluate={handleBatchEvaluate}
          onDelete={handleBatchDelete}
          onExport={handleBatchExport}
          onClearSelection={() => setSelectedOffers([])}
        />

        {/* Evaluation Modal */}
        <EvaluationCardModal
          open={showEvaluationModal}
          onOpenChange={setShowEvaluationModal}
          offerId="example-id"
          offerUrl="https://example.com"
        />

        {/* Keyboard Shortcuts Help */}
        <KeyboardShortcutsHelp
          shortcuts={shortcuts}
          open={showHelp}
          onClose={() => setShowHelp(false)}
        />

        {/* Loading Overlay */}
        <LoadingOverlay
          visible={isEvaluating && selectedOffers.length > 5}
          message={t('offers.evaluating', 'Evaluating {{count}} offers...', {
            count: selectedOffers.length,
          })}
        />
      </DashboardPageLayout>
    </PageTransition>
  );
}