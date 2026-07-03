'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import dynamic from 'next/dynamic';

import { DashboardPageLayout } from '~/core/ui/PageLayout';
import Button from '~/core/ui/Button';
import Alert from '~/core/ui/Alert';
import Badge from '~/core/ui/Badge';
import { ResourceEmptyState, ResourceErrorState } from '~/core/ui/ResourceState';
import { useEnhancedSubscription } from '~/core/hooks/use-billing-api';
import LazyRender from '~/core/ui/LazyRender';

// Hooks
import { useOffersPageState } from '~/app/(app)/offers/hooks/useOffersPageState';

// Components
import { OffersTable } from './OffersTable';
import { OffersGettingStarted } from './OffersGettingStarted';
import { PermissionGuard } from '~/components/PermissionGuard';

// Lazy load dialog components
const CreateOfferDialog = dynamic(
  () => import('~/app/(app)/offers/components/CreateOfferDialog'),
  { ssr: false }
);

const OfferDetailDialog = dynamic(
  () => import('./OfferDetailDialog').then(mod => ({ default: mod.OfferDetailDialog })),
  { ssr: false }
);

const AIEvaluationModal = dynamic(
  () => import('./AIEvaluationModal').then(mod => ({ default: mod.AIEvaluationModal })),
  { ssr: false }
);

export function OffersPage() {
  const { t } = useTranslation('common');
  const router = useRouter();

  // Get subscription information and permissions
  const {
    subscription,
    permissions,
    isLoading: subscriptionLoading,
    canCreateOffers,
    canUseAI,
    needsUpgrade
  } = useEnhancedSubscription();

  // Use the comprehensive page state hook
  const {
    filteredOffers,
    totalCount,
    isInitialLoading,
    isLoading,
    isRefreshing,
    error,
    hasOffers,
    hasFilteredOffers,
    detailId,
    setDetailId,
    isCreateOpen,
    setCreateOpen,
    filters,
    bulkActions,
    offerActions,
    syncStatusMap,
    mutate,
  } = useOffersPageState();

  // AI Evaluation Modal state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  return (
    <PermissionGuard requirePermission="createOffers">
      <DashboardPageLayout
        header={{
          title: t('offers.ui.title', 'Offers Management'),
          description: t('offers.ui.description', 'Manage and evaluate your affiliate offers'),
          actions: (
            <div className="flex items-center gap-2">
              <PermissionGuard requirePermission="createOffers" fallback={null}>
                <Button size={'sm'} onClick={() => setCreateOpen(true)} className="hidden sm:inline-flex">
                  {t('offers.ui.createOffer', 'Create Offer')}
                </Button>
                <Button size={'sm'} onClick={() => setCreateOpen(true)} className="sm:hidden px-3">
                  <span className="text-lg">+</span>
                </Button>
              </PermissionGuard>
            </div>
          ),
        }}
      >
        <div className={'flex flex-col gap-4'}>
          {/* AI Features Section - Only show if user has AI permission */}
          {canUseAI && (
            <Alert type={'success'} className={'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'}>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {t('offers.ui.aiFeaturesAvailable', 'AI评估功能已启用')}
                </span>
                <Badge variant="outline">
                  {subscription?.currentTokenBalance.toLocaleString()} {t('offers.ui.tokens', 'tokens')}
                </Badge>
              </div>
              <Button
                size={'sm'}
                variant={'outline'}
                onClick={() => {
                  if (bulkActions.selected.size > 0) {
                    bulkActions.handleBulkEvaluate();
                  } else {
                    // Open AI evaluation modal for all offers (future implementation)
                  }
                }}
                className="w-full sm:w-auto"
              >
                {t('offers.ui.evaluateWithAI', 'AI评估')}
              </Button>
            </Alert>
          )}

          {/* Token balance warning */}
          {subscription && subscription.currentTokenBalance < 100 && (
            <Alert type={'warn'} className={'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'}>
              <span className={'text-sm text-muted-foreground'}>
                {t('offers.ui.lowTokensWarning', 'Token余额不足，请及时充值')}
              </span>

              <Button
                size={'sm'}
                variant={'outline'}
                onClick={() => {
                  window.location.href = '/settings/subscription';
                }}
                className="w-full sm:w-auto"
              >
                {t('offers.ui.topUp', '充值')}
              </Button>
            </Alert>
          )}

          {/* Error state */}
          {!isLoading && error ? (
            <ResourceErrorState
              className={'mt-4'}
              title={t('offers.errors.listLoadFailed', 'Failed to load offers')}
              description={t('offers.errors.checkNetworkConnection', 'Please check your network connection')}
              error={error}
              onRetry={() => mutate()}
            />
          ) : null}

          {/* Getting started (no offers) */}
          <LazyRender>
            {!isInitialLoading && !hasOffers ? (
              <OffersGettingStarted
                onCreate={() => setCreateOpen(true)}
                onConnectAds={() => router.push('/adscenter')}
                onViewDocs={() => router.push('/resources')}
              />
            ) : null}
          </LazyRender>

          {/* Empty state (filters applied but no results) */}
          {hasOffers && !hasFilteredOffers && !isLoading ? (
            <ResourceEmptyState
              className={'mt-4'}
              title={t('offers.ui.noMatchingOffers', 'No matching offers')}
              description={t('offers.ui.tryAdjustingFilters', 'Try adjusting your filters')}
              primaryAction={{
                label: t('offers.ui.resetFilters', 'Reset Filters'),
                onClick: () => filters.resetFilters(),
              }}
            />
          ) : null}

          {/* Offers table */}
          <LazyRender>
            {hasOffers && (
              <OffersTable
                offers={filteredOffers}
                isLoading={isLoading}
                selectedIds={bulkActions.selected}
                onToggle={bulkActions.toggleSelection}
                onToggleAll={bulkActions.toggleSelectAll}
                onView={(offer) => setDetailId(offer.id)}
                onEvaluate={offerActions.handleEvaluate}
                onDelete={offerActions.handleDelete}
                onToggleFavorite={offerActions.handleToggleFavorite}
                pendingActionIds={bulkActions.pendingActionIds}
                syncStatusMap={syncStatusMap}
              />
            )}
          </LazyRender>
        </div>
      </DashboardPageLayout>

      {/* Dialogs */}
      <PermissionGuard requirePermission="createOffers" fallback={null}>
        {isCreateOpen && (
          <CreateOfferDialog
            open={isCreateOpen}
            onOpenChange={setCreateOpen}
            onCreated={() => {
              setCreateOpen(false);
              mutate(); // Refresh offers list
            }}
          />
        )}
      </PermissionGuard>

      {detailId && (
        <OfferDetailDialog
          offerId={detailId}
          open={!!detailId}
          onClose={() => setDetailId(null)}
        />
      )}

      {/* AI Evaluation Modal */}
      <PermissionGuard requirePermission="useAI" fallback={null}>
        <AIEvaluationModal
          open={isAIModalOpen}
          onOpenChange={setIsAIModalOpen}
          selectedOfferIds={bulkActions.selected.size > 0 
            ? Array.from(bulkActions.selected) 
            : filteredOffers.map(offer => offer.id)
          }
          tokenBalance={subscription?.currentTokenBalance || 0}
          estimatedCost={bulkActions.selected.size > 0 
            ? bulkActions.selected.size * 10 
            : filteredOffers.length * 10
          }
          onSuccess={() => {
            mutate(); // Refresh offers list
            setIsAIModalOpen(false);
          }}
        />
      </PermissionGuard>
    </PermissionGuard>
  );
}