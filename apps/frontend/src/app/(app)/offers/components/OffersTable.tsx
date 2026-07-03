"use client";

import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '~/core/ui/Checkbox';

import type { Offer } from '~/lib/offers';
import type { OfferSyncResult } from '~/lib/tasks/offer-sync';

import { OfferRow } from './OfferRow';

type Props = {
  offers: Offer[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggle: (offerId: string, selected: boolean) => void;
  onToggleAll: (selected: boolean) => void;
  onView: (offer: Offer) => void;
  onEvaluate: (offer: Offer) => void;
  onDelete: (offer: Offer) => void;
  onToggleFavorite: (offer: Offer, nextValue: boolean) => void;
  pendingActionIds?: Set<string>;
  maxHeight?: number;
  scrollKey?: string;
  syncStatusMap?: Map<string, OfferSyncResult>;
};

const DEFAULT_MAX_HEIGHT = 640;
const ROW_ESTIMATE = 120;

function OffersTable({
  offers,
  isLoading,
  selectedIds,
  onToggle,
  onToggleAll,
  onView,
  onEvaluate,
  onDelete,
  onToggleFavorite,
  pendingActionIds,
  maxHeight = DEFAULT_MAX_HEIGHT,
  scrollKey,
  syncStatusMap,
}: Props) {
  const { t } = useTranslation('common');
  const hasOffers = offers.length > 0;
  const allSelected = hasOffers && selectedIds.size === offers.length;

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: offers.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    getItemKey: (index) => offers[index]?.id ?? index,
    measureElement: (element) =>
      element ? element.getBoundingClientRect().height : ROW_ESTIMATE,
  });

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    virtualizer.scrollToIndex(0, { align: 'start' });
  }, [scrollKey, virtualizer]);

  if (!hasOffers && !isLoading) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => onToggleAll(checked === true)}
            disabled={!hasOffers || isLoading}
            aria-label={t('offers.table.selectAll')}
          />
          <span>
            {hasOffers
              ? t('offers.table.count', { count: offers.length })
              : t('offers.table.noData')}
          </span>
        </div>
      </div>

      <div className="hidden border-b border-border bg-muted/70 px-4 py-2.5 text-sm font-medium text-muted-foreground lg:grid lg:grid-cols-[3rem_minmax(260px,1fr)_140px_150px_140px_150px_120px_160px] lg:gap-4">
        <span />
        <span>{t('offers.table.headerOffer')}</span>
        <span>{t('offers.table.headerStatus')}</span>
        <span className="text-center">{t('offers.table.headerAiScore')}</span>
        <span>{t('offers.table.headerSyncStatus')}</span>
        <span>{t('offers.table.headerLastUpdated')}</span>
        <span>{t('offers.table.headerTargetMarket')}</span>
        <span className="text-right">{t('offers.table.headerActions')}</span>
      </div>

      {isLoading && !hasOffers ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-md bg-muted"
            />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight }}
        >
          {hasOffers ? (
            <div
              className="relative"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const offer = offers[virtualRow.index];

                if (!offer) {
                  return null;
                }

                const isLast = virtualRow.index === offers.length - 1;
                const isPending = pendingActionIds?.has(offer.id) ?? false;

                return (
                  <div
                    key={offer.id}
                    ref={virtualizer.measureElement}
                    className="absolute left-0 right-0"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <OfferRow
                      offer={offer}
                      selected={selectedIds.has(offer.id)}
                      isPending={isPending}
                      isLast={isLast}
                      onToggle={onToggle}
                      onView={onView}
                      onEvaluate={onEvaluate}
                      onDelete={onDelete}
                      onToggleFavorite={onToggleFavorite}
                      syncStatus={syncStatusMap?.get(offer.id)}
                      t={t}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {t('offers.table.noMatchingOffers')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OffersTable;
